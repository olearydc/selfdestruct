import { config } from "dotenv";
import Redis from "ioredis";

config({ path: ".env.local", quiet: true });

// Refuses to run the suite at all unless the target Redis has been
// explicitly marked as a throwaway dev/test instance. This exists
// because of a real incident (2026-08-28): REDIS_URL in .env.local
// pointed through an SSH tunnel straight at *production* Redis (the
// documented way local dev reaches Redis at all, since the managed
// Redis instance has no public port — see docs/HARDENING_LOG.md § 17
// for the full account), and a full session of test runs — including
// destructive ones that reset/overwrite counters and issue hundreds of
// fake API keys — ran against the real, live store without anyone
// noticing until the numbers looked wrong on the live site.
//
// The marker is a positive opt-in, not a URL/hostname heuristic: a
// production and a tunneled-to-production Redis both resolve to
// 127.0.0.1:6379 indistinguishably from a real local one, so there's no
// way to tell them apart by inspecting REDIS_URL. Set it once, on a
// genuine throwaway instance only, via `npm run redis:mark-dev` — never
// run that against anything reachable from production.
const MARKER_KEY = "dev:redis-marker";
const MARKER_VALUE = "this-is-a-throwaway-dev-or-test-redis-instance";

export default async function globalSetup() {
  const redis = new Redis(process.env.REDIS_URL as string);
  try {
    const marker = await redis.get(MARKER_KEY);
    if (marker !== MARKER_VALUE) {
      throw new Error(
        "\n\nRefusing to run the test suite: this Redis instance is not marked safe for testing.\n" +
          `REDIS_URL points at a Redis with no "${MARKER_KEY}" marker set, which almost certainly ` +
          "means it's production (or something else you don't want a destructive test suite writing to).\n\n" +
          "If this really is a throwaway dev/test Redis, mark it once with:\n" +
          "  npm run redis:mark-dev\n\n" +
          "Never run that command against production or anything tunneled to it.\n",
      );
    }
  } finally {
    await redis.quit();
  }
}
