import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const NO_STORE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

// POST, not GET: this can carry a passphrase hash, and a passphrase must
// never ride in a query string where it could end up in logs or browser
// history. Read-only — see burn/route.ts for the step that actually
// deletes, and lib/redis.ts for why those are split.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const passphraseHash = typeof body.passphraseHash === "string" ? body.passphraseHash : "";

  const raw = await redis.checkSecret(`secret:${id}`, passphraseHash);

  if (raw === null) {
    return NextResponse.json(
      { error: "This secret no longer exists." },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(JSON.parse(raw), { headers: NO_STORE_HEADERS });
}
