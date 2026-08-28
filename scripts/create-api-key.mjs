// Manual/admin API-key issuance for Pro tier — Phase 8's payment
// integration isn't built yet (see docs/phases/phase-8-pro-tier.md), so
// this operator-run script is the only way a key gets created today.
// Swapping in real payment processing later means calling the same
// issueApiKey logic from a webhook handler instead of this script; the key
// model itself (lib/apiKeys.ts) doesn't need to change.
//
// Deliberately self-contained (no import of lib/apiKeys.ts or lib/redis.ts)
// so it doesn't depend on Node correctly resolving extensionless relative
// TypeScript imports outside the Next.js build, and so dotenv's env load
// can't race a module-top-level Redis client construction. The two magic
// numbers below (30-day expiry, 500/hour) mirror lib/constants.ts's
// PRO_MAX_EXPIRES_IN_SECONDS / PRO_DEFAULT_RATE_LIMIT_MAX — keep them in
// sync if either changes.
import { createHash, randomBytes } from "node:crypto";
import { config } from "dotenv";
import Redis from "ioredis";

config({ path: ".env.local", quiet: true });

const PRO_MAX_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PRO_DEFAULT_RATE_LIMIT_MAX = 500; // per hour

function hashApiKey(plaintext) {
  return createHash("sha256").update(plaintext).digest("hex");
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--team") args.team = argv[++i];
    else args._.push(arg);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const note = args._[0];
  if (!note) {
    console.error(
      'Usage: npm run create-api-key -- "customer note (e.g. name/email)" [--team <teamId>]\n\n' +
        "--team groups this key into a shared rate-limit pool with any other\n" +
        "key issued with the same --team value (team seats — see\n" +
        "docs/MONETISATION.md). Use the same --team value for every seat on\n" +
        "one team; there is no separate 'create a team' step.",
    );
    process.exitCode = 1;
    return;
  }

  const redis = new Redis(process.env.REDIS_URL);
  const plaintext = "sk_live_" + randomBytes(24).toString("base64url");
  const record = {
    tier: "pro",
    note,
    createdAt: new Date().toISOString(),
    revoked: false,
    maxExpiresIn: PRO_MAX_EXPIRES_IN_SECONDS,
    rateLimitMax: PRO_DEFAULT_RATE_LIMIT_MAX,
    ...(args.team ? { teamId: args.team } : {}),
  };

  await redis.set(`apikey:${hashApiKey(plaintext)}`, JSON.stringify(record));
  await redis.quit();

  console.log("API key issued — shown once, never stored in plaintext. Save it now:\n");
  console.log(plaintext);
  console.log(`\nNote: ${note}`);
  console.log(`Max expiry: ${PRO_MAX_EXPIRES_IN_SECONDS / 86400} days`);
  console.log(`Rate limit: ${PRO_DEFAULT_RATE_LIMIT_MAX}/hour${args.team ? " (shared across team)" : ""}`);
  if (args.team) console.log(`Team: ${args.team}`);
}

main();
