import { signSession } from "../../../../../server/session.js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "../../../../../server/storage.js";

export async function GET(req) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  
  if (error) {
    return NextResponse.redirect(new URL("/auth?error=Authentication%20failed", req.url));
  }
  
  if (!code) {
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.CALLBACK_URL || `${req.nextUrl.origin}/api/auth/google/callback`;

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
        throw new Error(tokenData.error_description || "Token request failed");
    }

    const { access_token } = tokenData;

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const profile = await profileResponse.json();

    if (!profileResponse.ok) {
        throw new Error(profile.error?.message || "Profile request failed");
    }

    const googleId = profile.id;
    const email = profile.email;
    const name = profile.name || email || "Google User";

    let user = await storage.getUserByGoogleId(googleId);
    
    if (!user && email) {
      user = await storage.getUserByEmail(email);
      if (user) {
        user = await storage.updateUser(user.id, { googleId });
      }
    }

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await storage.createUser({
        name,
        email,
        googleId,
        experienceLevel: "beginner",
      });
    }

    const mode = req.nextUrl.searchParams.get("state");
    const isSignup = mode === "signup";

    if (isSignup && !isNewUser) {
        return NextResponse.redirect(new URL("/auth?error=Account%20already%20exists.%20Please%20log%20in%20instead.", req.url));
    }

    const cookieStore = await cookies();
    cookieStore.set("userId", signSession(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    if (isNewUser || isSignup) {
      return NextResponse.redirect(new URL("/auth/onboarding", req.url));
    }

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (err) {
    console.error("Google Callback Error:", err);
    return NextResponse.redirect(new URL("/auth?error=Authentication%20failed", req.url));
  }
}
