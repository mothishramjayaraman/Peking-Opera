import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../server/storage.js";

export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const exerciseId = searchParams.get("exerciseId");

    let analyses = await storage.getVoiceAnalyses(userId);
    if (exerciseId) {
      analyses = analyses.filter((a) => a.exerciseId === exerciseId);
    }
    
    // Sort newest first
    analyses.sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt));

    return NextResponse.json(analyses);
  } catch (error) {
    console.error("Get voice analyses error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const analysis = await storage.createVoiceAnalysis({
      ...body,
      userId,
      analyzedAt: new Date().toISOString(),
    });

    await storage.updateStreak(userId);

    return NextResponse.json(analysis, { status: 201 });
  } catch (error) {
    console.error("Create voice analysis error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
