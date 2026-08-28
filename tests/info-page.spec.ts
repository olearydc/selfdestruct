import { expect, test } from "@playwright/test";

test("mission briefing stage click updates the detail panel", async ({ page }) => {
  await page.goto("/info");

  const detail = page.locator(".stepper-detail");
  await expect(detail).toContainText("You type your secret into the create page");

  await page.getByRole("tab", { name: "3. Split-path travel" }).click();
  await expect(detail).toContainText("Only the ciphertext goes to the server");
});

test("FAQ item expands to reveal its answer", async ({ page }) => {
  await page.goto("/info");

  const item = page.locator("details.faq-item", { hasText: "Can you read my secret?" });
  await expect(item).not.toHaveAttribute("open", "");

  await item.locator("summary").click();
  await expect(item).toHaveAttribute("open", "");
  await expect(item).toContainText("All we ever receive is scrambled bytes");
});

test("create page header links to the info page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/info");
});

test("header brand links back to the create page", async ({ page }) => {
  await page.goto("/info");
  await expect(page.getByRole("link", { name: "Selfdestruct", exact: true })).toHaveAttribute("href", "/");
});

test("info page links to the source repository", async ({ page }) => {
  await page.goto("/info");
  await expect(page.getByRole("link", { name: "github.com/olearydc/selfdestruct" })).toHaveAttribute(
    "href",
    "https://github.com/olearydc/selfdestruct",
  );
});
