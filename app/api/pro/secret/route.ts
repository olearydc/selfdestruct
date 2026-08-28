import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { hashApiKey, lookupApiKey } from "@/lib/apiKeys";
import { validateSecretPayload, validateSlug } from "@/lib/secretValidation";
import { snapshotStats } from "@/lib/statsSnapshot";

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
  // Team seats (MONETISATION.md) share one pooled bucket instead, keyed by
  // teamId rather than any individual key — that's the entire mechanism by
  // which seats "share" anything. It's a rate-limit grouping, not a record
  // of who created what: the bucket is just a counter with a TTL, nothing
  // it stores could answer "what did teammate X send."
  const rateLimitKey = record.teamId
    ? `ratelimit:pro:team:${record.teamId}`
    : `ratelimit:pro:${hashApiKey(key)}`;
  const count = await redis.incr(rateLimitKey);
  if (count === 1) {
    await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);
  }
  if (count > record.rateLimitMax) {
    return NextResponse.json(
      {
        error: record.teamId
          ? `This team has created ${record.rateLimitMax} secrets in the last hour, which is its current shared limit.`
          : `This API key has created ${record.rateLimitMax} secrets in the last hour, which is its current limit.`,
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

  // Branded/vanity short link (see MONETISATION.md): an optional custom
  // slug in place of the random id. Requires a passphrase on the same
  // request — see validateSlug's own comment in lib/secretValidation.ts
  // for why that isn't optional, security-wise, once the id is guessable.
  const { slug } = (body ?? {}) as Record<string, unknown>;
  let id: string;
  if (slug !== undefined) {
    if (!passphraseHash) {
      return NextResponse.json(
        {
          error:
            "A custom slug requires a passphrase on the same request — without one, a guessable slug could let someone else burn the secret before your recipient opens it.",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    const slugResult = validateSlug(slug);
    if (!slugResult.ok) {
      return NextResponse.json(
        { error: slugResult.error },
        { status: slugResult.status, headers: NO_STORE_HEADERS },
      );
    }
    id = slugResult.slug;
  } else {
    id = randomBytes(16).toString("base64url");
  }

  // Same `secret:<id>` key schema as the free tier — this must stay one
  // code path, not a parallel implementation, so Pro-created secrets get
  // exactly the same atomic reveal/burn guarantees as everything else. See
  // docs/phases/phase-8-pro-tier.md's "identical security properties" test.
  const stored: Record<string, unknown> = { ciphertext, iv };
  if (passphraseHash) stored.passphraseHash = passphraseHash;
  if (duress) stored.duress = duress;

  // NX: a custom slug could collide with another live secret (random ids
  // are astronomically unlikely to, but a chosen slug genuinely can) —
  // fail the request rather than silently overwrite someone else's secret.
  const setResult = await redis.set(`secret:${id}`, JSON.stringify(stored), "EX", expiresIn, "NX");
  if (setResult === null) {
    return NextResponse.json(
      { error: "This slug is already in use. Try a different one." },
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }
  await redis.incr("stats:secrets_created");
  void snapshotStats().catch(() => {});

  return NextResponse.json({ id }, { headers: NO_STORE_HEADERS });
}
