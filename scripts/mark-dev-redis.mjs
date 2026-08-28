#!/usr/bin/env node
// Marks the Redis instance at REDIS_URL as safe for the test suite to
// run destructive operations against (see tests/global-setup.ts for
// why this exists and the incident that prompted it).
//
// NEVER run this against production or anything tunneled to it — doing
// so defeats the entire point of the guard. This prints the resolved
// host so you can double-check before confirming.
import { createInterface } from "node:readline/promises";
import { config } from "dotenv";
import Redis from "ioredis";

config({ path: ".env.local", quiet: true });

const MARKER_KEY = "dev:redis-marker";
const MARKER_VALUE = "this-is-a-throwaway-dev-or-test-redis-instance";

async function main() {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.error("REDIS_URL is not set.");
    process.exitCode = 1;
    return;
  }

  const redacted = url.replace(/:\/\/[^@]*@/, "://***@");
  console.log(`This will mark the Redis at ${redacted} as safe for destructive test runs.`);
  console.log("Only do this for a genuine throwaway dev/test Redis -- never production.\n");

  // --yes skips the interactive prompt, for CI's own ephemeral Redis
  // service container -- not intended for a human running this locally,
  // where the confirmation step is the point.
  if (!process.argv.includes("--yes")) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type "yes" to confirm this is NOT production: ');
    rl.close();

    if (answer.trim().toLowerCase() !== "yes") {
      console.log("Not confirmed -- nothing changed.");
      return;
    }
  }

  const redis = new Redis(url);
  await redis.set(MARKER_KEY, MARKER_VALUE);
  await redis.quit();
  console.log("Marked. The test suite will now run against this instance.");
}

main();
