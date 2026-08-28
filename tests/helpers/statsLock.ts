import type Redis from "ioredis";

// A handful of tests genuinely need to overwrite the shared, global
// stats:secrets_created / stats:secrets_opened counters (a reset, or
// simulating a Redis wipe) rather than just tolerate concurrent
// increments the way most tests do. Under fullyParallel: true, two such
// tests running at the same time will stomp on each other's before/after
// assertions — this is a plain Redis-backed mutex so at most one of
// them holds the counters in an inconsistent state at a time. Tests that
// only ever increment (create/reveal flows) don't need this: their `>=`
// assertions already tolerate arbitrary concurrent increases, just not a
// window where the values are lower than expected.
const LOCK_KEY = "test:stats-mutation-lock";
const LOCK_TTL_MS = 15_000;
const ACQUIRE_TIMEOUT_MS = 25_000;
const POLL_INTERVAL_MS = 100;

export async function withStatsLock<T>(redis: Redis, fn: () => Promise<T>): Promise<T> {
  const token = Math.random().toString(36).slice(2);
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;

  while (true) {
    const acquired = await redis.set(LOCK_KEY, token, "PX", LOCK_TTL_MS, "NX");
    if (acquired === "OK") break;
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for the stats test mutation lock");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  try {
    return await fn();
  } finally {
    // Only release if we still hold it — if the TTL already expired and
    // someone else acquired it, deleting unconditionally would release
    // their lock instead of ours.
    const current = await redis.get(LOCK_KEY);
    if (current === token) await redis.del(LOCK_KEY);
  }
}
