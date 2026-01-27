import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  const uptimeSeconds = Math.round(process.uptime());
  return NextResponse.json(
    {
      ok: true,
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV ?? "unknown",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

