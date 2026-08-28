// Runs once when the server starts, before it serves any requests — see
// lib/statsSnapshot.ts for why: this is what recovers the two aggregate
// usage counters after a Redis restart wipes them (Redis persistence is
// deliberately off for everything else it stores).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // fs/Redis need the Node runtime, not Edge
  const { restoreStatsFromSnapshot } = await import("./lib/statsSnapshot");
  await restoreStatsFromSnapshot();
}
