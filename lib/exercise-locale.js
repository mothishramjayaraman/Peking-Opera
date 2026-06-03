// Client-side localization for exercises and phases.
// No DB schema changes needed — all localization is handled here.

// Splits "中文名 (English Name)" → { zh, en }
function parseBilingualName(name) {
  const match = name?.match(/^(.+?)\s*\((.+)\)$/);
  if (match) return { zh: match[1].trim(), en: match[2].trim() };
  return { zh: name, en: name };
}

// ─── Exercise descriptions ────────────────────────────────────────────────────

const EN_DESCRIPTIONS = {
  // Phase 1
  "Dantian Breath Foundation": "Establish abdominal breath support — the core energy center for all Peking Opera vocalization",
  "Consonant Attack & Vowel Resolution": "Master the two-stage articulation of Peking Opera: clear consonant attack followed by resonant vowel resolution",
  "Dan Role Voice Introduction": "Discover the distinctive female-role voice — a stylized, forward-placed falsetto that blends chest and head resonance",
  "Sheng Role Voice Introduction": "Explore the male-hero role voice — a resonant, dignified, chest-dominant tone with controlled head voice mixing",
  "Stylized Recitative": "Learn heightened speech-song — the melodic recitative Peking Opera actors use for dramatic declamation between sung passages",
  "Pentatonic Scale Vocalization": "Build your voice on the pentatonic scale — the fundamental tonal system of all Chinese opera music",
  "Melismatic Extension Introduction": "Begin developing melismatic extension — the art of stretching a single syllable through an elaborate melodic phrase",
  "Text Rhythm Training": "Develop the rhythmic clarity of text delivery — the precise, rhythmically charged speech that drives Peking Opera drama",
  // Phase 2
  "Erhuang Manban Phrasing": "Navigate the slow, majestic Erhuang slow-tempo form — the most expressive section in Peking Opera, requiring long breath and sustained phrasing",
  "Xipi Melodic Training": "Master Xipi — the brighter, more energetic melodic system of Peking Opera, contrasting with the deeper Erhuang",
  "Hua Qiang Ornamentation": "Develop melodic ornamentation — the cascading decorations that embellish Peking Opera phrases with drama and virtuosity",
  "Dan Role Falsetto Refinement": "Refine the stylized female-role falsetto — developing a smooth, resonant, controlled head voice for dramatic phrases",
  "Jing Role Power Voice": "Explore the painted-face role voice — a large, resonant, chest-dominant sound with strong projection and dramatic weight",
  "Kuaiban Articulation Speed": "Develop the precision and speed needed for rapid-tempo sections where articulation and pitch must remain perfectly clear",
  "Dramatic Inner Monologue": "Connect vocal technique to dramatic character — every phrase must be driven by the character's inner emotional state",
  "Tone-Melody Alignment": "Train the critical skill of aligning Mandarin tonal language with Peking Opera melody — the unique challenge of Chinese operatic composition",
  // Phase 3
  "Full Aria Phrase Performance": "Apply all Peking Opera techniques to a complete aria phrase — uniting breath, articulation, melisma, phrasing, and dramatic expression",
  "Erhuang Yuanban Full Performance": "Perform a complete Erhuang medium-tempo section — the foundational form used in the most expressive moments of classic Peking Opera",
  "Xipi Kuaiban Continuity": "Perform an extended Xipi rapid-tempo section with unbroken articulation, accurate pitch, and sustained energy",
  "Stylized Gesture + Voice Integration": "Integrate Peking Opera stylized body movement with vocal performance — the defining unity of Jingju artistry",
  "Jingju Stage Simulation": "Simulate a Peking Opera stage performance — entrance, aria, and exit — with full character commitment and audience awareness",
  "Erhu Ensemble Coordination": "Train your voice to blend with and follow the erhu — the primary accompanying instrument of Peking Opera",
  "Character Spirit & Presence": "Embody a Peking Opera character completely — developing the spirit and presence that separates great performers from technical ones",
  "Competition-Level Full Performance": "Deliver a competition-ready Peking Opera performance — all technique, all drama, all character presence at peak level simultaneously",
};

const ZH_DESCRIPTIONS = {
  // Phase 1
  "丹田气息基础": "建立丹田腹式呼吸支撑——所有京剧发声的核心气息中心",
  "咬字归韵": "掌握京剧两段式吐字法：清晰的声母咬字，接以共鸣的韵母归韵",
  "旦角嗓音入门": "探索旦角嗓音——前置假声与真声混合的程式化唱腔风格",
  "生角嗓音入门": "探索生角嗓音——共鸣饱满、沉稳大气的以胸腔为主的音色",
  "韵白吟诵": "学习韵白——京剧演员在唱段之间进行戏剧性念诵的程式化歌唱性念白",
  "五声音阶发声": "在五声音阶（五声调式）上磨练嗓音——中国戏曲音乐的基础调式体系",
  "拖腔技法入门": "开始学习拖腔——将单个字扩展为精妙旋律短句的艺术，是京剧最具表现力的技法之一",
  "念字节奏训练": "培养念字的节奏清晰度——推动京剧戏剧张力的精准而富有节奏感的文字传递方式",
  // Phase 2
  "二黄慢板行腔": "驾驭舒缓宏大的二黄慢板——京剧中最具表现力的慢板段落，要求悠长的气息与持续的行腔",
  "西皮唱腔训练": "掌握西皮——京剧中更为明亮激昂的板式体系，与深沉的二黄形成对比",
  "花腔装饰技法": "发展花腔装饰技法——为京剧唱段增添戏剧性与华彩的连串旋律装饰",
  "旦角假声精进": "精进程式化旦角假声——培养流畅共鸣的头腔音色，以支撑大段戏剧性唱腔",
  "净角铜锤唱法": "探索净角（花脸）嗓音——洪亮共鸣、以胸腔为主的音色，具有强大穿透力和戏剧分量",
  "快板节奏与咬字": "培养快板所需的精准与速度——在极快节奏下保持吐字清晰与音准准确",
  "戏剧内心独白": "将声乐技巧与戏剧人物相连——每一句唱腔都必须由人物内心的情感状态驱动",
  "声调配合训练": "训练普通话声调与京剧旋律相互配合的关键技巧——这是京剧作曲的独特挑战",
  // Phase 3
  "完整唱段句演绎": "将全部京剧技法融入完整唱段短句——丹田气息、咬字、拖腔、行腔与戏剧表现融为一体",
  "二黄原板完整演唱": "完整演绎一段二黄原板——经典京剧最动人心弦时刻所使用的中速二黄基本板式",
  "西皮快板连贯训练": "完整演绎延续性的西皮快板段落——全程保持吐字清晰、音准准确与精神饱满",
  "形体与唱腔融合": "将京剧程式化形体动作（身段）与声乐演唱融为一体——这是京剧艺术的核心统一性",
  "京剧舞台亮相": "模拟京剧舞台演出——上场、唱段与退场——全程投入人物塑造，保持与观众的交流",
  "二胡伴奏协调": "训练嗓音与二胡融合配合——二胡是京剧的主要伴奏乐器",
  "角色神韵塑造": "完整塑造京剧人物神韵——培养将优秀演员与单纯技术表演者区别开来的神韵气质",
  "竞技级综合演绎": "呈现比赛水准的京剧演出——在巅峰状态下同时展现全部技法、戏剧张力与人物神韵",
};

/**
 * Returns a localized copy of an exercise object.
 * Both name and description are single-language — no bilingual mixing.
 */
export function localizeExercise(exercise, lang) {
  if (!exercise) return exercise;
  const { zh, en } = parseBilingualName(exercise.name);
  return {
    ...exercise,
    name: lang === "zh" ? zh : en,
    description:
      lang === "zh"
        ? ZH_DESCRIPTIONS[zh] || exercise.description
        : EN_DESCRIPTIONS[en] || exercise.description,
  };
}

// ─── Phase localization ───────────────────────────────────────────────────────

const PHASE_LOCALE = {
  1: {
    nameZh: "基础功",
    nameEn: "Jingju Foundation",
    descriptionEn: "Build authentic Peking Opera vocal foundations: abdominal breath support, articulation, pentatonic pitch, and female/male role voice introduction",
    descriptionZh: "建立正宗的京剧声乐基础：丹田气息、咬字归韵、五声音调与旦角/生角嗓音入门",
    featuresEn: [
      "Abdominal breath support training",
      "Consonant attack and vowel resolution drills",
      "Pentatonic scale vocalization",
      "Female and male role voice introduction",
      "Heightened speech and melisma basics",
    ],
    featuresZh: [
      "丹田气息支撑训练",
      "咬字归韵吐字练习",
      "五声音阶发声",
      "旦角和生角嗓音入门",
      "韵白吟诵与拖腔基础",
    ],
    unlockCriteriaEn: "Start your Jingju journey",
    unlockCriteriaZh: "开始您的京剧之旅",
  },
  2: {
    nameZh: "行腔技法",
    nameEn: "Phrasing & Technique",
    descriptionEn: "Develop advanced melodic phrasing, Erhuang and Xipi melodic systems, ornamentation, and dramatic character expression",
    descriptionZh: "深化行腔技法，掌握二黄/西皮板式体系、花腔装饰与戏剧人物表达",
    featuresEn: [
      "Classic aria recommendations",
      "Erhuang and Xipi melodic systems",
      "Ornamentation and rapid-tempo speed",
      "Dramatic inner monologue",
      "Tone-melody alignment training",
    ],
    featuresZh: [
      "经典唱段推荐",
      "二黄与西皮板式体系",
      "花腔装饰与快板速度",
      "戏剧内心独白",
      "声调配合训练",
    ],
    unlockCriteriaEn: "Complete Phase 1 and pass Phase Test",
    unlockCriteriaZh: "完成第1阶段并通过阶段测试",
  },
  3: {
    nameZh: "舞台演绎",
    nameEn: "Stage Performance",
    descriptionEn: "Master opera house stage presence, entrance poses, erhu ensemble awareness, and full character embodiment",
    descriptionZh: "掌握京剧大戏院舞台气场、亮相上场、二胡合奏意识与神韵人物塑造",
    featuresEn: [
      "Virtual opera house simulator",
      "Audience reactions and applause",
      "Stylized gesture and voice integration",
      "Erhu ensemble coordination",
      "Competition-level performance analysis",
    ],
    featuresZh: [
      "虚拟京剧大戏院模拟",
      "叫好观众互动",
      "身段形体与唱腔融合",
      "二胡合奏协调",
      "竞技级演出分析",
    ],
    unlockCriteriaEn: "Complete Phase 2 and pass Phase Test",
    unlockCriteriaZh: "完成第2阶段并通过阶段测试",
  },
};

/**
 * Returns localized phase display data (name, description, features, unlockCriteria).
 * Both languages are fully single-language — no bilingual mixing.
 */
export function localizePhase(phase, lang) {
  if (!phase) return phase;
  const loc = PHASE_LOCALE[phase.id];
  if (!loc) return phase;
  return {
    ...phase,
    name: lang === "zh" ? loc.nameZh : loc.nameEn,
    description: lang === "zh" ? loc.descriptionZh : loc.descriptionEn,
    features: lang === "zh" ? loc.featuresZh : loc.featuresEn,
    unlockCriteria: lang === "zh" ? loc.unlockCriteriaZh : loc.unlockCriteriaEn,
  };
}
