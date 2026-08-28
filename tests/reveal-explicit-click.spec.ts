import { expect, test } from "@playwright/test";

test("reveal requires explicit click", async ({ page, context }) => {
  const secretText = `explicit-click test ${Date.now()}`;

  await page.goto("/");
  await page.getByPlaceholder("Type it. Send it. Gone.").fill(secretText);
  await page.getByRole("button", { name: "Create secret link" }).click();

  const href = await page.locator(".copy-row a").getAttribute("href");
  expect(href).toBeTruthy();

  // 1. Navigate directly to a valid secret link.
  const recipientContext = await context.browser()!.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(href!);

  // 2. Assert the secret content is NOT present in the page before any
  // click (i.e. it wasn't auto-fetched on load).
  await expect(recipientPage.locator("pre")).toHaveCount(0);
  await expect(recipientPage.getByText(secretText)).toHaveCount(0);

  // 3. Click "Reveal secret."
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();

  // 4. Assert the content now appears.
  await expect(recipientPage.locator("pre")).toHaveText(secretText);

  await recipientContext.close();
});
