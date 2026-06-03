export async function analyzeVoice(audioBlob, mode = "chinese_opera", exercise = null) {
  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.wav");
  formData.append("mode", mode);
  if (exercise) {
    formData.append("exercise", JSON.stringify(exercise));
  }

  const response = await fetch("/api/analyze-audio", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Voice analysis failed");
  }

  const data = await response.json();

  return {
    userId: "",
    pitchAccuracy: data.pitchAccuracy,
    toneStability: data.toneStability,
    breathingConsistency: data.breathingConsistency,
    vibratoScore: data.vibratoScore,
    expressionScore: data.expressionScore,
    ornamentScore: data.ornamentScore || 0,
    overallRating: data.overallRating ?? data.overallScore ?? 0,
    suggestions: data.suggestions || [],
    technicalStrengths: data.technicalStrengths || [],
    detectedMistakes: data.detectedMistakes || [],
    generativeFeedback: data.generativeFeedback,
    analyzedAt: new Date().toISOString(),
    f0Contour: data.f0Contour || [],
    pitchRange: data.pitchRange || {},
  };
}




export function generateExercises(phase, difficulty, count) {
  const exerciseTemplates = {
    1: [
      {
        name: "开嗓热身 (Opening the Voice)",
        description: "Gentle glide through your range to warm the vocal folds before 京剧 practice",
        category: "warmup",
        difficulty: "easy",
        durationMinutes: 3,
        instructions:
          "Hum on ‘嗯’ from your lowest comfortable pitch, glide upward to mid-range and back. Keep the jaw loose and the throat open. Repeat three times, raising the starting pitch slightly each round.",
      },
      {
        name: "丹田呼吸 (Dantian Breath)",
        description: "Establish 气息 breath support from the lower abdomen — the foundation of all 京剧 singing",
        category: "warmup",
        difficulty: "easy",
        durationMinutes: 4,
        instructions:
          "Stand tall. Place one hand on your lower abdomen (丹田). Inhale slowly for 4 counts — feel the belly expand outward, not the chest. Exhale on a steady ‘sss’ for 8 counts, keeping the belly firm. Repeat 6 times.",
      },
      {
        name: "五声音阶 (Pentatonic Scale)",
        description: "Train your ear and voice on the 宫商角徵羽 pentatonic scale — the melodic backbone of 京剧",
        category: "technique",
        difficulty: "easy",
        durationMinutes: 5,
        instructions:
          "Sing up and down the pentatonic scale (do–re–mi–sol–la–do) on the syllable ‘啊’. Keep each note clean and centered. Transpose up by a semitone each round. Listen for pure intonation — no wavering between scale degrees.",
      },
      {
        name: "咬字归韵 (Consonant Attack & Vowel Resolution)",
        description: "Practice crisp 咬字 onset and smooth 归韵 vowel resolution — the core of 京剧 diction",
        category: "technique",
        difficulty: "medium",
        durationMinutes: 4,
        instructions:
          "Choose a simple character, e.g. ‘花’. Attack the initial consonant ‘h’ cleanly, open fully on ‘ua’, then resolve the vowel tail gently. Repeat on ‘天’, ‘江’, ‘月’, ‘春’. Each character should feel like a small musical gesture with a clear start and landing.",
      },
      {
        name: "韵白基础 (Heightened Speech Recitative)",
        description: "Introduce 韵白 — the elevated, rhythmically controlled speech style used between sung phrases",
        category: "technique",
        difficulty: "medium",
        durationMinutes: 5,
        instructions:
          "Speak the phrase ‘我本是卧龙岗散淡的人’ in your natural voice. Now say it again with deliberate pitch contour: rise on stressed characters, pause on 板 beats. Finally, add resonance — let the voice ring forward, not back in the throat.",
      },
    ],
    2: [
      {
        name: "行腔练习 (Melodic Phrasing)",
        description: "Shape a 京剧 melodic phrase with deliberate 行腔 — the art of guiding tone through a melodic arc",
        category: "technique",
        difficulty: "medium",
        durationMinutes: 5,
        instructions:
          "Take a short 二黄 phrase. Sing it straight first, then add: a gentle lean into the peak note, a slight swell before the cadence, and a tapered resolution. The phrase should breathe and move — not march note-to-note. Breath (气息) drives the arc.",
      },
      {
        name: "拖腔扩展 (Melismatic Extension)",
        description: "Extend a single syllable across a flowing melismatic run — the 拖腔 technique central to 京剧 arias",
        category: "technique",
        difficulty: "hard",
        durationMinutes: 6,
        instructions:
          "Hold the syllable ‘啊’ and slowly ornament it: start on the root note, glide up a 3rd, circle back through neighbor tones, and resolve downward. The run should feel like calligraphy — continuous ink, not separate dots. Use 丹田 support throughout; do not push from the throat.",
      },
      {
        name: "二黄慢板节奏 (Erhuang Slow Tempo Meter)",
        description: "Internalize the 慢板 (slow meter) of 二黄 — the stately, deep melodic system of 京剧",
        category: "technique",
        difficulty: "medium",
        durationMinutes: 7,
        instructions:
          "Tap a slow 板眼 (strong-weak-weak) pattern: 板 on beat 1, 眼 on beats 2–3. Sing a simple 二黄 phrase aligned to this meter. The key discipline: resist rushing — each 板 beat is a weight you must ‘land’ on. Repeat until the meter feels inevitable, not counted.",
      },
      {
        name: "花腔装饰音 (Ornamental 花腔)",
        description: "Add 花腔 grace notes and glides — the ornamental layer that gives 京剧 its characteristic expressive color",
        category: "technique",
        difficulty: "hard",
        durationMinutes: 5,
        instructions:
          "Take a sustained phrase. Add: (1) a fall from the peak note, (2) a quick upper neighbor grace note before a landing tone, (3) a 滑音 (portamento) connecting two distant notes. Each ornament must serve the drama — not decorate for its own sake.",
      },
    ],
    3: [
      {
        name: "舞台神韵 (Stage Presence)",
        description: "Integrate 神韵 (spirit-presence) — the quality that makes a 京剧 performance transcend technical correctness",
        category: "performance",
        difficulty: "medium",
        durationMinutes: 8,
        instructions:
          "Perform a phrase in front of a mirror. First: technically correct but neutral. Second: embody the character — adjust posture, eye focus, inner intention. Note how the voice naturally changes when you inhabit the role. 神韵 is not added on top; it comes from within.",
      },
      {
        name: "全段演唱 (Full Aria Run-Through)",
        description: "Perform a complete 唱段 from 开嗓 warm-up through final note without stopping",
        category: "performance",
        difficulty: "hard",
        durationMinutes: 10,
        instructions:
          "Warm up for 3 minutes. Then perform your chosen 唱段 in full, in character, at performance tempo. Do not stop for errors — recover within the phrase as a professional would. After: note where the breath ran short, where the 行腔 lost shape, and what felt strong.",
      },
      {
        name: "叫好互动 (Audience 叫好 Simulation)",
        description: "Train your focus and recovery when a 戏迷 (opera fan) shouts ‘好！’ mid-phrase",
        category: "performance",
        difficulty: "medium",
        durationMinutes: 6,
        instructions:
          "Have a partner (or use a recording) inject a ‘好！’ shout at random moments during your performance. Your task: hold the phrase to its natural end, absorb the praise, then continue. In 京剧, a performer who rushes after a 叫好 breaks the spell — stillness after applause is mastery.",
      },
      {
        name: "行当转换 (Role-Type Character Switch)",
        description: "Shift vocal color and posture between 旦角, 生角, and 净角 role types on the same phrase",
        category: "performance",
        difficulty: "hard",
        durationMinutes: 5,
        instructions:
          "Take the phrase ‘天下英雄谁敌手’. Sing it first as 老生 (deep, settled, authoritative). Then as 旦角 (bright, forward, elevated placement). Then as 净角 (full, resonant, powerful). Each role requires a distinct physical and vocal posture — not just tone color. Feel the difference in where the voice sits in your body.",
      },
    ],
  };

  const templates = exerciseTemplates[phase] || exerciseTemplates[1];

  const filtered = difficulty
    ? templates.filter(e => e.difficulty === difficulty)
    : templates;

  return filtered.slice(0, count);
}

export function recommendSongs(vocalRange, genre, difficulty) {
  const songs = [
    { title: "苏三起解", artist: "京剧传统折子戏", genre: "京剧", difficulty: "medium", vocalRange: "旦角" },
    { title: "霸王别姬·君王意气尽", artist: "京剧传统剧目", genre: "京剧", difficulty: "hard", vocalRange: "旦角" },
    { title: "锁麟囊·春秋亭外", artist: "程派名剧", genre: "京剧", difficulty: "hard", vocalRange: "旦角" },
    { title: "梨花颂", artist: "新编京剧《大唐贵妃》", genre: "京剧", difficulty: "medium", vocalRange: "旦角" },
    { title: "文昭关·一轮明月", artist: "京剧传统剧目", genre: "京剧", difficulty: "medium", vocalRange: "老生" },
    { title: "空城计·我本是卧龙岗", artist: "京剧传统剧目", genre: "京剧", difficulty: "hard", vocalRange: "老生" },
    { title: "四郎探母·杨延辉坐宫院", artist: "京剧传统剧目", genre: "京剧", difficulty: "medium", vocalRange: "生角" },
    { title: "智取威虎山·打虎上山", artist: "革命现代京剧", genre: "京剧", difficulty: "medium", vocalRange: "生角" },
  ];

  return songs
    .filter(song => {
      const matchRange =
        !vocalRange ||
        song.vocalRange.toLowerCase() === vocalRange.toLowerCase();

      const matchGenre =
        !genre ||
        song.genre.toLowerCase() === genre.toLowerCase();

      const matchDifficulty =
        !difficulty ||
        song.difficulty === difficulty;

      return matchRange && matchGenre && matchDifficulty;
    })
    .slice(0, 6);
}

/**
 * 🎼 Generate a simple backing track description
 */
export function generateBackingTrack(genre, bpm, key) {
  const descriptions = {
    "京剧": "二胡领奏，文武场伴奏 — 二黄/西皮板式配合演唱",
    "erhuang": "二黄慢板伴奏 — 二胡、月琴、三弦，沉稳深远",
    "xipi": "西皮原板伴奏 — 节奏明快，二胡高音清亮",
  };

  return {
    trackName: `${genre} 伴奏`,
    genre,
    bpm,
    key,
    duration: 180,
    description:
      descriptions[genre.toLowerCase()] ||
      "京剧文武场伴奏 — 二胡、月琴、三弦、鼓板",
  };
}

/**
 * 👏 Generate audience reaction based on score using AI
 */
export async function generateAudienceReactions(score, songTitle = "", artist = "") {
  try {
    const response = await fetch("/api/generate-reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, songTitle, artist }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate reactions");
    }

    return await response.json();
  } catch (error) {
    console.error("AI Reaction error:", error);
    // Fallback to static logic with random variance
    const rand = Math.random();
    if (score >= 90) {
      return {
        reactions: rand > 0.5 ? ["好！", "唱得好！", "妙极了！"] : ["真是好嗓子！", "韵味十足！", "叫绝！"],
        applauseLevel: "standing_ovation",
        feedback: rand > 0.5 ? "全场起立喝彩——您的演唱韵味醇厚，行腔大气，令人叫绝！" : "戏迷们的叫好声此起彼伏，您的神韵与技法均达到极高水准。",
      };
    }
    if (score >= 75) {
      return {
        reactions: rand > 0.5 ? ["好！", "唱得不错！"] : ["有韵味！", "接着唱！"],
        applauseLevel: "enthusiastic",
        feedback: rand > 0.5 ? "观众热情鼓掌——行腔流畅，气息稳健，再加磨练必成大器。" : "戏院里掌声热烈，您的咬字清晰，韵味初现。",
      };
    }
    return {
      reactions: rand > 0.5 ? ["不错！", "加油！"] : ["再接再厉！", "功夫到家了！"],
      applauseLevel: rand > 0.5 ? "light" : "moderate",
      feedback: rand > 0.5 ? "观众为您的投入而鼓掌——继续勤加练习，丹田气息是关键。" : "剧院为您的努力喝彩。坚持练习咬字归韵，您会越来越好。",
    };
  }
}
