import { NextResponse } from "next/server";

export async function GET(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.CALLBACK_URL || `${req.nextUrl.origin}/api/auth/google/callback`;

  if (!clientId) {
    return NextResponse.json({ message: "Google Auth not configured on server" }, { status: 501 });
  }

  const mode = req.nextUrl.searchParams.get("mode") || "login";
  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("client_id", clientId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("scope", "profile email");
  oauthUrl.searchParams.set("access_type", "online");
  oauthUrl.searchParams.set("state", mode);

  return NextResponse.redirect(oauthUrl.toString());
}
