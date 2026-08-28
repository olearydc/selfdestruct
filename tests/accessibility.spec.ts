import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// WCAG 2.1 AA baseline — see docs/OPEN_QUESTIONS.md. Scans every page in its
// default state; the create/reveal flow is also scanned mid-interaction
// (passphrase + duress fields expanded, secret revealed) since those states
// render markup an initial-load scan wouldn't catch.
//
// Reduced motion so a scan can't land mid-animation and flag a transient
// opacity/blur dip as a contrast failure — the trust-badge strip's
// self-destruct animation (see globals.css) already turns off under
// prefers-reduced-motion, same as the scroll itself, so this reflects real
// reduced-motion users' actual rendering rather than a timing accident.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function scan(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations;
}

test("home page has no WCAG 2.1 AA violations", async ({ page }) => {
  await page.goto("/");
  expect(await scan(page)).toEqual([]);
});

test("create page with passphrase and duress fields expanded has no violations", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Add a passphrase").check();
  await page.getByLabel("Duress passphrase").check();
  expect(await scan(page)).toEqual([]);
});

test("reveal page, before and after reveal, has no violations", async ({ page, context }) => {
  const secretText = `a11y check ${Date.now()}`;
  await page.goto("/");
  await page.getByPlaceholder("Type it. Send it. Gone.").fill(secretText);
  await page.getByRole("button", { name: "Create secret link" }).click();
  const href = await page.locator(".copy-row a").getAttribute("href");

  const recipientContext = await context.browser()!.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(href!);
  expect(await scan(recipientPage)).toEqual([]);

  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();
  await recipientPage.locator("pre").waitFor();
  expect(await scan(recipientPage)).toEqual([]);

  await recipientContext.close();
});

test("info page has no violations", async ({ page }) => {
  await page.goto("/info");
  expect(await scan(page)).toEqual([]);
});

test("info page has no violations with the FAQ and mission-briefing panel expanded", async ({ page }) => {
  await page.goto("/info");
  await page.getByRole("tab", { name: "4. Optional passphrase" }).click();
  await page.locator("details.faq-item").first().locator("summary").click();
  expect(await scan(page)).toEqual([]);
});

test("safety page has no violations", async ({ page }) => {
  await page.goto("/safety");
  expect(await scan(page)).toEqual([]);
});
