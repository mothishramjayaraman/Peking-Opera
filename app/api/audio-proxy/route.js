import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ message: "Missing url parameter" }, { status: 400 });
  }

  // Only allow archive.org URLs for security
  if (!url.startsWith("https://archive.org/")) {
    return NextResponse.json({ message: "Only archive.org URLs are allowed" }, { status: 403 });
  }

  try {
    const rangeHeader = request.headers.get("range");
    const fetchHeaders = {};
    if (rangeHeader) fetchHeaders["Range"] = rangeHeader;

    const upstream = await fetch(url, { headers: fetchHeaders });

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "audio/mpeg");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=3600");

    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);

    const contentRange = upstream.headers.get("Content-Range");
    if (contentRange) headers.set("Content-Range", contentRange);

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error("Audio proxy error:", error);
    return NextResponse.json({ message: "Failed to fetch audio" }, { status: 502 });
  }
}
