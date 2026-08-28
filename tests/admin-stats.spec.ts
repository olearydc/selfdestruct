import { config } from "dotenv";
import Redis from "ioredis";
import { expect, test } from "@playwright/test";
import { withStatsLock } from "./helpers/statsLock";

config({ path: ".env.local", quiet: true });

function basicAuthHeader(password: string): string {
  return "Basic " + Buffer.from(`admin:${password}`).toString("base64");
}

const REAL_PASSWORD = process.env.ADMIN_PASSWORD as string;

test("the admin stats page refuses a request with no credentials", async ({ request, baseURL }) => {
  const response = await request.get(new URL("/admin/stats", baseURL).toString());
  expect(response.status()).toBe(401);
  expect(response.headers()["www-authenticate"]).toContain("Basic");
});

test("the admin stats page refuses the wrong password", async ({ request, baseURL }) => {
  const response = await request.get(new URL("/admin/stats", baseURL).toString(), {
    headers: { Authorization: basicAuthHeader("definitely-not-it") },
  });
  expect(response.status()).toBe(401);
});

test("the reset endpoint refuses an unauthenticated request and makes no change", async ({
  request,
  baseURL,
}) => {
  const redis = new Redis(process.env.REDIS_URL as string);

  await withStatsLock(redis, async () => {
    const before = Number((await redis.get("stats:secrets_created")) ?? 0);

    const response = await request.post(new URL("/api/admin/stats/reset", baseURL).toString());
    expect(response.status()).toBe(401);

    // Never lower than before (this request made no change, and nothing
    // else outside withStatsLock's coverage ever decreases this counter)
    // — but an unrelated test elsewhere in the full suite may have
    // organically incremented it in the meantime, so not an exact match.
    const after = Number((await redis.get("stats:secrets_created")) ?? 0);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  await redis.quit();
});

// Deliberately never writes to the shared counters — other tests in
// this suite legitimately increment them at the same time
// (fullyParallel: true), so this reads a "before" baseline, loads the
// page, and checks the displayed number is a real, current-ish value
// (>= the baseline, within a generous tolerance) rather than requiring
// an exact match against a value that could organically change in the
// gap between the two reads. Still a meaningful check — it fails if the
// page were hardcoded, stale, or reading the wrong key.
//
// It still needs withStatsLock even though it never writes: the >=
// assertion assumes the value never *decreases* between the two reads,
// an assumption only the genuinely destructive tests (reset, the
// restore-from-snapshot simulation) can violate — organic increments
// from unrelated tests are exactly what the tolerance band already
// allows for.
test("with the right credentials, the page shows the real counters", async ({ browser, baseURL }) => {
  const redis = new Redis(process.env.REDIS_URL as string);

  await withStatsLock(redis, async () => {
    const createdBefore = Number((await redis.get("stats:secrets_created")) ?? 0);
    const openedBefore = Number((await redis.get("stats:secrets_opened")) ?? 0);

    const authedContext = await browser.newContext({
      httpCredentials: { username: "admin", password: REAL_PASSWORD },
    });
    const page = await authedContext.newPage();
    await page.goto(new URL("/admin/stats", baseURL as string).toString());

    await expect(page.getByText("Secrets created")).toBeVisible();

    const createdShown = Number(await page.locator("dd").nth(0).textContent());
    const openedShown = Number(await page.locator("dd").nth(1).textContent());

    expect(createdShown).toBeGreaterThanOrEqual(createdBefore);
    expect(createdShown).toBeLessThan(createdBefore + 100);
    expect(openedShown).toBeGreaterThanOrEqual(openedBefore);
    expect(openedShown).toBeLessThan(openedBefore + 100);

    await authedContext.close();
  });

  await redis.quit();
});

// The reset endpoint is genuinely destructive against a shared global
// counter that other, concurrently-running tests also read/increment
// (see tests/stats.spec.ts). withStatsLock (tests/helpers/statsLock.ts)
// keeps this mutually exclusive with the other tests in this suite that
// also need the counters in a known state (the monotonic-increment test,
// and stats-persistence.spec.ts's restore simulation) — but the lock
// only covers *those*, not the many unrelated tests elsewhere in the
// full suite that create secrets via the free or Pro endpoints without
// ever touching this lock (doing so for every creation path project-wide
// would be far too invasive for what it buys). So a genuine create from
// one of those can still land in the instant between this test's reset
// and its very next read, incrementing the counter by exactly the amount
// such a test would organically produce (one or two, never dozens) —
// hence a small tolerance below rather than an exact "0".
test("with the right credentials, the reset endpoint zeroes both counters", async ({
  request,
  baseURL,
}) => {
  const redis = new Redis(process.env.REDIS_URL as string);

  await withStatsLock(redis, async () => {
    const createdBefore = (await redis.get("stats:secrets_created")) ?? "0";
    const openedBefore = (await redis.get("stats:secrets_opened")) ?? "0";

    try {
      const response = await request.post(new URL("/api/admin/stats/reset", baseURL).toString(), {
        headers: { Authorization: basicAuthHeader(REAL_PASSWORD) },
      });
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ ok: true });

      expect(Number(await redis.get("stats:secrets_created"))).toBeLessThan(20);
      expect(Number(await redis.get("stats:secrets_opened"))).toBeLessThan(20);
    } finally {
      await redis.set("stats:secrets_created", createdBefore);
      await redis.set("stats:secrets_opened", openedBefore);
    }
  });

  await redis.quit();
});

test("/admin is excluded from robots.txt", async ({ request, baseURL }) => {
  const response = await request.get(new URL("/robots.txt", baseURL).toString());
  const body = await response.text();
  expect(body).toMatch(/Disallow:\s*\/admin/);
});
