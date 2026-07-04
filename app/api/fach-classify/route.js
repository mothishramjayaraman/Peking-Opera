import { verifySession } from "../../../server/session.js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../server/storage.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

export const maxDuration = 60;

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 30000 })
  : null;

// 京剧 role taxonomy for the LLM prompt
const FACH_DESCRIPTIONS = `
京剧 (Jingju / Peking Opera) 角色行当 (Role Category) taxonomy:

Broad categories (行当):
- dan (旦): Female characters. Primarily use 小嗓/假嗓 (falsetto/head voice).
- sheng (生): Male characters. Use 大嗓 (chest/natural voice), xiaosheng also uses 小嗓.
- jing (净/花脸): Painted-face male roles. Deep, powerful 大嗓 throughout.
- chou (丑): Clown roles. Natural speech-like voice, flexible range.

Sub-types (具体行当):
旦 Dan:
  - qingyi (青衣): Dignified women. Pure 小嗓 throughout. Range C4–G5 (261–784 Hz).
  - huadan (花旦): Vivacious young women. Mixed 小嗓 with some 大嗓. Range D4–A5.
  - wudan (武旦): Martial female. Agile top register. Range C4–G5.
  - laodan (老旦): Elderly women. Uses 大嗓 (unlike other dan). Range A3–D5.
  - daomadan (刀马旦): Military heroines. Powerful and agile.

生 Sheng:
  - laosheng (老生): Mature/elder men. Primarily 大嗓. Range G2–D4 (98–294 Hz).
  - xiaosheng (小生): Young men. Heavy 小嗓 (falsetto). Range C3–G4 (131–392 Hz).
  - wusheng (武生): Martial male. Strong 大嗓. Range A2–E4.

净 Jing (花脸 Hualian):
  - dahualian (大花脸): Heroes/officials. Deep 大嗓. Range E2–A3 (82–220 Hz).
  - erhualian (二花脸): Slightly lighter jing. Range G2–C4.

丑 Chou:
  - wenchou (文丑): Civil clown. Spoken/sung mix, natural voice.
  - wuchou (武丑): Martial clown. Agile, physical.

Key vocal techniques (发声技巧):
- 大嗓/真嗓 (Da Sang / Zhen Sang): Natural chest voice — laosheng, laodan, jing
- 小嗓/假嗓 (Xiao Sang / Jia Sang): Falsetto/head voice — dan roles, xiaosheng
- 换声区 (Huansheng Qu): Register transition where 大嗓 shifts to 小嗓

Signature pieces by role:
- qingyi: 《苏三起解》(Su San Qi Jie), 《贵妃醉酒》(Gui Fei Zui Jiu), 《望江亭》(Wang Jiang Ting)
- huadan: 《拾玉镯》(Shi Yu Zhuo), 《春香闹学》(Chun Xiang Nao Xue)
- laodan: 《钓金龟》(Diao Jin Gui), 《太君辞朝》(Tai Jun Ci Chao)
- laosheng: 《空城计》(Kong Cheng Ji), 《四郎探母》(Si Lang Tan Mu), 《文昭关》(Wen Zhao Guan)
- xiaosheng: 《白蛇传》(Bai She Zhuan), 《柳荫记》(Liu Yin Ji)
- jing: 《铡美案》(Zha Mei An) — Bao Zheng role, 《霸王别姬》(Ba Wang Bie Ji) — Xiang Yu role
`;

/**
 * POST /api/fach-classify
 * Body: FormData with optional "audio" file for acoustic analysis
 * Returns: Fach classification with sub-type, repertoire recommendations, and range data
 */
export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const userId = verifySession(cookieStore.get("userId")?.value);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const user = await storage.getUser(userId);
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const formData = await req.formData();
    const audioFile = formData.get("audio");

    let pitchData = null;

    // If an audio sample was provided, call the Python /fach-analyze endpoint
    if (audioFile) {
      try {
        const pyForm = new FormData();
        pyForm.append("file", audioFile, "fach_sample.wav");

        const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";
        const pyRes = await fetch(`${backendUrl}/fach-analyze`, {
          method: "POST",
          body: pyForm,
        });

        if (pyRes.ok) {
          pitchData = await pyRes.json();
        }
      } catch (err) {
        console.warn("Python /fach-analyze unavailable:", err.message);
      }
    }

    // Build classification prompt
    const vocalRangeHint = user.vocal_range || user.vocalRange || "unknown";
    const experienceLevel = user.experience_level || user.experienceLevel || "unknown";

    let acousticContext = "";
    if (pitchData) {
      acousticContext = `
Acoustic measurements from recording:
- Mean pitch: ${pitchData.mean_hz} Hz
- Comfortable low (5th percentile): ${pitchData.min_hz} Hz
- Comfortable high (95th percentile): ${pitchData.max_hz} Hz
- Tessitura centre (IQR middle): ${Math.round((pitchData.p25_hz + pitchData.p75_hz) / 2)} Hz
- Algorithmic estimate: ${pitchData.estimated_voice_type}
`;
    } else {
      acousticContext = `No acoustic recording provided. Base classification primarily on user-declared vocal range.`;
    }

    const prompt = `You are a master 京剧 (Jingju / Peking Opera) vocal coach specialising in 行当 (role category) classification and vocal training.

${FACH_DESCRIPTIONS}

STUDENT PROFILE:
- Self-declared vocal range: ${vocalRangeHint}
- Experience level: ${experienceLevel}
${acousticContext}

Classify this singer's 京剧 行当 (role category). Return ONLY valid JSON in this exact structure:
{
  "fach": "<broad category: dan|sheng|jing|chou>",
  "subfach": "<specific role, e.g. 'qingyi', 'laosheng', 'dahualian', 'wenchou'>",
  "confidence": <integer 0-100>,
  "tessitura_description": "<one sentence describing their comfortable range and primary vocal register (大嗓 or 小嗓)>",
  "passaggio_notes": "<describe where their 换声区 (register transition) between 大嗓 and 小嗓 likely occurs, and how to smooth it>",
  "signature_arias": ["<京剧 piece 1 in Chinese with pinyin>", "<piece 2>", "<piece 3>"],
  "avoid_arias": ["<piece that would strain this voice type>"],
  "training_focus": "<one paragraph of 京剧 vocal coaching advice: focus on 大嗓/小嗓 balance, 气息 (breath support), and 韵味 (melodic ornamentation) specific to this 行当>",
  "next_steps": ["<actionable step 1>", "<actionable step 2>", "<actionable step 3>"]
}`;

    if (!groq) {
      return NextResponse.json(fallbackClassification(vocalRangeHint, pitchData));
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 700,
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let classification;
    try {
      classification = JSON.parse(raw);
    } catch {
      classification = fallbackClassification(vocalRangeHint, pitchData);
    }

    return NextResponse.json({
      ...classification,
      pitchData: pitchData || null,
      f0Contour: pitchData?.f0_contour || [],
    });
  } catch (error) {
    console.error("Fach classify error:", error);
    return NextResponse.json({ message: error.message || "Classification failed" }, { status: 500 });
  }
}

function fallbackClassification(vocalRangeHint, pitchData) {
  const vr = (vocalRangeHint || "").toLowerCase();
  let fach = "dan";
  let subfach = "qingyi";
  if (vr.includes("sheng") || vr.includes("tenor") || vr.includes("baritone")) { fach = "sheng"; subfach = "laosheng"; }
  if (vr.includes("xiaosheng"))  { fach = "sheng";  subfach = "xiaosheng"; }
  if (vr.includes("jing") || vr.includes("bass"))  { fach = "jing";   subfach = "dahualian"; }
  if (vr.includes("chou"))       { fach = "chou";   subfach = "wenchou"; }
  if (vr.includes("laodan"))     { fach = "dan";    subfach = "laodan"; }
  if (pitchData?.estimated_voice_type) fach = pitchData.estimated_voice_type;

  return {
    fach,
    subfach,
    confidence: pitchData ? 55 : 30,
    tessitura_description: "Classification based on available profile data. Record a sample for precise 行当 detection.",
    passaggio_notes: "Record a vocal range sample for precise 换声区 (register transition) detection between 大嗓 and 小嗓.",
    signature_arias: ["《苏三起解》(Su San Qi Jie)", "《空城计》(Kong Cheng Ji)", "《贵妃醉酒》(Gui Fei Zui Jiu)"],
    avoid_arias: [],
    training_focus: "Focus on 气息 (breath support) and smoothing the 换声区 transition between 大嗓 (natural voice) and 小嗓 (falsetto). Practice 咬字 (articulation) to develop authentic 京剧 韵味 (melodic character).",
    next_steps: [
      "Record a vocal range sample (lowest to highest note) for precise 行当 classification.",
      "Practice 发声练习 (vocalization exercises) to develop your 大嗓 or 小嗓 register.",
      "Listen to recordings of your likely 行当 role type to internalize the tonal quality."
    ],
  };
}
