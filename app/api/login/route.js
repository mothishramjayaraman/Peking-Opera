import { signSession } from "../../../server/session.js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../server/storage.js";
import { comparePasswords } from "../../../server/auth.js";

export async function POST(req) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: "Username and password are required" },
        { status: 400 },
      );
    }

    // Try to find user by username (name) or email
    let user = await storage.getUserByUsername(username);
    if (!user) {
      user = await storage.getUserByEmail(username);
    }

    // Validate user exists and password matches
    if (!user) {
      return NextResponse.json(
        { message: "Invalid username or password" },
        { status: 401 },
      );
    }

    // Check if user has a password (OAuth-only users don't)
    if (!user.password) {
      return NextResponse.json(
        {
          message:
            "This account uses Google Sign-In. Please continue with Google.",
          requiresOAuth: true,
        },
        { status: 401 },
      );
    }

    // Validate password
    if (!(await comparePasswords(password, user.password))) {
      return NextResponse.json(
        { message: "Invalid username or password" },
        { status: 401 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set("userId", signSession(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
