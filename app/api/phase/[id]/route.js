import { verifySession } from "../../../../server/session.js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../../server/storage.js";

export async function POST(req, { params }) {
  try {
    const cookieStore = await cookies();
    const userId = verifySession(cookieStore.get("userId")?.value);

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const phase = parseInt(id);

    if (isNaN(phase)) {
      return NextResponse.json({ message: "Invalid phase ID" }, { status: 400 });
    }

    const user = await storage.updateUser(userId, { currentPhase: phase });
    if (!user) {
      console.warn(`[DEBUG API] User session invalid for userId: ${userId} during update. Clearing cookie.`);
      const response = NextResponse.json({ message: "Session invalid or user not found" }, { status: 401 });
      response.cookies.delete("userId");
      return response;
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Update phase error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req, { params }) {
  try {
    const cookieStore = await cookies();
    const userId = verifySession(cookieStore.get("userId")?.value);

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const phaseId = parseInt(id);

    console.log(`[DEBUG API] GET /api/phase/${phaseId} for userId: ${userId}`);

    if (isNaN(phaseId)) {
      return NextResponse.json({ message: "Invalid phase ID" }, { status: 400 });
    }

    const user = await storage.getUser(userId);
    console.log(`[DEBUG API] storage.getUser(${userId}) result: ${user ? "Found" : "Not Found"}`);

    if (!user) {
      console.warn(`[DEBUG API] User session invalid for userId: ${userId}. Clearing cookie.`);
      const response = NextResponse.json({ message: "Session invalid or user not found" }, { status: 401 });
      response.cookies.delete("userId");
      return response;
    }

    const exercises = await storage.getExercisesByPhase(phaseId);
    const progress = await storage.getExerciseProgress(user.id);
    
    const phaseProgress = progress.filter((p) => 
      exercises.some((e) => e.id === p.exerciseId)
    );

    const completedIds = phaseProgress
      .filter((p) => p.completed)
      .map((p) => p.exerciseId);

    const progressPercent = exercises.length > 0 
      ? (completedIds.length / exercises.length) * 100 
      : 0;

    const songs = await storage.getSongs();
    const phaseTestSong = songs.find(s => s.phase === phaseId);

    return NextResponse.json({
      user,
      exercises,
      completedIds,
      phaseProgress: progressPercent,
      phaseTestSong,
    });
  } catch (error) {
    console.error("Get phase error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
