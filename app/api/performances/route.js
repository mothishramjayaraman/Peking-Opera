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

    const performances = await storage.getPerformances(userId);
    return NextResponse.json(performances);
  } catch (error) {
    console.error("Get performances error:", error);
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
    const performance = await storage.createPerformance({
      ...body,
      userId,
      performedAt: new Date().toISOString(),
    });

    await storage.updateStreak(userId);



    return NextResponse.json(performance, { status: 201 });
  } catch (error) {
    console.error("Create performance error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
