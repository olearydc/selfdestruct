import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import Redis from "ioredis";
import { expect, test } from "@playwright/test";
import { withStatsLock } from "./helpers/statsLock";

config({ path: ".env.local", quiet: true });

const SNAPSHOT_PATH = process.env.STATS_SNAPSHOT_PATH ?? ".stats-snapshot.json";

async function readSnapshot(): Promise<{ secretsCreated: number; secretsOpened: number } | null> {
  try {
    return JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  } catch {
    return null;
  }
}

// The module (lib/statsSnapshot.ts, via lib/redis.ts) reads REDIS_URL at
// import time — dynamic import() defers that until after config() above
// has already populated process.env, unlike a static top-level import,
// which would be hoisted ahead of it. Every other test file in this
// suite sidesteps the same issue by never importing lib/redis.ts at all
// and constructing its own `new Redis(...)` instead; this file needs the
// module itself, so it uses dynamic import to get the ordering right.
//
// It also points STATS_SNAPSHOT_PATH at a throwaway, test-only file
// before importing — the module's SNAPSHOT_PATH constant is resolved
// once, the first time it's imported in this process, so this must
// happen before that first import. Using the real default path here
// would race against the live dev server: every other test in the full
// suite that creates or burns a secret makes the server fire its own
// snapshotStats() write to that same file, completely outside this
// file's withStatsLock (which only coordinates Redis key access between
// test processes, not the server's own file writes). An isolated path
// sidesteps that contention entirely — this test is about the module's
// restore/never-lower logic, not about racing real traffic for a shared
// file.
async function loadStatsSnapshotModule() {
  process.env.STATS_SNAPSHOT_PATH = `.stats-snapshot-test-${process.pid}.json`;
  return import("../lib/statsSnapshot");
}

// This test manipulates the same shared, global stats:* counters other
// tests (tests/stats.spec.ts, tests/admin-stats.spec.ts) read and
// increment concurrently. withStatsLock (tests/helpers/statsLock.ts)
// makes it mutually exclusive with the other tests that also need these
// counters in a known state — without it, two such tests running at once
// would stomp on each other's before/after assertions.
test("restoreStatsFromSnapshot recovers counters after a simulated Redis wipe, but never lowers a live value", async () => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const { snapshotStats, restoreStatsFromSnapshot } = await loadStatsSnapshotModule();

  await withStatsLock(redis, async () => {
    const realCreated = (await redis.get("stats:secrets_created")) ?? "0";
    const realOpened = (await redis.get("stats:secrets_opened")) ?? "0";

    try {
      // Snapshot the real values, then simulate what a Redis restart does:
      // both counters come back at 0.
      await snapshotStats();
      await redis.set("stats:secrets_created", "0");
      await redis.set("stats:secrets_opened", "0");

      await restoreStatsFromSnapshot();

      // Not an exact match: withStatsLock only excludes the other tests
      // that also need these counters in a known state, not the many
      // unrelated tests elsewhere in the full suite that create secrets
      // (and so organically increment these same counters) without
      // holding it — a small tolerance absorbs that, an exact match
      // would flake on it.
      const createdRestored = Number(await redis.get("stats:secrets_created"));
      expect(createdRestored).toBeGreaterThanOrEqual(Number(realCreated));
      expect(createdRestored).toBeLessThan(Number(realCreated) + 20);
      const openedRestored = Number(await redis.get("stats:secrets_opened"));
      expect(openedRestored).toBeGreaterThanOrEqual(Number(realOpened));
      expect(openedRestored).toBeLessThan(Number(realOpened) + 20);

      // Never lowers a value that's already higher than the snapshot (a
      // real, currently-running instance's count must never be
      // overwritten by a stale backup).
      const higherValue = Number(realCreated) + 1000;
      await redis.set("stats:secrets_created", higherValue);
      await restoreStatsFromSnapshot();
      const createdAfterHigher = Number(await redis.get("stats:secrets_created"));
      expect(createdAfterHigher).toBeGreaterThanOrEqual(higherValue);
      expect(createdAfterHigher).toBeLessThan(higherValue + 20);
    } finally {
      await redis.set("stats:secrets_created", realCreated);
      await redis.set("stats:secrets_opened", realOpened);
      await snapshotStats();
    }
  });

  await redis.quit();
});

test("creating a secret updates the on-disk snapshot file", async ({ page }) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const secretText = `snapshot check ${Date.now()}`;

  await page.goto("/");
  await page.getByPlaceholder("Type it. Send it. Gone.").fill(secretText);
  await page.getByRole("button", { name: "Create secret" }).click();
  await expect(page.locator(".copy-row a")).toBeVisible();

  const expectedCreated = Number((await redis.get("stats:secrets_created")) ?? 0);
  await redis.quit();

  // The write happens fire-and-forget, after the response is already
  // sent (see app/api/secret/route.ts) — poll briefly rather than
  // asserting immediately.
  await expect(async () => {
    const snapshot = await readSnapshot();
    expect(snapshot?.secretsCreated).toBeGreaterThanOrEqual(expectedCreated);
  }).toPass({ timeout: 3000 });
});
