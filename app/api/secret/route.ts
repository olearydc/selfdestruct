import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { RATE_LIMIT_MAX_CREATES } from "@/lib/constants";
import { validateSecretPayload } from "@/lib/secretValidation";

const MIN_EXPIRES_IN = 60; // 1 minute
const MAX_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days

const NO_STORE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

// Session-token-bucket rate limiting, not IP-based — see SECURITY.md § The
// honest trade-off. The token is a random, unlinkable cookie with no
// identity behind it; it exists purely to throttle abusive creation rates,
// not to track anyone.
//
// RATE_LIMIT_MAX_CREATES itself lives in lib/constants.ts, not here —
// raised from the original 20 once /batch shipped (a single legitimate
// batch of up to BATCH_MAX_ITEMS links could otherwise burn most of an
// hour's budget in one submission), and kept there so the batch page's
// own explanatory copy can state the real number instead of a second,
// hand-typed one that could quietly drift out of sync with it.
const RATE_LIMIT_COOKIE = "sd_rl";
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour

export async function POST(request: NextRequest) {
  let rateLimitToken = request.cookies.get(RATE_LIMIT_COOKIE)?.value;
  const isNewToken = !rateLimitToken;
  if (!rateLimitToken) {
    rateLimitToken = randomBytes(16).toString("base64url");
  }

  const rateLimitKey = `ratelimit:create:${rateLimitToken}`;
  const count = await redis.incr(rateLimitKey);
  if (count === 1) {
    await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);
  }

  function withRateLimitCookie(response: NextResponse): NextResponse {
    if (isNewToken) {
      response.cookies.set(RATE_LIMIT_COOKIE, rateLimitToken!, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: RATE_LIMIT_WINDOW_SECONDS,
      });
    }
    return response;
  }

  if (count > RATE_LIMIT_MAX_CREATES) {
    return withRateLimitCookie(
      NextResponse.json(
        {
          error: `This browser has created ${RATE_LIMIT_MAX_CREATES} secrets in the last hour, which is the most we allow at once. Try again in a bit, or from a different browser.`,
        },
        { status: 429, headers: NO_STORE_HEADERS },
      ),
    );
  }

  const body = await request.json().catch(() => null);
  const result = validateSecretPayload(body, MIN_EXPIRES_IN, MAX_EXPIRES_IN);
  if (!result.ok) {
    return withRateLimitCookie(
      NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE_HEADERS }),
    );
  }
  const { ciphertext, iv, expiresIn, passphraseHash, duress } = result.payload;

  const id = randomBytes(16).toString("base64url");

  const stored: Record<string, unknown> = { ciphertext, iv };
  if (passphraseHash) stored.passphraseHash = passphraseHash;
  if (duress) {
    stored.duress = {
      ciphertext: duress.ciphertext,
      iv: duress.iv,
      passphraseHash: duress.passphraseHash,
    };
  }

  await redis.set(`secret:${id}`, JSON.stringify(stored), "EX", expiresIn);

  // Coarse, aggregate-only bookkeeping — see SECURITY.md § Usage tracking
  // without metadata. A plain counter, no ID or timestamp attached, never
  // joined to the secret it came from.
  await redis.incr("stats:secrets_created");

  return withRateLimitCookie(NextResponse.json({ id }, { headers: NO_STORE_HEADERS }));
}
