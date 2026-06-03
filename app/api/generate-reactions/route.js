import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 30;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { score, songTitle, artist } = await req.json();

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.9,
      }
    });

    console.log("Generating reactions for score:", score);

    const prompt = `
      You are a knowledgeable, passionate Peking Opera (京剧) audience member seated in a grand 京剧大戏院.
      A singer just performed "${songTitle || "a 唱段 (aria)"}" from ${artist || "a classic Peking Opera"}.
      Their technical score was ${score} out of 100.

      Based on this score, provide a realistic, highly varied Peking Opera audience reaction.
      Use authentic 京剧 audience culture — 叫好 (calling out praise mid-performance), shouts of "好！", "棒！", "妙！", "绝了！", connoisseur appreciation, or polite restraint.
      Do NOT give the same response every time. Be creative and immersive!

      Peking Opera audience guidelines:
      - If score > 90: Thunderous 叫好! The entire house erupts — "好！好！好！" and "妙极了！". Connoisseurs recognize true 韵味 and 神韵. A legendary performance moment.
      - If score > 75: Enthusiastic 叫好 from connoisseurs who appreciate the 行腔, 咬字 precision, and authentic 板眼. "唱得好！" rings out.
      - If score > 60: Warm appreciative applause — the audience recognizes the effort and promise. Respectful nods from the 老戏迷 (veteran fans).
      - If score < 60: Polite, restrained applause — the 京剧 audience is discerning but encouraging; they see potential in the voice.

      Reactions must reflect 京剧 culture: reference the 行腔, 韵味, 咬字, 拖腔, 神韵, role type (旦/生/净), the 二胡 accompaniment, or the aria's dramatic situation.
      Avoid Western opera language. Use the refined vocabulary of a Peking Opera connoisseur.

      Respond ONLY in JSON format with this structure:
      {
        "reactions": ["Short audience shout 1", "Short audience shout 2", "Short audience shout 3"],
        "applauseLevel": "standing_ovation",
        "feedback": "A single warm, natural sentence from a 京剧 connoisseur's perspective about the vocal quality, 韵味, and dramatic character embodiment."
      }

      Valid applauseLevel values: "standing_ovation", "enthusiastic", "moderate", "light".
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return NextResponse.json(JSON.parse(text));
  } catch (error) {
    console.error("Generate reactions error:", error);
    return NextResponse.json({
      reactions: ["好！", "唱得好！", "妙极了！"],
      applauseLevel: "moderate",
      feedback: "京剧大戏院为您的演唱和对这门艺术的投入而喝彩。"
    });
  }
}
