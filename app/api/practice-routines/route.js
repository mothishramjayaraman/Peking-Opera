import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../server/storage.js";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const routines = await storage.getPracticeRoutines(userId);
    const exercises = await storage.getExercises();
    const progress = await storage.getExerciseProgress(userId);

    const enrichedRoutines = routines.map(routine => {
      const routineExercises = exercises.filter(e => 
        routine.exerciseIds.includes(e.id)
      );
      const completedIds = progress
        .filter(p => p.completed && routine.exerciseIds.includes(p.exerciseId))
        .map(p => p.exerciseId);

      return {
        ...routine,
        exercises: routineExercises,
        completedExercises: completedIds.length,
        totalExercises: routineExercises.length,
      };
    });

    return NextResponse.json(enrichedRoutines);
  } catch (error) {
    console.error("Get routines error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
