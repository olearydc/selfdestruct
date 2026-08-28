import { config } from "dotenv";
import Redis from "ioredis";
import { expect, test } from "@playwright/test";
import { withStatsLock } from "./helpers/statsLock";

config({ path: ".env.local", quiet: true });

// stats:secrets_created / stats:secrets_opened are global, shared counters
// (see lib/redis.ts and app/api/secret/route.ts) — other tests running in
// parallel increment them too, so this only asserts our own action's
// contribution landed (>= before + 1), not an exact value. Wrapped in
// withStatsLock so this monotonic assumption can't be violated by a
// genuinely destructive test (a reset, or a simulated-wipe test)
// temporarily setting the counters to an arbitrary lower value in the
// middle of this test's before/after window — see tests/helpers/statsLock.ts.
test("secrets_created and secrets_opened counters increment on real actions", async ({
  page,
  context,
}) => {
  const redis = new Redis(process.env.REDIS_URL as string);
  const secretText = `stats check ${Date.now()}`;

  await withStatsLock(redis, async () => {
    const createdBefore = Number((await redis.get("stats:secrets_created")) ?? 0);
    const openedBefore = Number((await redis.get("stats:secrets_opened")) ?? 0);

    await page.goto("/");
    await page.getByPlaceholder("Type it. Send it. Gone.").fill(secretText);
    await page.getByRole("button", { name: "Create secret" }).click();

    const link = page.locator(".copy-row a");
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");

    const createdAfter = Number((await redis.get("stats:secrets_created")) ?? 0);
    expect(createdAfter).toBeGreaterThanOrEqual(createdBefore + 1);

    const recipientContext = await context.browser()!.newContext();
    const recipientPage = await recipientContext.newPage();
    await recipientPage.goto(href!);
    await recipientPage.getByRole("button", { name: "Reveal secret" }).click();
    await expect(recipientPage.locator("pre")).toHaveText(secretText);

    const openedAfter = Number((await redis.get("stats:secrets_opened")) ?? 0);
    expect(openedAfter).toBeGreaterThanOrEqual(openedBefore + 1);

    await recipientContext.close();
  });

  await redis.quit();
});

// Not asserted via the global counter's value here — it's shared with
// every other test running concurrently (fullyParallel: true in
// playwright.config.ts), so a before/after equality check on it would be
// flaky by construction, not because of anything this feature does wrong.
// Instead this proves the same underlying property the counter itself
// relies on for correctness: burnSecret's INCR is co-located with its DEL
// inside the same Lua branches (lib/redis.ts), so "wrong passphrase never
// increments the counter" follows directly from "wrong passphrase never
// burns the secret" — which this test checks by confirming the secret is
// still genuinely revealable afterward with the real passphrase.
test("a wrong passphrase never burns the secret (and so never counts as an open)", async ({
  page,
  context,
}) => {
  const secretText = `stats wrong-passphrase check ${Date.now()}`;

  await page.goto("/");
  await page.getByPlaceholder("Type it. Send it. Gone.").fill(secretText);
  await page.getByLabel("Add a passphrase").check();
  await page.getByPlaceholder("Passphrase", { exact: true }).fill("correct-horse");
  await page.getByRole("button", { name: "Create secret" }).click();

  const link = page.locator(".copy-row a");
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");

  const recipientContext = await context.browser()!.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(href!);
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();
  await recipientPage.getByPlaceholder("Passphrase", { exact: true }).fill("wrong-guess");
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();
  await expect(recipientPage.getByText("That passphrase doesn't match.")).toBeVisible();

  // The real passphrase still works — proving the secret was never burned
  // by the wrong attempt above.
  await recipientPage.getByPlaceholder("Passphrase", { exact: true }).fill("correct-horse");
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();
  await expect(recipientPage.locator("pre")).toHaveText(secretText);

  await recipientContext.close();
});
