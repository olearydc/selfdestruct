import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { isAdminAuthorized } from "@/lib/adminAuth";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  // Defense-in-depth, not the only gate — see lib/adminAuth.ts's comment.
  if (!isAdminAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  await Promise.all([redis.set("stats:secrets_created", "0"), redis.set("stats:secrets_opened", "0")]);

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
