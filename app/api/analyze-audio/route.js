import { NextResponse } from "next/server";
import { analyzePerformanceWithGroq } from "../../../server/groq.js";
import { writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const maxDuration = 60;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio");
    const mode = formData.get("mode") || "chinese_opera";
    const exerciseJson = formData.get("exercise");
    const exercise = exerciseJson ? JSON.parse(exerciseJson) : null;

    if (!audioFile) {
      return NextResponse.json(
        { message: "No audio file provided" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    
    // Save the audio file to public/uploads
    const fileName = `${randomUUID()}.webm`; // Assuming webm from browser
    const filePath = path.join(process.cwd(), "public", "uploads", fileName);
    await writeFile(filePath, buffer);
    const audioUrl = `/uploads/${fileName}`;

    // 1. Call Python backend first to get acoustic metrics
    const pythonResults = await analyzeWithPython(audioFile, mode); //handling python backend for analysing

    // 2. Map Python results to standard metrics object (include all sub-scores for LLM context)
    const metrics = {
      pitchAccuracy: pythonResults.pitch_score,
      toneStability: pythonResults.tsi,
      breathingConsistency: pythonResults.breath_score,
      vibratoScore: pythonResults.vibrato_score,
      expressionScore: pythonResults.expression_score,
      overallScore: pythonResults.overall_score,
      // Additional Peking Opera-specific sub-scores
      trueToneScore: pythonResults.true_tone_score,
      toneBrightness: pythonResults.tone_brightness,
      toneHnr: pythonResults.tone_hnr,
      recordingQuality: pythonResults.recording_quality,
      modeUsed: pythonResults.mode_used || mode,
      ornaments: pythonResults.ornaments,
      ornamentScore: pythonResults.ornament_score,
      emotion: pythonResults.emotion,
      emotionalIntensity: pythonResults.emotional_intensity,
    };

    // 3. Call Groq with the acoustic metrics and exercise context for grounded feedback
    const groqAnalysis = await analyzePerformanceWithGroq(
      buffer,
      metrics,
      exercise,
    ); //handling

    // 4. merging both analysing result and feedback result
    const combinedAnalysis = {
      ...groqAnalysis,
      audioUrl,
      pitchAccuracy: metrics.pitchAccuracy ?? groqAnalysis.pitchAccuracy,
      toneStability: metrics.toneStability ?? groqAnalysis.toneStability,
      breathingConsistency:
        metrics.breathingConsistency ?? groqAnalysis.breathingConsistency,
      overallRating: metrics.overallScore ?? groqAnalysis.overallRating,
      overallScore: metrics.overallScore ?? groqAnalysis.overallScore,
      vibratoScore: metrics.vibratoScore ?? 0,
      expressionScore: metrics.expressionScore ?? 0,
      ornamentScore: metrics.ornamentScore ?? 0,
      generativeFeedback: groqAnalysis.generativeFeedback,
      detectedMistakes: groqAnalysis.detectedMistakes,
      technicalStrengths: groqAnalysis.technicalStrengths,
      // Passaggio Navigator data
      f0Contour: pythonResults.f0_contour || [],
      pitchRange: pythonResults.pitch_range || {},
      ornaments: metrics.ornaments || {},
      emotion: metrics.emotion || "neutral",
      emotionalIntensity: metrics.emotionalIntensity ?? 0,
    };

    return NextResponse.json(combinedAnalysis);
  } catch (error) {
    console.error("Audio analysis API error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to analyze audio" },
      { status: 500 },
    );
  }
}

/**
 * Helper to call the Python FastAPI backend
 */
async function analyzeWithPython(audioFile, mode = "song") {
  try {
    const pyFormData = new FormData();
    // Rename to 'file' to match FastAPI's parameter name
    pyFormData.append("file", audioFile, "audio.wav");

    //main.py
    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";
    const response = await fetch(`${backendUrl}/analyze?mode=${mode}`, {
      method: "POST",
      body: pyFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        `Python backend returned error (${response.status}): ${errorText}`,
      );
      return {};
    }

    return await response.json();
  } catch (err) {
    console.warn(
      "Could not connect to Python backend (localhost:8000). Ensure it is running.",
      err.message,
    );
    return {};
  }
}
