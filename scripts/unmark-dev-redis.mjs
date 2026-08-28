#!/usr/bin/env node
// Removes the marker set by mark-dev-redis.mjs. Run this immediately
// after a deliberate test session against a tunneled production Redis
// (see tests/global-setup.ts) -- the marker should never sit there
// indefinitely; leaving it set defeats the whole point of the guard.
import { config } from "dotenv";
import Redis from "ioredis";

config({ path: ".env.local", quiet: true });

const MARKER_KEY = "dev:redis-marker";

async function main() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.error("REDIS_URL is not set.");
    process.exitCode = 1;
    return;
  }

  const redis = new Redis(url);
  const removed = await redis.del(MARKER_KEY);
  await redis.quit();
  console.log(removed > 0 ? "Marker removed. Tests will refuse to run again until re-marked." : "No marker was set.");
}

main();
