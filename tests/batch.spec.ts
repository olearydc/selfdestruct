import { expect, test } from "@playwright/test";

test("batch create produces independent one-time links carrying the same message", async ({
  page,
  context,
}) => {
  const stamp = Date.now();
  const message = `same message to everyone ${stamp}`;

  await page.goto("/batch");
  await page
    .getByPlaceholder(/whatever the whole room needs/)
    .fill(message);

  // Default count is 3 — bring it down to 2 for a faster, still-meaningful
  // check that the two resulting links are genuinely independent.
  await page.getByRole("button", { name: "Fewer links" }).click();
  await expect(page.locator(".count-stepper-value")).toHaveText("2");

  await page.getByRole("button", { name: /Create 2 links/ }).click();

  const results = page.locator(".batch-result");
  await expect(results).toHaveCount(2);
  await expect(results.nth(0).locator(".batch-result-label")).toHaveText("Link 1");
  await expect(results.nth(1).locator(".batch-result-label")).toHaveText("Link 2");

  const hrefA = await results.nth(0).locator("a").getAttribute("href");
  const hrefB = await results.nth(1).locator("a").getAttribute("href");
  expect(hrefA).toBeTruthy();
  expect(hrefB).toBeTruthy();
  expect(hrefA).not.toBe(hrefB);

  // Reveal the first link as a separate visitor.
  const recipientContext = await context.browser()!.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(hrefA!);
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();
  await expect(recipientPage.locator("pre")).toHaveText(message);

  // The first link is now burned...
  await recipientPage.reload();
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();
  await expect(recipientPage.getByText("This secret no longer exists.")).toBeVisible();

  // ...but the second link still works and carries the same message,
  // proving these are two genuinely separate secrets, not one link shared
  // two ways.
  await recipientPage.goto(hrefB!);
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();
  await expect(recipientPage.locator("pre")).toHaveText(message);

  await recipientContext.close();
});

test("batch page has no passphrase field anywhere", async ({ page }) => {
  await page.goto("/batch");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test("a copied link shows 'Copied' then removes itself, leaving the rest in place", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-write"]);
  await page.goto("/batch");
  await page.getByPlaceholder(/whatever the whole room needs/).fill(`clipboard poof test ${Date.now()}`);
  await page.getByRole("button", { name: /Create 3 links/ }).click();

  const results = page.locator(".batch-result");
  await expect(results).toHaveCount(3);
  const firstHref = await results.nth(0).locator("a").getAttribute("href");
  const secondHref = await results.nth(1).locator("a").getAttribute("href");

  await results.nth(0).getByRole("button", { name: "Copy" }).click();
  await expect(results.nth(0).getByRole("button", { name: "Copied" })).toBeVisible();

  // Still 3 immediately after copying — it lingers showing "Copied"
  // before it clears itself, rather than vanishing the instant it's
  // clicked.
  await expect(results).toHaveCount(3);

  // It disappears on its own shortly after, and the link that was second
  // is now first — proving the list just closes up rather than leaving a
  // gap or reordering unexpectedly.
  await expect(results).toHaveCount(2, { timeout: 3000 });
  await expect(page.locator(".batch-result-label").first()).toHaveText("Link 1");
  await expect(results.nth(0).locator("a")).toHaveAttribute("href", secondHref!);

  const remainingHrefs = await results.locator("a").evaluateAll((els) =>
    els.map((el) => el.getAttribute("href")),
  );
  expect(remainingHrefs).not.toContain(firstHref);
});

test("the link-count stepper is bounded on both ends", async ({ page }) => {
  await page.goto("/batch");
  const fewer = page.getByRole("button", { name: "Fewer links" });
  const more = page.getByRole("button", { name: "More links" });
  const value = page.locator(".count-stepper-value");

  while (!(await fewer.isDisabled())) await fewer.click();
  await expect(value).toHaveText("2");

  while (!(await more.isDisabled())) await more.click();
  await expect(value).toHaveText("15");
});
