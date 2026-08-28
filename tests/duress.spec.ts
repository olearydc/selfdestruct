import { expect, test } from "@playwright/test";

test("duress passphrase reveals decoy, burns real secret", async ({ page, context }) => {
  const realSecret = `real secret ${Date.now()}`;
  const decoyMessage = `decoy content ${Date.now()}`;
  const realPassphrase = "correct-horse-battery-staple";
  const duressPassphrase = "different-passphrase-entirely";

  // 1. Create a secret with both a real passphrase and a duress passphrase.
  await page.goto("/");
  await page.getByPlaceholder("Type it. Send it. Gone.").fill(realSecret);
  await page.getByLabel("Add a passphrase").check();
  await page.getByPlaceholder("Passphrase").fill(realPassphrase);
  await page.getByLabel("Duress passphrase").check();
  await page
    .getByPlaceholder("Duress passphrase (must differ from the real one)")
    .fill(duressPassphrase);
  await page
    .getByPlaceholder("Decoy message shown if the duress passphrase is entered")
    .fill(decoyMessage);
  await page.getByRole("button", { name: "Create secret link" }).click();

  const href = await page.locator(".copy-row a").getAttribute("href");
  expect(href).toBeTruthy();

  // 2. Open the link, enter the duress passphrase in the single field.
  const recipientContext = await context.browser()!.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(href!);
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();
  await recipientPage.getByPlaceholder("Passphrase").fill(duressPassphrase);
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();

  // 3. Assert the decoy content is shown, not the real secret.
  await expect(recipientPage.locator("pre")).toHaveText(decoyMessage);
  await expect(recipientPage.getByText(realSecret)).toHaveCount(0);

  // 4. Assert the underlying secret is now burned (a subsequent open with
  // the real passphrase also fails / shows "no longer exists").
  const secondAttemptContext = await context.browser()!.newContext();
  const secondAttemptPage = await secondAttemptContext.newPage();
  await secondAttemptPage.goto(href!);
  await secondAttemptPage.getByRole("button", { name: "Reveal secret" }).click();
  await expect(secondAttemptPage.getByText("This secret no longer exists.")).toBeVisible();

  // 5. Assert the reveal page's HTML/DOM contains no element, class name, or
  // attribute that distinguishes "duress mode" from a normal reveal.
  const html = await recipientPage.content();
  expect(html.toLowerCase()).not.toContain("duress");

  await recipientContext.close();
  await secondAttemptContext.close();
});

test("real passphrase reveal is structurally identical to a duress reveal", async ({
  page,
  context,
}) => {
  async function createAndReveal(useDuress: boolean) {
    const secretText = `secret ${useDuress ? "duress" : "real"} ${Date.now()}`;
    const decoyText = `decoy ${Date.now()}`;
    const realPassphrase = "shared-real-passphrase";
    const duressPassphrase = "shared-duress-passphrase";

    await page.goto("/");
    await page.getByPlaceholder("Type it. Send it. Gone.").fill(secretText);
    await page.getByLabel("Add a passphrase").check();
    await page.getByPlaceholder("Passphrase").fill(realPassphrase);
    await page.getByLabel("Duress passphrase").check();
    await page
      .getByPlaceholder("Duress passphrase (must differ from the real one)")
      .fill(duressPassphrase);
    await page
      .getByPlaceholder("Decoy message shown if the duress passphrase is entered")
      .fill(decoyText);
    await page.getByRole("button", { name: "Create secret link" }).click();
    const href = await page.locator(".copy-row a").getAttribute("href");

    const ctx = await context.browser()!.newContext();
    const p = await ctx.newPage();
    await p.goto(href!);
    await p.getByRole("button", { name: "Reveal secret" }).click();
    await p
      .getByPlaceholder("Passphrase")
      .fill(useDuress ? duressPassphrase : realPassphrase);
    await p.getByRole("button", { name: "Reveal secret" }).click();
    await p.locator("pre").waitFor();

    const html = (await p.locator("main").innerHTML()).replace(
      useDuress ? decoyText : secretText,
      "__SECRET__",
    );
    await ctx.close();
    return html;
  }

  const realHtml = await createAndReveal(false);
  const duressHtml = await createAndReveal(true);

  expect(realHtml).toBe(duressHtml);
});
