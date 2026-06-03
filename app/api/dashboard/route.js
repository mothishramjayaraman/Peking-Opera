import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../server/storage.js";

export async function GET() {
  try {
    // Get user ID from cookies
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    // Reject if no auth
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Fetch user data
    const user = await storage.getUser(userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Compute effective streak — the stored value is only updated on practice,
    // so a broken streak (missed day) must be detected at read time.
    const effectiveStreak = (() => {
      if (!user.lastPracticeDate || !user.streak) return user.streak || 0;
      const last = new Date(user.lastPracticeDate);
      const now = new Date();
      const a = new Date(last.getFullYear(), last.getMonth(), last.getDate());
      const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.round((b - a) / 86_400_000); //milliseconds in 1 day:
      return diffDays > 1 ? 0 : user.streak;
    })();

    // Get all user data needed for dashboard
    const allProgress = await storage.getExerciseProgress(user.id);
    const exercises = await storage.getExercises();
    const performances = await storage.getPerformances(user.id);

    // Get recent completed exercises (5 most recent)
    const recentExercises = allProgress
      .filter((p) => p.completed)
      .sort(
        (a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0),
      )
      .slice(0, 5)
      .map((progress) => ({
        exercise: exercises.find((e) => e.id === progress.exerciseId),
        progress,
      }))
      .filter((item) => item.exercise);

    // Filter items from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Exercises completed in last week
    const completedItems = allProgress.filter(
      (p) =>
        p.completed && p.completedAt && new Date(p.completedAt) > sevenDaysAgo,
    );

    // Performances recorded in last week
    const performanceItems = performances.filter(
      (p) => p.performedAt && new Date(p.performedAt) > sevenDaysAgo,
    );

    // Sum practice time from exercises + estimate 4 min per performance
    const totalMinutes =
      completedItems.reduce((sum, p) => {
        const ex = exercises.find((e) => e.id === p.exerciseId);
        return sum + (ex?.durationMinutes || 0);
      }, 0) +
      performanceItems.length * 4;

    // Combine exercise and performance scores for weekly average
    const exScores = completedItems
      .map((p) => p.overallScore)
      .filter((s) => s != null);
    const perfScores = performanceItems
      .map((p) => Number(p.performanceScore))
      .filter((s) => !isNaN(s));
    const allScores = [...exScores, ...perfScores];

    // Calculate average score from both types
    const averageScore =
      allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 0;

    // Calculate progress percentage for current phase
    const phaseExercises = await storage.getExercisesByPhase(user.currentPhase);
    const phaseCompletedCount = allProgress.filter(
      (p) => p.completed && phaseExercises.some((e) => e.id === p.exerciseId),
    ).length;

    const currentPhaseProgress =
      phaseExercises.length > 0
        ? (phaseCompletedCount / phaseExercises.length) * 100
        : 0;

    // Return compiled dashboard data
    return NextResponse.json({
      user: { ...user, streak: effectiveStreak },
      recentExercises,
      weeklyStats: {
        practiceMinutes: totalMinutes,
        exercisesCompleted: completedItems.length + performanceItems.length,
        averageScore,
        goalMinutes: user.weeklyGoalMinutes,
        currentPhaseProgress,
      },
    });
  } catch (error) {
    // Log error for debugging
    console.error("Dashboard data error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
