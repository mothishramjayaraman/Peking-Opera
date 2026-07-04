import { verifySession } from "../../../server/session.js";
import { signSession } from "../../../server/session.js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../server/storage.js";
import { hashPassword } from "../../../server/auth.js";
import { insertUserSchema } from "../../../shared/constants.js";

export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = insertUserSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ 
        message: "Invalid user data", 
        errors: parsed.error.errors 
      }, { status: 400 });
    }

    const existingUser = await storage.getUserByUsername(parsed.data.name);
    if (existingUser) {
      return NextResponse.json({ message: "Username already exists" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(parsed.data.password);
    const user = await storage.createUser({
      ...parsed.data,
      password: hashedPassword,
    });

    const cookieStore = await cookies();
    cookieStore.set("userId", signSession(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    const { password, ...userWithoutPassword } = user;
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const cookieStore = await cookies();
    const userId = verifySession(cookieStore.get("userId")?.value);

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const updatedUser = await storage.updateUser(userId, body);
    
    const { password, ...userWithoutPassword } = updatedUser;
    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
