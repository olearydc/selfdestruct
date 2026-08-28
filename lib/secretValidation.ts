import { MAX_CIPHERTEXT_B64_LENGTH } from "./constants";

export interface ValidatedSecretPayload {
  ciphertext: string;
  iv: string;
  expiresIn: number;
  passphraseHash?: string;
  duress?: { ciphertext: string; iv: string; passphraseHash: string };
}

export type ValidationResult =
  | { ok: true; payload: ValidatedSecretPayload }
  | { ok: false; error: string; status: number };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// Shared between the free web endpoint (app/api/secret/route.ts) and the
// Pro API endpoint (app/api/pro/secret/route.ts) — same validation rules,
// different callers, so the two surfaces can never quietly drift apart on
// what counts as a valid payload. Only the expiry bounds differ per caller,
// passed in rather than hardcoded here.
export function validateSecretPayload(
  body: unknown,
  minExpiresIn: number,
  maxExpiresIn: number,
): ValidationResult {
  const { ciphertext, iv, expiresIn, passphraseHash, duress } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (!isNonEmptyString(ciphertext) || !isNonEmptyString(iv)) {
    return { ok: false, error: "ciphertext and iv are required strings", status: 400 };
  }

  if (ciphertext.length > MAX_CIPHERTEXT_B64_LENGTH) {
    return { ok: false, error: "Payload too large.", status: 400 };
  }

  if (
    typeof expiresIn !== "number" ||
    !Number.isInteger(expiresIn) ||
    expiresIn < minExpiresIn ||
    expiresIn > maxExpiresIn
  ) {
    return {
      ok: false,
      error: `expiresIn must be an integer between ${minExpiresIn} and ${maxExpiresIn}`,
      status: 400,
    };
  }

  if (passphraseHash !== undefined && !isNonEmptyString(passphraseHash)) {
    return {
      ok: false,
      error: "passphraseHash must be a non-empty string when provided",
      status: 400,
    };
  }

  if (duress !== undefined) {
    if (!isNonEmptyString(passphraseHash)) {
      return { ok: false, error: "duress requires passphraseHash to also be set", status: 400 };
    }
    const d = duress as Record<string, unknown>;
    if (!isNonEmptyString(d.ciphertext) || !isNonEmptyString(d.iv) || !isNonEmptyString(d.passphraseHash)) {
      return {
        ok: false,
        error: "duress.ciphertext, duress.iv, and duress.passphraseHash are required",
        status: 400,
      };
    }
    if (d.ciphertext.length > MAX_CIPHERTEXT_B64_LENGTH) {
      return { ok: false, error: "Payload too large.", status: 400 };
    }
    if (d.passphraseHash === passphraseHash) {
      return {
        ok: false,
        error: "duress passphrase must differ from the real passphrase",
        status: 400,
      };
    }
    return {
      ok: true,
      payload: {
        ciphertext,
        iv,
        expiresIn,
        passphraseHash: passphraseHash as string,
        duress: {
          ciphertext: d.ciphertext as string,
          iv: d.iv as string,
          passphraseHash: d.passphraseHash as string,
        },
      },
    };
  }

  return {
    ok: true,
    payload: { ciphertext, iv, expiresIn, passphraseHash: passphraseHash as string | undefined },
  };
}

const SLUG_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{1,62}[a-zA-Z0-9])?$/;

export type SlugValidationResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; status: number };

// Pro-only (branded/vanity short links, see MONETISATION.md) — the free
// tier always gets a random id, so this isn't part of the shared payload
// validator above. A custom slug is, by definition, far more guessable
// than a random 16-byte id — and burnSecret's Lua script (lib/redis.ts)
// deletes unconditionally when no passphrase is set, with no proof of key
// possession required. That makes id-guessability load-bearing for
// passphrase-less secrets: anyone who guesses a slug could burn it before
// the real recipient opens it. The fix isn't a slug-format rule, it's a
// policy rule enforced by the caller: never accept a slug without also
// requiring passphraseHash on the same request, which closes the gap
// because burn then needs a matching hash regardless of id predictability.
export function validateSlug(slug: unknown): SlugValidationResult {
  if (typeof slug !== "string") {
    return { ok: false, error: "slug must be a string", status: 400 };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error:
        "slug must be 3-64 characters, letters/digits/hyphens only, no leading or trailing hyphen",
      status: 400,
    };
  }
  return { ok: true, slug };
}
