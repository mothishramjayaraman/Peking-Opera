import { NextResponse } from "next/server";
import { storage } from "../../../../server/storage.js";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const song = await storage.getSong(id);

    if (!song) {
      return NextResponse.json({ message: "Song not found" }, { status: 404 });
    }

    return NextResponse.json(song);
  } catch (error) {
    console.error("Song detail API error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
