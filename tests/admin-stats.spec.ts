import { config } from "dotenv";
import Redis from "ioredis";
import { expect, test } from "@playwright/test";

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
  const before = await redis.get("stats:secrets_created");

  const response = await request.post(new URL("/api/admin/stats/reset", baseURL).toString());
  expect(response.status()).toBe(401);

  const after = await redis.get("stats:secrets_created");
  expect(after).toBe(before);
  await redis.quit();
});

test("with the right credentials, the page shows the real counters", async ({ browser, baseURL }) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const created = Number((await redis.get("stats:secrets_created")) ?? 0);
  const opened = Number((await redis.get("stats:secrets_opened")) ?? 0);
  await redis.quit();

  const authedContext = await browser.newContext({
    httpCredentials: { username: "admin", password: REAL_PASSWORD },
  });
  const page = await authedContext.newPage();
  await page.goto(new URL("/admin/stats", baseURL as string).toString());

  await expect(page.getByText("Secrets created")).toBeVisible();
  await expect(page.locator("dd").nth(0)).toHaveText(String(created));
  await expect(page.locator("dd").nth(1)).toHaveText(String(opened));

  await authedContext.close();
});

// The reset endpoint is genuinely destructive against a shared global
// counter that other, concurrently-running tests also read/increment
// (see tests/stats.spec.ts). To avoid making those flaky, this captures
// the real values immediately before resetting and restores them
// immediately after confirming the reset worked — leaving only a
// single-request-round-trip window where the counters briefly read 0,
// rather than deleting real data for the rest of the suite run.
test("with the right credentials, the reset endpoint zeroes both counters", async ({
  request,
  baseURL,
}) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const createdBefore = (await redis.get("stats:secrets_created")) ?? "0";
  const openedBefore = (await redis.get("stats:secrets_opened")) ?? "0";

  try {
    const response = await request.post(new URL("/api/admin/stats/reset", baseURL).toString(), {
      headers: { Authorization: basicAuthHeader(REAL_PASSWORD) },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    expect(await redis.get("stats:secrets_created")).toBe("0");
    expect(await redis.get("stats:secrets_opened")).toBe("0");
  } finally {
    await redis.set("stats:secrets_created", createdBefore);
    await redis.set("stats:secrets_opened", openedBefore);
    await redis.quit();
  }
});

test("/admin is excluded from robots.txt", async ({ request, baseURL }) => {
  const response = await request.get(new URL("/robots.txt", baseURL).toString());
  const body = await response.text();
  expect(body).toMatch(/Disallow:\s*\/admin/);
});
