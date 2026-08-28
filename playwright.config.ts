import { config } from "dotenv";
import { defineConfig } from "@playwright/test";

config({ path: ".env.local", quiet: true });

export default defineConfig({
  testDir: "./tests",
  // Refuses to run at all unless REDIS_URL points at a Redis explicitly
  // marked safe for testing -- see tests/global-setup.ts for the
  // incident that made this necessary.
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  // Slightly above the 30s default: a handful of tests share a Redis-backed
  // mutex over the global stats:* counters (tests/helpers/statsLock.ts) and
  // can queue behind each other under full parallelism.
  timeout: 45_000,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
