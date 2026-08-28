import { expect, test } from "@playwright/test";

test("create -> reveal -> confirm burned", async ({ page, context }) => {
  const secretText = `test secret ${Date.now()}`;

  // 1. Navigate to create page, enter a known string, submit.
  await page.goto("/");
  await page.getByPlaceholder("Type it. Send it. Gone.").fill(secretText);
  await page.getByRole("button", { name: "Create secret" }).click();

  // 2. Extract the generated link.
  const link = page.locator(".copy-row a");
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();

  // 3. Open the link in a new browser context (a genuinely separate visitor,
  // not just a new tab sharing the creator's state).
  const recipientContext = await context.browser()!.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(href!);

  // Must not auto-reveal: an explicit click is required.
  const revealButton = recipientPage.getByRole("button", { name: "Reveal secret" });
  await expect(revealButton).toBeVisible();
  await expect(recipientPage.locator("pre")).toHaveCount(0);

  // The reveal page carries the same header/quick-exit as the rest of the
  // site — a link recipient shouldn't land on a bare, unbranded page.
  await expect(recipientPage.getByRole("link", { name: "Quick exit" })).toBeVisible();

  await revealButton.click();

  // 4. Assert the revealed text matches what was entered.
  await expect(recipientPage.locator("pre")).toHaveText(secretText);
  await expect(recipientPage.getByRole("link", { name: "Quick exit" })).toBeVisible();

  // 5. Reload the same link in the same context.
  await recipientPage.reload();
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();

  // 6. Assert a "no longer exists" state is shown, not the secret.
  await expect(recipientPage.getByText("This secret no longer exists.")).toBeVisible();
  await expect(recipientPage.locator("pre")).toHaveCount(0);

  await recipientContext.close();
});
