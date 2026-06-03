// 1.audio → transcription
// 2.transcription + metrics → LLM analysis
// 3.validation layer
// 4.fallback system

import Groq from "groq-sdk";
import dotenv from "dotenv";

import { File } from "buffer";

dotenv.config();

// Create Groq client if API key exists
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 30000 })
  : null;

// Main vocal analysis function
export async function analyzePerformanceWithGroq(
  audioBuffer,
  metrics = {},
  exercise = null,
) {
  // Use fallback if Groq is unavailable
  if (!groq) {
    console.warn("Groq API key not configured, using fallback analysis");
    return fallbackAnalysis(audioBuffer.length, null, metrics, exercise);
  }

  try {
    // Convert audio buffer into uploadable file
    const file = new File([audioBuffer], "audio.webm", {
      type: "audio/webm",
    });

    let text = "";
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

    if (audioBuffer.length > MAX_FILE_SIZE) {
      console.warn("Audio file too large for Groq transcription (>25MB). Skipping transcription.");
      text = "[Audio file too large for transcription. Analyze based on metrics only.]";
    } else {
      // Convert speech/audio into text
      const transcription = await groq.audio.transcriptions.create({
        file,
        model: "whisper-large-v3",
        response_format: "json",
      });
      text = transcription.text;
    }

    // Handle missing or unclear vocals without short-circuiting so LLM still analyzes metrics
    if (!text || text.trim().length < 3) {
      text = "[No lyrics detected — analyze purely based on the acoustic metrics below, treating this as a vocalization or breath exercise.]";
    }

    // Build metrics context for AI prompt
    const fmt = (v) => (v !== undefined && v !== null ? Math.round(v) : "N/A");
    const metricsContext =
      Object.keys(metrics).length > 0
        ? `Acoustic diagnostics from DSP analysis (scores 0–100):
- Pitch Accuracy (pentatonic intonation + stability): ${fmt(metrics.pitchAccuracy)}
- Tone Stability Index (TSI): ${fmt(metrics.toneStability)}
- True Tone Score (timbre quality): ${fmt(metrics.trueToneScore ?? metrics.toneStability)}
- Tone Brightness (spectral presence): ${fmt(metrics.toneBrightness)}
- HNR — Harmonic-to-Noise Ratio (voice cleanliness): ${fmt(metrics.toneHnr)}
- Breath Score (quietness + consistency + efficiency): ${fmt(metrics.breathingConsistency)}
- Vibrato Score (rate 5–9 Hz, restrained extent ≤30 cents): ${fmt(metrics.vibratoScore)}
- 韵味 Expression Score (timbral richness + phrase arc + dynamics): ${fmt(metrics.expressionScore)}
- Emotion Detected: ${metrics.emotion || "neutral"} (Intensity: ${fmt(metrics.emotionalIntensity)}%)
- Vocal Ornaments (装饰音) Detected: ${metrics.ornaments && metrics.ornaments.ornament_types && Object.keys(metrics.ornaments.ornament_types).length > 0 ? Object.entries(metrics.ornaments.ornament_types).map(([k,v]) => `${k}: ${v}`).join(", ") : "None"}
- Overall Score: ${fmt(metrics.overallScore)}
- Recording Quality (0–1): ${metrics.recordingQuality !== undefined ? metrics.recordingQuality : "N/A"}${metrics.recordingQuality !== undefined && metrics.recordingQuality < 0.4 ? "\n  ⚠ Low recording quality — note this may reduce accuracy of acoustic scores." : ""}`
        : "No direct acoustic metrics provided. Analyze based on transcription only.";

    // Build exercise-specific context
    const exerciseContext = exercise
      ? `Exercise Being Practiced:
- Name: ${exercise.name}
- Description: ${exercise.description}
- Category: ${exercise.category}
- Difficulty: ${exercise.difficulty || "Unknown"}
- Target Focus Areas: ${(exercise.targetMetrics || []).map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(", ") || "General"}
- Instructions Given to Singer: ${exercise.instructions}

Your feedback MUST be specifically about how well the singer performed this exercise. Judge their performance against the exercise goals and focus especially on the target areas listed above.`
      : "";

    // Request coaching analysis from LLM
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1200, // Increased max tokens to allow for more detailed feedback

      // Conversation messages sent to AI
      messages: [
        // AI behavior instructions
        {
          role: "system",
          content: `You are a master Peking Opera (京剧 Jīngjù) vocal coach with deep expertise in both classical 京剧 technique and modern acoustic pedagogy. Your ONLY job is to interpret the provided DSP acoustic scores and transcription to give precise, actionable, and HIGHLY PERSONALIZED Peking Opera coaching. DO NOT invent or modify numerical scores. NEVER give generic advice. Tailor every single sentence directly to the exact numbers provided.

Voice roles (行当) — use these to contextualize feedback:
- 旦角 (Dànjué): bright falsetto/mixed voice, high nasal-forward placement, high Tone Brightness expected
- 生角 (Shēngjué): clear natural voice with head resonance, balanced brightness
- 净角 (Jìng/花脸): full powerful chest resonance, lower brightness acceptable, strong HNR required
- 丑角 (Chǒujué): nimble, flexible, conversational character

Core 京剧 vocal techniques to assess from scores and transcription:
- 气息/Qìxī: dantian breath support — low Breath Score means poor qi control
- 咬字/Yǎozì: crisp character articulation — affects both pitch accuracy (tonal language) and expression
- 归韵/Guīyùn: precise vowel resolution at phrase ends
- 拖腔/Tuōqiāng: sustained melismatic phrase extensions — require stable TSI and breath
- 韵味/Yùnwèi: aesthetic flavor — captured by Expression Score (timbral richness + phrase arc)

Score interpretation guide:
- Pitch Accuracy < 60: intonation drifting off pentatonic (宫商角徵羽), address tonal language alignment
- TSI < 60: unstable tone on sustained notes, reinforce 气息 support
- HNR < 50: breathy or raspy tone, work on glottal closure and resonance placement
- Tone Brightness: context-dependent — 旦角 should be high (>60), 净角 naturally lower
- Breath Score < 60: breaths are audible, irregular, or too frequent — address 丹田 breathing
- Vibrato Score < 40: either missing vibrato or excessive Western-style wobble (>30 cents)
- Expression Score < 50: flat delivery lacking 韵味, needs dramatic phrase shaping

CRITICAL REQUIREMENT: Your feedback MUST be uniquely generated for these specific metrics. DO NOT use generic phrases like "Focus on dantian qi breathing" unless explicitly supported by a low breath score. Look at the absolute lowest score and make that the primary "detectedMistake".

BEGINNER GUIDANCE RULE: Beginners often do not know *how* to execute a technique. If the exercise difficulty is "easy" OR if their lowest score is < 60, your "suggestions" MUST be extremely comprehensive, specific, and detailed. Break down the physical mechanics step-by-step. Instead of "Improve breath support," explain exactly what to do physically (e.g., "Place your hand on your lower stomach (丹田). As you inhale, feel your stomach push your hand outward. Keep this expansion firm while you sing the phrase."). Be a patient, highly descriptive teacher.

Respond ONLY with valid JSON containing exactly these four keys:
"suggestions" (array of 2–4 highly specific, comprehensive, step-by-step physical coaching tips based on the exact scores),
"detectedMistakes" (array of 1–3 specific technical flaws. You MUST identify at least one area for refinement based on their lowest score, even if overall performance is good. DO NOT return an empty array.),
"technicalStrengths" (array of 1–3 genuine strengths observed from their highest scores),
"generativeFeedback" (one warm, holistic coaching paragraph 3–5 sentences mentioning the singer's highest and lowest metrics in a supportive way).`,
        },

        // User performance data
        {
          role: "user",
          content: `${exerciseContext ? exerciseContext + "\n\n" : ""}${metricsContext}\n\nTranscription:\n"${text}"`,
        },
      ],

      // Force JSON output
      response_format: { type: "json_object" },
    });

    // Extract AI response content
    const content = completion.choices[0]?.message?.content;

    // Handle empty AI response
    if (!content) throw new Error("No analysis received");

    let analysis;

    // Safely parse AI JSON
    try {
      analysis = JSON.parse(content);
    } catch {
      throw new Error("Invalid JSON from AI");
    }

    // Extract scores STRICTLY from provided DSP metrics — use ?? to preserve genuine 0 values
    const pitchAccuracy = metrics.pitchAccuracy ?? 0;
    const toneStability = metrics.toneStability ?? 0;
    const breathingConsistency = metrics.breathingConsistency ?? 0;
    const vibratoScore = metrics.vibratoScore ?? 0;
    const expressionScore = metrics.expressionScore ?? 0;
    const ornamentScore = metrics.ornamentScore ?? 0;
    const overallScore =
      metrics.overallScore ??
      Math.round((pitchAccuracy + toneStability + breathingConsistency + vibratoScore + expressionScore + ornamentScore) / 6);

    // Use the exact arrays generated by the LLM without injecting standardized fallbacks
    const suggestions = Array.isArray(analysis.suggestions) ? analysis.suggestions : [];
    const detectedMistakes = Array.isArray(analysis.detectedMistakes) ? analysis.detectedMistakes : [];
    const technicalStrengths = Array.isArray(analysis.technicalStrengths) ? analysis.technicalStrengths : [];

    // Return final cleaned analysis
    return {
      pitchAccuracy,
      toneStability,
      breathingConsistency,
      suggestions,
      detectedMistakes,
      technicalStrengths,

      // Final AI coaching paragraph
      generativeFeedback:
        analysis.generativeFeedback ||
        "Your performance has been recorded. Continue developing your 气息 (qìxī) support, 咬字 (yǎozì) clarity, and the 韵味 (yùnwèi) that gives Peking Opera its unique artistic soul.",

      overallRating: overallScore,
      overallScore,

      // Original transcription
      transcription: text,
    };
  } catch (error) {
    // Handle AI/API failures
    console.error("Groq analysis failed:", error.message);

    // Use backup analysis
    return fallbackAnalysis(
      audioBuffer.length,
      error.message,
      metrics,
      exercise,
    );
  }
}

// Backup analysis function
function fallbackAnalysis(audioLength, message, metrics = {}, exercise = null) {
  // Detect recordings that are too short
  if (audioLength < 10000) {
    return {
      pitchAccuracy: metrics.pitchAccuracy ?? 0,
      toneStability: metrics.toneStability ?? 0,
      breathingConsistency: metrics.breathingConsistency ?? 0,
      suggestions: [
        "Recording is too short — sing at least one full 唱句 (phrase).",
        "Try singing louder and closer to the microphone.",
        message || "Not enough data to analyze.",
      ],
      overallRating: metrics.overallScore ?? 0,
      overallScore: metrics.overallScore ?? 0,
      transcription: "",
    };
  }

  // Use strictly provided DSP metrics — ?? preserves genuine 0 values
  const pitch = metrics.pitchAccuracy ?? 0;
  const tone = metrics.toneStability ?? 0;
  const breath = metrics.breathingConsistency ?? 0;
  const vibrato = metrics.vibratoScore ?? 0;
  const expression = metrics.expressionScore ?? 0;
  const ornament = metrics.ornamentScore ?? 0;
  const overall =
    metrics.overallScore ?? Math.round((pitch + tone + breath + vibrato + expression + ornament) / 6);

  // Exercise-specific fallback suggestions
  const exerciseSuggestions = exercise
    ? [
        `Focus on the core goal: ${exercise.description}`,
        `Review the exercise steps: ${exercise.instructions.split("\n")[0]}`,
        `Target areas for this exercise: ${(exercise.targetMetrics || []).join(", ")}`,
      ]
    : // Generic Peking Opera fallback suggestions
      [
        "Focus on dantian (丹田) qi breathing — feel the breath originate from your lower abdomen.",
        "Practice 咬字 (yǎozì) — each Chinese character needs a clear consonant attack and precise vowel resolution (归韵).",
        "Cultivate 韵味 (yùnwèi) — sing with the spirit and character of the role, not just the notes.",
      ];

  // Return fallback result
  return {
    pitchAccuracy: pitch,
    toneStability: tone,
    breathingConsistency: breath,
    suggestions: exerciseSuggestions,
    overallRating: overall,
    overallScore: overall,

    // Simple fallback transcription
    transcription: audioLength > 1000 ? "Vocal performance recorded." : "",
  };
}
