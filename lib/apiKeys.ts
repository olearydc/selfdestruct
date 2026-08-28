import { createHash, randomBytes } from "crypto";
import { redis } from "./redis";

// The first persistent (non-TTL'd) state this project stores — every other
// key in Redis is ephemeral by design (see ARCHITECTURE.md). API-key
// records are the deliberate, narrow exception: Pro tier requires knowing
// who's allowed extended limits, and that identity has to persist between
// requests. Kept in its own `apikey:` namespace, distinct from `secret:`,
// so it's never mistaken for — or swept up by — anything that assumes
// every Redis key here is a self-destructing secret.
//
// Only the SHA-256 hash of the key is ever stored, same principle as
// passphraseHash elsewhere: if this Redis instance were ever exposed, the
// plaintext key still couldn't be recovered from what's stored.
export type ApiKeyTier = "pro";

export interface ApiKeyRecord {
  tier: ApiKeyTier;
  note: string;
  createdAt: string;
  revoked: boolean;
  maxExpiresIn: number;
  rateLimitMax: number;
  // Team seats (MONETISATION.md): an optional shared id linking several
  // keys to the same team allocation. Deliberately just a rate-limit
  // grouping key, nothing else — there is no `team:<id>` record anywhere,
  // no list of a team's members, and no way to look up "which keys share
  // this teamId." Adding any of those would recreate the "what did my
  // team send" audit trail the design explicitly rules out.
  teamId?: string;
}

const KEY_PREFIX = "sk_live_";

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

function generatePlaintextKey(): string {
  return KEY_PREFIX + randomBytes(24).toString("base64url");
}

// Manual/admin issuance for now — Phase 8's payment integration isn't built
// yet (see docs/phases/phase-8-pro-tier.md), so this is the only path that
// creates a key today. Swapping in real payment processing later means
// calling this from a webhook handler instead of an operator-run script;
// the key model itself doesn't need to change.
export async function issueApiKey(params: {
  tier: ApiKeyTier;
  note: string;
  maxExpiresIn: number;
  rateLimitMax: number;
  teamId?: string;
}): Promise<string> {
  const plaintext = generatePlaintextKey();
  const record: ApiKeyRecord = {
    tier: params.tier,
    note: params.note,
    createdAt: new Date().toISOString(),
    revoked: false,
    maxExpiresIn: params.maxExpiresIn,
    rateLimitMax: params.rateLimitMax,
    ...(params.teamId ? { teamId: params.teamId } : {}),
  };
  await redis.set(`apikey:${hashApiKey(plaintext)}`, JSON.stringify(record));
  return plaintext;
}

// Returns null for a missing, malformed, or revoked key — callers don't
// need to distinguish those cases, since the client-facing response is the
// same "invalid or revoked" message either way (never leak which one).
export async function lookupApiKey(plaintext: string): Promise<ApiKeyRecord | null> {
  const raw = await redis.get(`apikey:${hashApiKey(plaintext)}`);
  if (!raw) return null;
  const record: ApiKeyRecord = JSON.parse(raw);
  if (record.revoked) return null;
  return record;
}

export async function revokeApiKey(plaintext: string): Promise<boolean> {
  const key = `apikey:${hashApiKey(plaintext)}`;
  const raw = await redis.get(key);
  if (!raw) return false;
  const record: ApiKeyRecord = JSON.parse(raw);
  record.revoked = true;
  await redis.set(key, JSON.stringify(record));
  return true;
}
