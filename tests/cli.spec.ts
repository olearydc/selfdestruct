import { createHash, randomBytes } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { config } from "dotenv";
import Redis from "ioredis";
import { expect, test } from "@playwright/test";

config({ path: ".env.local", quiet: true });

const execFileAsync = promisify(execFile);

function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

async function issueTestKey(redis: Redis): Promise<string> {
  const plaintext = "sk_live_" + randomBytes(24).toString("base64url");
  const record = {
    tier: "pro",
    note: "cli test key",
    createdAt: new Date().toISOString(),
    revoked: false,
    maxExpiresIn: 60 * 60 * 24 * 30,
    rateLimitMax: 500,
  };
  await redis.set(`apikey:${hashApiKey(plaintext)}`, JSON.stringify(record));
  return plaintext;
}

// Real end-to-end proof that cli/selfdestruct.mjs's Node-crypto encryption
// (AES-256-GCM via node:crypto) produces output the browser's WebCrypto
// decryptSecret (lib/crypto.ts) can actually read — not just that the CLI
// runs without crashing. Spawns the CLI as a real subprocess, then opens
// the link it prints in a real browser page.
test("a secret created via the CLI reveals correctly in a real browser", async ({
  page,
  baseURL,
}) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis);
  await redis.quit();

  const secretText = `cli test ${Date.now()}`;

  const { stdout } = await execFileAsync("node", ["cli/selfdestruct.mjs", "create", secretText], {
    env: { ...process.env, SELFDESTRUCT_API_KEY: key, SELFDESTRUCT_API_URL: baseURL },
  });

  const link = stdout.trim();
  expect(link).toMatch(/\/s\/.+#.+/);

  await page.goto(link);
  await page.getByRole("button", { name: "Reveal secret" }).click();
  await expect(page.locator("pre")).toHaveText(secretText);
});

test("the CLI's --slug requires --passphrase, same as the API itself", async ({ baseURL }) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis);
  await redis.quit();

  await expect(
    execFileAsync(
      "node",
      ["cli/selfdestruct.mjs", "create", "some text", "--slug", `cli-test-${Date.now()}`],
      { env: { ...process.env, SELFDESTRUCT_API_KEY: key, SELFDESTRUCT_API_URL: baseURL } },
    ),
  ).rejects.toThrow(/passphrase/i);
});

test("the CLI's --slug and --passphrase together create a vanity link that works", async ({
  page,
  baseURL,
}) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis);
  await redis.quit();

  const secretText = `cli slug test ${Date.now()}`;
  const slug = `cli-test-${Date.now()}`;

  const { stdout } = await execFileAsync(
    "node",
    ["cli/selfdestruct.mjs", "create", secretText, "--slug", slug, "--passphrase", "cli-pass"],
    { env: { ...process.env, SELFDESTRUCT_API_KEY: key, SELFDESTRUCT_API_URL: baseURL } },
  );

  const link = stdout.trim();
  expect(link).toContain(`/s/${slug}#`);

  await page.goto(link);
  await page.getByRole("button", { name: "Reveal secret" }).click();
  await page.getByPlaceholder("Passphrase").fill("cli-pass");
  await page.getByRole("button", { name: "Reveal secret" }).click();
  await expect(page.locator("pre")).toHaveText(secretText);
});

test("reading the secret from stdin works the same as passing it as an argument", async ({
  page,
  baseURL,
}) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const key = await issueTestKey(redis);
  await redis.quit();

  const secretText = `cli stdin test ${Date.now()}`;

  // execFile has no stdin hook, so this one case needs spawn directly
  // rather than the execFileAsync helper the other tests use.
  const { spawn } = await import("child_process");
  const proc = spawn("node", ["cli/selfdestruct.mjs", "create"], {
    env: { ...process.env, SELFDESTRUCT_API_KEY: key, SELFDESTRUCT_API_URL: baseURL },
  });
  proc.stdin.write(secretText + "\n");
  proc.stdin.end();

  const stdout = await new Promise<string>((resolve, reject) => {
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err))));
  });

  const link = stdout.trim();
  await page.goto(link);
  await page.getByRole("button", { name: "Reveal secret" }).click();
  await expect(page.locator("pre")).toHaveText(secretText);
});
