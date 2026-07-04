import { verifySession } from "../../../../server/session.js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../../server/storage.js";
import { comparePasswords, hashPassword } from "../../../../server/auth.js";

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    const userId = verifySession(cookieStore.get("userId")?.value);

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: "Current and new passwords are required" }, { status: 400 });
    }

    const user = await storage.getUser(userId);
    if (!user || !(await comparePasswords(currentPassword, user.password))) {
      return NextResponse.json({ message: "Invalid current password" }, { status: 401 });
    }

    const hashedPassword = await hashPassword(newPassword);
    await storage.updateUser(userId, { password: hashedPassword });

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
