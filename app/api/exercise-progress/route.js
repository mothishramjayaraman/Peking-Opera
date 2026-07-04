import { verifySession } from "../../../server/session.js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../server/storage.js";

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const userId = verifySession(cookieStore.get("userId")?.value);

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { exerciseId, pitchScore, toneScore, breathingScore, overallScore, feedback, generativeFeedback } = await req.json();

    const user = await storage.getUser(userId);
    if (!user) {
      const res = NextResponse.json({ message: "Session expired. Please sign in again." }, { status: 401 });
      res.cookies.set("userId", "", { maxAge: 0, path: "/" });
      return res;
    }

    if (!exerciseId) {
      return NextResponse.json({ message: "Missing exerciseId" }, { status: 400 });
    }

    const exercise = await storage.getExercise(exerciseId);
    if (!exercise) {
      return NextResponse.json({ message: "Exercise not found" }, { status: 404 });
    }

    const existingProgress = await storage.getExerciseProgressByExercise(userId, exerciseId);

    let result;
    if (existingProgress) {
      result = await storage.updateExerciseProgress(existingProgress.id, {
        pitchScore,
        toneScore,
        breathingScore,
        overallScore,
        feedback,
        generativeFeedback,
        completed: true,
        completedAt: new Date(),
      });
    } else {
      result = await storage.createExerciseProgress({
        userId,
        exerciseId,
        completed: true,
        pitchScore,
        toneScore,
        breathingScore,
        overallScore,
        feedback,
        generativeFeedback,
        completedAt: new Date(),
      });
    }

    if (!existingProgress) {
      await storage.updateUser(userId, {
        totalPracticeMinutes: (user.totalPracticeMinutes || 0) + exercise.durationMinutes,
      });
    }

    await storage.updateStreak(userId);



    return NextResponse.json(result, { status: existingProgress ? 200 : 201 });
  } catch (error) {
    console.error("Save progress error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
