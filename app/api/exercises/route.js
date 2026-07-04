import { verifySession } from "../../../server/session.js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../server/storage.js";

const EXERCISE_METRICS = {
  // Phase 1
  "Lip Trill Warm-Up": ["pitch", "tone"],
  "Humming Scale": ["pitch"],
  "Breath Support Basics": ["breathing"],
  "Vowel Clarification": ["tone"],
  "Siren Slide": ["pitch", "tone"],
  "Tongue Twister Warmup": ["tone"],
  "Chest Voice Explorer": ["tone"],
  "Jaw Relaxation": ["tone"],
  "Basic Microphone Stance": ["expression"],
  "First Melody Line": ["pitch", "tone"],
  "Breath Pressure Control": ["breathing", "tone"],
  "Intense Vocal Staccato": ["pitch", "breathing"],
  "Resonance Focus Drill": ["tone"],
  // Phase 2
  "Chest Voice vs Head Voice": ["pitch", "tone"],
  "Dynamics Control": ["tone", "breathing"],
  "Emotional Expression": ["expression"],
  "Style Exploration": ["tone", "expression"],
  "Nasal Resonance Drill": ["tone"],
  "Vocal Fry Transition": ["tone", "breathing"],
  "Agility Scales": ["pitch"],
  "Vibrato Development": ["vibrato"],
  "Mixed Voice Prep": ["pitch", "tone"],
  "Mixed Voice Discovery": ["pitch", "tone"],
  "Lyric Interpretation": ["expression"],
  "Dynamic Shifts in Song": ["tone", "expression"],
  // Phase 3
  "Stage Presence": ["expression"],
  "Performance Run-Through": ["pitch", "tone", "breathing", "vibrato", "expression"],
  "Microphone Technique": ["tone", "breathing"],
  "Recovery Techniques": ["expression"],
  "Virtual Audience Interaction": ["expression"],
  "Stage Movement Drills": ["breathing", "expression"],
  "Stress Response Mastery": ["breathing", "expression"],
  "Multi-Style Medley": ["pitch", "tone", "expression"],
  "Belt Technique Basics": ["tone", "breathing"],
  "Subtle Vocal Runs": ["pitch", "vibrato"],
  "In-Ear Monitor Simulation": ["pitch", "tone"],
  "Vibrato Control": ["vibrato"],
  "Intervals & Accuracy": ["pitch"],
  "Phrasing Logic": ["breathing", "expression"],
};

const CATEGORY_DEFAULTS = {
  warmup: ["pitch", "tone"],
  technique: ["pitch", "tone"],
  performance: ["expression"],
};

function withTargetMetrics(exercise) {
  if (exercise.targetMetrics && exercise.targetMetrics.length > 0) {
    return exercise;
  }
  const metrics =
    EXERCISE_METRICS[exercise.name] ||
    CATEGORY_DEFAULTS[exercise.category] ||
    ["pitch", "tone"];
  return { ...exercise, targetMetrics: metrics };
}

export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const userId = verifySession(cookieStore.get("userId")?.value);

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const phaseParam = searchParams.get('phase');

    const user = await storage.getUser(userId);
    const exercises = await storage.getExercises();
    const progress = user ? await storage.getExerciseProgress(user.id) : [];

    const completedIds = progress
      .filter((p) => p.completed)
      .map((p) => p.exerciseId);

    const targetPhase = phaseParam ? parseInt(phaseParam) : (user?.currentPhase || 1);

    const scores = {};
    progress.forEach((p) => {
      if (p.overallScore !== null && p.overallScore !== undefined) {
        if (!scores[p.exerciseId] || p.overallScore > scores[p.exerciseId]) {
          scores[p.exerciseId] = p.overallScore;
        }
      }
    });

    return NextResponse.json({
      exercises: exercises
        .filter((e) => e.phase === targetPhase)
        .map(withTargetMetrics),
      completedIds,
      scores,
    });
  } catch (error) {
    console.error("Exercises API error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
