import Redis from "ioredis";

declare global {
  var __redis: Redis | undefined;
}

// Read-only: compares the supplied passphrase hash against what's stored
// and returns the matching ciphertext, but never deletes. The server has
// no way to know whether the client will actually be able to decrypt what
// it returns here — the key never reaches the server — so deletion can't
// happen at fetch time without risking burning a secret on a corrupted key
// fragment. See burnSecret below for the step that actually deletes.
const CHECK_SECRET_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return false
end

local ok, data = pcall(cjson.decode, raw)
if not ok then
  return false
end

local supplied = ARGV[1]

if not data.passphraseHash then
  return cjson.encode({status = 'ok', ciphertext = data.ciphertext, iv = data.iv})
end

if supplied == '' then
  return cjson.encode({status = 'requiresPassphrase'})
end

if supplied == data.passphraseHash then
  return cjson.encode({status = 'ok', ciphertext = data.ciphertext, iv = data.iv})
end

if data.duress and supplied == data.duress.passphraseHash then
  return cjson.encode({status = 'ok', ciphertext = data.duress.ciphertext, iv = data.duress.iv})
end

return cjson.encode({status = 'wrongPassphrase'})
`;

// Atomic compare-then-delete, called only after the client has confirmed a
// successful local decrypt. Re-checks the passphrase hash (rather than
// deleting unconditionally) so a passphrase-protected secret can't be
// destroyed by anyone who merely knows its ID — the same protection the
// no-passphrase case never needed but the passphrase case always relied
// on. A single Lua script keeps compare-and-delete atomic, same reasoning
// as the old combined reveal script.
// The stats:secrets_opened INCR lives inside this same atomic script,
// right alongside the DEL — not as a separate call after burnSecret
// returns. That keeps the count an exact, race-free reflection of real
// deletes (never double-counted by a retry, never dropped by a crash
// between the two calls), and keeps it a plain aggregate number with
// nothing linking it back to which secret was opened — see SECURITY.md
// § Usage tracking without metadata.
const BURN_SECRET_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return false
end

local ok, data = pcall(cjson.decode, raw)
if not ok then
  return false
end

local supplied = ARGV[1]

if not data.passphraseHash then
  redis.call('DEL', KEYS[1])
  redis.call('INCR', 'stats:secrets_opened')
  return cjson.encode({status = 'ok'})
end

if supplied == data.passphraseHash or (data.duress and supplied == data.duress.passphraseHash) then
  redis.call('DEL', KEYS[1])
  redis.call('INCR', 'stats:secrets_opened')
  return cjson.encode({status = 'ok'})
end

return cjson.encode({status = 'wrongPassphrase'})
`;

function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL as string, { maxRetriesPerRequest: 3 });
  client.defineCommand("checkSecret", { numberOfKeys: 1, lua: CHECK_SECRET_SCRIPT });
  client.defineCommand("burnSecret", { numberOfKeys: 1, lua: BURN_SECRET_SCRIPT });
  return client;
}

export const redis = global.__redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  global.__redis = redis;
}

declare module "ioredis" {
  interface RedisCommander {
    checkSecret(key: string, suppliedPassphraseHash: string): Promise<string | null>;
    burnSecret(key: string, suppliedPassphraseHash: string): Promise<string | null>;
  }
}
