import { config } from "dotenv";
import Redis from "ioredis";
import { expect, test } from "@playwright/test";

config({ path: ".env.local", quiet: true });

test("failed decrypt does not burn the secret", async ({ page, context }) => {
  const secretText = `corrupted-fragment test ${Date.now()}`;

  // 1. Create a secret, get the link.
  await page.goto("/");
  await page.getByPlaceholder("Type it. Send it. Gone.").fill(secretText);
  await page.getByRole("button", { name: "Create secret link" }).click();
  const link = await page.locator(".copy-row a").getAttribute("href");
  expect(link).toBeTruthy();

  // 2. Corrupt the key fragment.
  const [base, key] = link!.split("#");
  const corruptedKey = key.slice(0, -4) + "xxxx";
  const corruptedLink = `${base}#${corruptedKey}`;

  // 3. Attempt to open — assert decryption fails gracefully.
  const ctx = await context.browser()!.newContext();
  const attemptPage = await ctx.newPage();
  await attemptPage.goto(corruptedLink);
  await attemptPage.getByRole("button", { name: "Reveal secret" }).click();
  await expect(attemptPage.getByText("Couldn't decrypt this secret")).toBeVisible();
  await expect(attemptPage.getByText(secretText)).toHaveCount(0);

  // 4. Open the original, uncorrupted link.
  const recipientPage = await ctx.newPage();
  await recipientPage.goto(link!);
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();

  // 5. Assert the secret is still there and reveals correctly.
  await expect(recipientPage.locator("pre")).toHaveText(secretText);

  await ctx.close();
});

test("expired-but-unopened secret is inaccessible", async ({ page, request }) => {
  const secretText = `expiry test ${Date.now()}`;

  await page.goto("/");
  const cryptoResult = await page.evaluate(async (text) => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(text),
    );
    const toB64Url = (buf: ArrayBuffer) =>
      btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return {
      ciphertext: toB64Url(ciphertextBuffer),
      iv: toB64Url(iv.buffer as ArrayBuffer),
    };
  }, secretText);

  // 1. Create a secret with the shortest real expiry the API allows.
  const createResponse = await request.post("/api/secret", {
    data: { ...cryptoResult, expiresIn: 60 },
  });
  const { id } = await createResponse.json();

  // 2. Wait past expiry — accelerated via a direct Redis connection
  // (PEXPIRE) rather than a real 60s sleep, but exercising the same TTL
  // mechanism Redis itself enforces, not a mocked application check.
  const redis = new Redis(process.env.REDIS_URL as string);
  await redis.pexpire(`secret:${id}`, 50);
  await new Promise((resolve) => setTimeout(resolve, 200));
  await redis.quit();

  // 3. Attempt to open the link.
  const response = await request.post(`/api/secret/${id}`, { data: {} });

  // 4. Assert "no longer exists" — not the secret content.
  expect(response.status()).toBe(404);
  const body = await response.json();
  expect(body.error).toBe("This secret no longer exists.");
});

test("malformed secret ID returns a clean 404, not a server error", async ({ request }) => {
  const malformedIds = [
    "not-a-real-id",
    "../../etc/passwd",
    "'; DROP TABLE secrets; --",
    "a".repeat(5000),
  ];

  for (const id of malformedIds) {
    const response = await request.post(`/api/secret/${encodeURIComponent(id)}`, {
      data: {},
    });
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("This secret no longer exists.");
  }
});

test("oversized payload rejected server-side", async ({ request }) => {
  const oversized = "x".repeat(200_000); // well over the 100KB cap

  const response = await request.post("/api/secret", {
    data: { ciphertext: oversized, iv: "aXY=", expiresIn: 300 },
  });

  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toMatch(/payload/i);
});
