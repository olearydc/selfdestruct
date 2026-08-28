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
