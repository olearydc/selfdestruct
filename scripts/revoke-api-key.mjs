// Companion to create-api-key.mjs — see that file for why this is
// self-contained rather than importing lib/apiKeys.ts.
import { createHash } from "node:crypto";
import { config } from "dotenv";
import Redis from "ioredis";

config({ path: ".env.local", quiet: true });

function hashApiKey(plaintext) {
  return createHash("sha256").update(plaintext).digest("hex");
}

async function main() {
  const key = process.argv[2];
  if (!key) {
    console.error("Usage: npm run revoke-api-key -- <api-key>");
    process.exitCode = 1;
    return;
  }

  const redis = new Redis(process.env.REDIS_URL);
  const redisKey = `apikey:${hashApiKey(key)}`;
  const raw = await redis.get(redisKey);

  if (!raw) {
    console.log("Key not found (already invalid, or never existed).");
    await redis.quit();
    return;
  }

  const record = JSON.parse(raw);
  record.revoked = true;
  await redis.set(redisKey, JSON.stringify(record));
  await redis.quit();

  console.log(`Key revoked. Note on record: ${record.note}`);
}

main();
