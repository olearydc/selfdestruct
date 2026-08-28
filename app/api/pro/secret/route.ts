import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { hashApiKey, lookupApiKey } from "@/lib/apiKeys";
import { validateSecretPayload } from "@/lib/secretValidation";

const MIN_EXPIRES_IN = 60; // 1 minute — same floor as the free tier
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

const NO_STORE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

// Deliberately a separate surface from POST /api/secret, not the same
// endpoint branching on a header — see MONETISATION.md: "API access with
// its own authentication (API keys, not the no-accounts model used for the
// free web UI — these are deliberately different surfaces)". The free
// endpoint's cookie-based rate limiting has no meaning here; a Pro request
// carries its own identity in the Authorization header instead.
function extractApiKey(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const key = auth.slice("Bearer ".length).trim();
  return key.length > 0 ? key : null;
}

export async function POST(request: NextRequest) {
  const key = extractApiKey(request);
  if (!key) {
    return NextResponse.json(
      { error: "Missing or malformed Authorization header. Expected: Bearer <api-key>" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const record = await lookupApiKey(key);
  if (!record) {
    return NextResponse.json(
      { error: "Invalid or revoked API key." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  // Bucketed by the key's own hash — never the plaintext, same principle
  // as everywhere else a credential is compared or stored in this project.
  const rateLimitKey = `ratelimit:pro:${hashApiKey(key)}`;
  const count = await redis.incr(rateLimitKey);
  if (count === 1) {
    await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);
  }
  if (count > record.rateLimitMax) {
    return NextResponse.json(
      {
        error: `This API key has created ${record.rateLimitMax} secrets in the last hour, which is its current limit.`,
      },
      { status: 429, headers: NO_STORE_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  const result = validateSecretPayload(body, MIN_EXPIRES_IN, record.maxExpiresIn);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE_HEADERS });
  }
  const { ciphertext, iv, expiresIn, passphraseHash, duress } = result.payload;

  const id = randomBytes(16).toString("base64url");

  // Same `secret:<id>` key schema as the free tier — this must stay one
  // code path, not a parallel implementation, so Pro-created secrets get
  // exactly the same atomic reveal/burn guarantees as everything else. See
  // docs/phases/phase-8-pro-tier.md's "identical security properties" test.
  const stored: Record<string, unknown> = { ciphertext, iv };
  if (passphraseHash) stored.passphraseHash = passphraseHash;
  if (duress) stored.duress = duress;

  await redis.set(`secret:${id}`, JSON.stringify(stored), "EX", expiresIn);
  await redis.incr("stats:secrets_created");

  return NextResponse.json({ id }, { headers: NO_STORE_HEADERS });
}
