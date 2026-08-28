import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { snapshotStats } from "@/lib/statsSnapshot";

const NO_STORE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

// Called only after the client has successfully decrypted the ciphertext
// returned by POST /api/secret/:id — this is the step that actually
// deletes. Splitting fetch from burn is what lets a corrupted key
// fragment fail without destroying the secret: the client simply never
// calls this endpoint if its local decrypt fails, and the original,
// correct link keeps working. See lib/redis.ts for the atomicity and
// passphrase-re-check reasoning.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const passphraseHash = typeof body.passphraseHash === "string" ? body.passphraseHash : "";

  const raw = await redis.burnSecret(`secret:${id}`, passphraseHash);

  if (raw === null) {
    return NextResponse.json(
      { error: "This secret no longer exists." },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  // stats:secrets_opened was already incremented atomically inside
  // burnSecret's own Lua script (lib/redis.ts) — this just backs up the
  // resulting count, same as the create paths do.
  void snapshotStats().catch(() => {});

  return NextResponse.json(JSON.parse(raw), { headers: NO_STORE_HEADERS });
}
