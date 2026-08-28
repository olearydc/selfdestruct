import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { MAX_CIPHERTEXT_B64_LENGTH, RATE_LIMIT_MAX_CREATES } from "@/lib/constants";

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

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

  const body = await request.json();
  const { ciphertext, iv, expiresIn, passphraseHash, duress } = body ?? {};

  if (!isNonEmptyString(ciphertext) || !isNonEmptyString(iv)) {
    return withRateLimitCookie(
      NextResponse.json(
        { error: "ciphertext and iv are required strings" },
        { status: 400, headers: NO_STORE_HEADERS },
      ),
    );
  }

  if (ciphertext.length > MAX_CIPHERTEXT_B64_LENGTH) {
    return withRateLimitCookie(
      NextResponse.json(
        { error: "Payload too large." },
        { status: 400, headers: NO_STORE_HEADERS },
      ),
    );
  }

  if (
    typeof expiresIn !== "number" ||
    !Number.isInteger(expiresIn) ||
    expiresIn < MIN_EXPIRES_IN ||
    expiresIn > MAX_EXPIRES_IN
  ) {
    return withRateLimitCookie(
      NextResponse.json(
        { error: `expiresIn must be an integer between ${MIN_EXPIRES_IN} and ${MAX_EXPIRES_IN}` },
        { status: 400, headers: NO_STORE_HEADERS },
      ),
    );
  }

  if (passphraseHash !== undefined && !isNonEmptyString(passphraseHash)) {
    return withRateLimitCookie(
      NextResponse.json(
        { error: "passphraseHash must be a non-empty string when provided" },
        { status: 400, headers: NO_STORE_HEADERS },
      ),
    );
  }

  // Duress only makes sense once a real passphrase exists: the reveal page
  // has exactly one passphrase field, so without a real passphrase there is
  // nothing for the duress passphrase to be a *different* answer to.
  if (duress !== undefined) {
    if (!isNonEmptyString(passphraseHash)) {
      return withRateLimitCookie(
        NextResponse.json(
          { error: "duress requires passphraseHash to also be set" },
          { status: 400, headers: NO_STORE_HEADERS },
        ),
      );
    }
    if (
      !isNonEmptyString(duress.ciphertext) ||
      !isNonEmptyString(duress.iv) ||
      !isNonEmptyString(duress.passphraseHash)
    ) {
      return withRateLimitCookie(
        NextResponse.json(
          { error: "duress.ciphertext, duress.iv, and duress.passphraseHash are required" },
          { status: 400, headers: NO_STORE_HEADERS },
        ),
      );
    }
    if (duress.ciphertext.length > MAX_CIPHERTEXT_B64_LENGTH) {
      return withRateLimitCookie(
        NextResponse.json(
          { error: "Payload too large." },
          { status: 400, headers: NO_STORE_HEADERS },
        ),
      );
    }
    if (duress.passphraseHash === passphraseHash) {
      return withRateLimitCookie(
        NextResponse.json(
          { error: "duress passphrase must differ from the real passphrase" },
          { status: 400, headers: NO_STORE_HEADERS },
        ),
      );
    }
  }

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
