import { createHash, randomBytes } from "crypto";
import Redis from "ioredis";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

config({ path: ".env.local", quiet: true });

function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

async function issueTeamKey(redis: Redis, teamId: string, rateLimitMax: number): Promise<string> {
  const plaintext = "sk_live_" + randomBytes(24).toString("base64url");
  const record = {
    tier: "pro",
    note: "team seats test key",
    createdAt: new Date().toISOString(),
    revoked: false,
    maxExpiresIn: 60 * 60 * 24 * 30,
    rateLimitMax,
    teamId,
  };
  await redis.set(`apikey:${hashApiKey(plaintext)}`, JSON.stringify(record));
  return plaintext;
}

async function createSecret(baseURL: string, key: string) {
  return fetch(new URL("/api/pro/secret", baseURL), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      ciphertext: "ZmFrZQ",
      iv: "ZmFrZWl2MTIzNA",
      expiresIn: 3600,
    }),
  });
}

// Team seats (MONETISATION.md, phase-8-pro-tier.md): several keys sharing a
// teamId share one rate-limit pool. This is the entire mechanism — proves
// two independently-issued keys draw down the same shared allocation rather
// than each getting their own, without either key learning anything about
// what the other created.
test("two keys on the same team share one rate-limit pool", async ({ baseURL }) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const teamId = `test-team-${Date.now()}`;
  const keyA = await issueTeamKey(redis, teamId, 2);
  const keyB = await issueTeamKey(redis, teamId, 2);
  await redis.quit();

  const first = await createSecret(baseURL as string, keyA);
  expect(first.status).toBe(200);

  const second = await createSecret(baseURL as string, keyB);
  expect(second.status).toBe(200);

  // The pool (limit 2) is now exhausted, regardless of which key created
  // which of the first two secrets.
  const third = await createSecret(baseURL as string, keyA);
  expect(third.status).toBe(429);
  const fourth = await createSecret(baseURL as string, keyB);
  expect(fourth.status).toBe(429);
});

test("a solo (non-team) key's rate limit is unaffected by team pools", async ({ baseURL }) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const soloKey = "sk_live_" + randomBytes(24).toString("base64url");
  await redis.set(
    `apikey:${hashApiKey(soloKey)}`,
    JSON.stringify({
      tier: "pro",
      note: "solo test key",
      createdAt: new Date().toISOString(),
      revoked: false,
      maxExpiresIn: 60 * 60 * 24 * 30,
      rateLimitMax: 500,
    }),
  );
  await redis.quit();

  const response = await createSecret(baseURL as string, soloKey);
  expect(response.status).toBe(200);
});

// The design constraint from MONETISATION.md / phase-8-pro-tier.md: no
// endpoint should exist that can answer "what has this team/key sent."
// This asserts the absence by probing every plausible URL shape rather than
// by omission — a bug here would be a real endpoint appearing, not just a
// missing test.
test("no endpoint exists to list or audit what a team or key has sent", async ({ baseURL }) => {
  const teamId = "any-team";
  const candidatePaths = [
    `/api/pro/team/${teamId}`,
    `/api/pro/team/${teamId}/secrets`,
    `/api/pro/teams`,
    `/api/pro/secrets`,
    `/api/pro/history`,
    `/api/pro/audit`,
  ];

  for (const path of candidatePaths) {
    const response = await fetch(new URL(path, baseURL as string));
    expect(response.status, `${path} should not exist`).toBe(404);
  }
});
