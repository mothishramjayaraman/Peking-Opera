import { verifySession } from "../../../server/session.js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../server/storage.js";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = verifySession(cookieStore.get("userId")?.value);

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await storage.getUser(userId);
    const allSongs = await storage.getSongs();
    
    let recommendedSongs = allSongs;
    if (user?.vocalRange) {
      const vocalRangeSongs = await storage.getSongsByVocalRange(user.vocalRange);
      recommendedSongs = vocalRangeSongs.length > 0 ? vocalRangeSongs : allSongs.slice(0, 4);
    } else {
      recommendedSongs = allSongs.filter((s) => s.difficulty === "easy").slice(0, 4);
    }

    return NextResponse.json({
      songs: allSongs,
      recommendedSongs,
    });
  } catch (error) {
    console.error("Songs API error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
