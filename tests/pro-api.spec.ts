import { createHash, randomBytes } from "crypto";
import { config } from "dotenv";
import Redis from "ioredis";
import { expect, test } from "@playwright/test";

config({ path: ".env.local", quiet: true });

// Mirrors lib/apiKeys.ts's hashing — deliberately reimplemented here rather
// than imported, the same way other specs talk to Redis directly instead
// of importing lib/redis.ts (keeps tests decoupled from the app's own
// module graph and its @/ path alias).
function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

async function issueTestKey(
  redis: Redis,
  overrides: Partial<{ maxExpiresIn: number; rateLimitMax: number; revoked: boolean }> = {},
): Promise<string> {
  const plaintext = "sk_live_" + randomBytes(24).toString("base64url");
  const record = {
    tier: "pro",
    note: "playwright test key",
    createdAt: new Date().toISOString(),
    revoked: overrides.revoked ?? false,
    maxExpiresIn: overrides.maxExpiresIn ?? 60 * 60 * 24 * 30,
    rateLimitMax: overrides.rateLimitMax ?? 500,
  };
  await redis.set(`apikey:${hashApiKey(plaintext)}`, JSON.stringify(record));
  return plaintext;
}

test("missing Authorization header is rejected", async ({ request }) => {
  const response = await request.post("/api/pro/secret", {
    data: { ciphertext: "abc", iv: "def", expiresIn: 300 },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toMatch(/Authorization/);
});

test("an invalid API key is rejected", async ({ request }) => {
  const response = await request.post("/api/pro/secret", {
    headers: { Authorization: "Bearer sk_live_not_a_real_key" },
    data: { ciphertext: "abc", iv: "def", expiresIn: 300 },
  });
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.error).toMatch(/Invalid or revoked/);
});

test("a revoked API key is rejected", async ({ request }) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis, { revoked: true });
  await redis.quit();

  const response = await request.post("/api/pro/secret", {
    headers: { Authorization: `Bearer ${key}` },
    data: { ciphertext: "abc", iv: "def", expiresIn: 300 },
  });
  expect(response.status()).toBe(401);
});

test("a valid key allows expiry beyond the free tier's 7-day cap", async ({ request }) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis);
  await redis.quit();

  const thirtyDays = 60 * 60 * 24 * 30;
  const response = await request.post("/api/pro/secret", {
    headers: { Authorization: `Bearer ${key}` },
    data: { ciphertext: "abc", iv: "def", expiresIn: thirtyDays },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.id).toBeTruthy();
});

test("expiry beyond a key's own maxExpiresIn is still rejected", async ({ request }) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis, { maxExpiresIn: 60 * 60 }); // 1 hour cap for this key
  await redis.quit();

  const response = await request.post("/api/pro/secret", {
    headers: { Authorization: `Bearer ${key}` },
    data: { ciphertext: "abc", iv: "def", expiresIn: 60 * 60 * 24 }, // 1 day, over the key's cap
  });
  expect(response.status()).toBe(400);
});

test("a Pro-created secret reveals and burns through the same endpoints as a free one", async ({
  page,
  request,
}) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis);
  await redis.quit();

  const secretText = `pro api test ${Date.now()}`;

  // 1. Encrypt client-side, the same way the create page does, then POST
  //    to the Pro endpoint directly (this is what an API integration would
  //    do — no browser UI involved).
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
    const rawKey = await crypto.subtle.exportKey("raw", key);
    const toB64Url = (buf: ArrayBuffer) =>
      btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return {
      ciphertext: toB64Url(ciphertextBuffer),
      iv: toB64Url(iv.buffer as ArrayBuffer),
      keyB64: toB64Url(rawKey),
    };
  }, secretText);

  const createResponse = await request.post("/api/pro/secret", {
    headers: { Authorization: `Bearer ${key}` },
    data: { ciphertext: cryptoResult.ciphertext, iv: cryptoResult.iv, expiresIn: 300 },
  });
  expect(createResponse.status()).toBe(200);
  const { id } = await createResponse.json();

  // 2. Reveal and burn through the ordinary reveal page — same secret:<id>
  //    schema, same atomic Lua script, no Pro-specific reveal path exists.
  const revealPage = await page.context().newPage();
  await revealPage.goto(`/s/${id}#${cryptoResult.keyB64}`);
  await revealPage.getByRole("button", { name: "Reveal secret" }).click();
  await expect(revealPage.locator("pre")).toHaveText(secretText);

  // 3. Confirm it's actually burned — second visit says gone, the same
  //    guarantee a free-tier secret gets.
  const secondVisit = await request.post(`/api/secret/${id}`, { data: {} });
  expect(secondVisit.status()).toBe(404);
});

test("a custom slug without a passphrase is rejected", async ({ request }) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis);
  await redis.quit();

  const response = await request.post("/api/pro/secret", {
    headers: { Authorization: `Bearer ${key}` },
    data: {
      ciphertext: "abc",
      iv: "def",
      expiresIn: 300,
      slug: `vanity-${Date.now()}`,
    },
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toMatch(/passphrase/i);
});

test("a malformed slug is rejected even with a passphrase", async ({ request }) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis);
  await redis.quit();

  const response = await request.post("/api/pro/secret", {
    headers: { Authorization: `Bearer ${key}` },
    data: {
      ciphertext: "abc",
      iv: "def",
      expiresIn: 300,
      passphraseHash: "somehash",
      slug: "not a valid slug!!",
    },
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.error).toMatch(/slug/i);
});

test("a custom slug with a passphrase creates a secret at that exact link", async ({
  request,
}) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis);
  await redis.quit();

  const slug = `vanity-${Date.now()}`;
  const response = await request.post("/api/pro/secret", {
    headers: { Authorization: `Bearer ${key}` },
    data: {
      ciphertext: "abc",
      iv: "def",
      expiresIn: 300,
      passphraseHash: "somehash",
      slug,
    },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.id).toBe(slug);
});

test("a slug that's already in use is rejected, not silently overwritten", async ({
  request,
}) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis);
  await redis.quit();

  const slug = `vanity-collision-${Date.now()}`;
  const payload = {
    ciphertext: "abc",
    iv: "def",
    expiresIn: 300,
    passphraseHash: "somehash",
    slug,
  };

  const first = await request.post("/api/pro/secret", {
    headers: { Authorization: `Bearer ${key}` },
    data: payload,
  });
  expect(first.status()).toBe(200);

  // A second request for the same slug — must not overwrite the first
  // secret still live under it (see the NX flag in the route).
  const second = await request.post("/api/pro/secret", {
    headers: { Authorization: `Bearer ${key}` },
    data: { ...payload, ciphertext: "different-ciphertext" },
  });
  expect(second.status()).toBe(409);

  // Confirm the original secret is genuinely intact, not overwritten.
  const check = await request.post(`/api/secret/${slug}`, {
    data: { passphraseHash: "somehash" },
  });
  expect(check.status()).toBe(200);
  const checkBody = await check.json();
  expect(checkBody.ciphertext).toBe("abc");
});

test("a Pro-created secret with a duress passphrase behaves identically to a free one", async ({
  page,
  request,
}) => {
  // Phase 8's own done-criteria calls this out specifically: branding or a
  // different creation surface must never weaken the duress guarantee.
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis);
  await redis.quit();

  const realText = `pro real secret ${Date.now()}`;
  const decoyText = `pro decoy ${Date.now()}`;

  await page.goto("/");
  const crypto1 = await page.evaluate(
    async ({ real, decoy }) => {
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);
      const toB64Url = (buf: ArrayBuffer) =>
        btoa(String.fromCharCode(...new Uint8Array(buf)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      const encrypt = async (text: string) => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertextBuffer = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          new TextEncoder().encode(text),
        );
        return { ciphertext: toB64Url(ciphertextBuffer), iv: toB64Url(iv.buffer as ArrayBuffer) };
      };
      const rawKey = await crypto.subtle.exportKey("raw", key);
      const realEnc = await encrypt(real);
      const decoyEnc = await encrypt(decoy);
      // Matches lib/crypto.ts's hashPassphrase: SHA-256, base64url-encoded
      // (not hex) — the same digest the real create page sends.
      const hashPassphrase = async (text: string) => {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return toB64Url(digest);
      };
      return {
        keyB64: toB64Url(rawKey),
        real: realEnc,
        decoy: decoyEnc,
        realPassphraseHash: await hashPassphrase("real-pass"),
        duressPassphraseHash: await hashPassphrase("duress-pass"),
      };
    },
    { real: realText, decoy: decoyText },
  );

  const createResponse = await request.post("/api/pro/secret", {
    headers: { Authorization: `Bearer ${key}` },
    data: {
      ciphertext: crypto1.real.ciphertext,
      iv: crypto1.real.iv,
      expiresIn: 300,
      passphraseHash: crypto1.realPassphraseHash,
      duress: {
        ciphertext: crypto1.decoy.ciphertext,
        iv: crypto1.decoy.iv,
        passphraseHash: crypto1.duressPassphraseHash,
      },
    },
  });
  expect(createResponse.status()).toBe(200);
  const { id } = await createResponse.json();

  // Duress passphrase: shows the decoy, silently burns the real secret.
  const revealPage = await page.context().newPage();
  await revealPage.goto(`/s/${id}#${crypto1.keyB64}`);
  await revealPage.getByRole("button", { name: "Reveal secret" }).click();
  await revealPage.getByPlaceholder("Passphrase").fill("duress-pass");
  await revealPage.getByRole("button", { name: "Reveal secret" }).click();
  await expect(revealPage.locator("pre")).toHaveText(decoyText);

  // Second visit: gone, same as any burned secret — no trace it was duress.
  const secondVisit = await request.post(`/api/secret/${id}`, { data: {} });
  expect(secondVisit.status()).toBe(404);
});
