import { readFile, writeFile } from "node:fs/promises";
import { redis } from "./redis";

// The two aggregate usage counters (stats:secrets_created,
// stats:secrets_opened — see docs/SECURITY.md § Usage tracking without
// metadata) live in the same Redis instance as actual secret ciphertext,
// which has persistence deliberately disabled (docs/HARDENING_LOG.md §
// 14) so a restart wipes everything, counters included. That's the right
// call for secret data; it's just an unwanted side effect for these two
// harmless integers. Rather than touching Redis's own persistence (which
// would also make secret ciphertext durable — exactly what must never
// happen), this snapshots just the two counters to a small JSON file and
// restores from it once, at boot, if Redis comes back lower than the
// snapshot. The file only ever contains two integers — no IDs, no
// timestamps, no secret data — so it needs no special handling itself.
//
// Correctness note: this is a best-effort backup, not a second source of
// truth. Redis stays authoritative during normal operation (every read
// in this app comes from Redis, never this file); the file is only ever
// consulted once, at startup, to recover from a wipe. Concurrent writes
// to it aren't synchronized — a lost or overwritten snapshot write just
// means the next restore is off by a small, unimportant amount, never a
// correctness or security issue.
const SNAPSHOT_PATH = process.env.STATS_SNAPSHOT_PATH ?? ".stats-snapshot.json";

interface StatsSnapshot {
  secretsCreated: number;
  secretsOpened: number;
}

export async function restoreStatsFromSnapshot(): Promise<void> {
  let snapshot: StatsSnapshot;
  try {
    snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  } catch {
    return; // No snapshot yet — first boot, or nothing survived to restore.
  }

  const [created, opened] = await Promise.all([
    redis.get("stats:secrets_created"),
    redis.get("stats:secrets_opened"),
  ]);

  // Only ever raises the live value, never lowers it — a real, currently
  // running instance's count is never overwritten by a stale snapshot.
  if (Number(created ?? 0) < snapshot.secretsCreated) {
    await redis.set("stats:secrets_created", snapshot.secretsCreated);
  }
  if (Number(opened ?? 0) < snapshot.secretsOpened) {
    await redis.set("stats:secrets_opened", snapshot.secretsOpened);
  }
}

// Fire-and-forget by every caller (never awaited on the request's
// critical path) — losing a snapshot write must never slow down or fail
// an actual create/reveal, the same principle already applied to the
// stats counters themselves.
export async function snapshotStats(): Promise<void> {
  const [created, opened] = await Promise.all([
    redis.get("stats:secrets_created"),
    redis.get("stats:secrets_opened"),
  ]);
  const snapshot: StatsSnapshot = {
    secretsCreated: Number(created ?? 0),
    secretsOpened: Number(opened ?? 0),
  };
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot));
}
