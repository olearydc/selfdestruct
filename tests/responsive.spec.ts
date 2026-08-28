import { expect, test, type Page } from "@playwright/test";

// Phase 6's responsive check: at least one desktop viewport, one mobile
// viewport, both light and dark mode, for all four pages (create, reveal,
// info, safety). Theming here is pure `prefers-color-scheme` (see
// app/globals.css) with no manual toggle, so emulateMedia({ colorScheme })
// exercises the real mechanism rather than a mocked one.
const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 667 }, // iPhone SE-class, the narrowest common target
} as const;

const THEMES = ["light", "dark"] as const;

// No horizontal scroll on any viewport — the one layout failure that's
// invisible in a plain screenshot review but breaks real phone use.
async function assertNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

// Confirms the theme actually switched, not just that the media query was
// requested — reads the real computed background rather than trusting
// emulateMedia silently no-opped.
async function assertThemeApplied(page: Page, theme: "light" | "dark") {
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = bg.match(/\d+/g)!.map(Number);
  const luminance = (r + g + b) / 3;
  if (theme === "dark") {
    expect(luminance).toBeLessThan(128);
  } else {
    expect(luminance).toBeGreaterThan(128);
  }
}

for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
  for (const theme of THEMES) {
    test.describe(`${viewportName} / ${theme}`, () => {
      test.use({ viewport, colorScheme: theme });

      test("create page renders without overflow, correct theme, CTA reachable", async ({
        page,
      }) => {
        await page.goto("/");
        await assertNoHorizontalOverflow(page);
        await assertThemeApplied(page, theme);
        await expect(page.getByRole("button", { name: "Create secret link" })).toBeVisible();
      });

      test("reveal page renders without overflow, correct theme, reveal button reachable", async ({
        page,
        context,
      }) => {
        const secretText = `responsive check ${Date.now()}`;
        await page.goto("/");
        await page.getByPlaceholder("Type it. Send it. Gone.").fill(secretText);
        await page.getByRole("button", { name: "Create secret link" }).click();
        const href = await page.locator(".copy-row a").getAttribute("href");

        const recipientContext = await context.browser()!.newContext({ viewport, colorScheme: theme });
        const recipientPage = await recipientContext.newPage();
        await recipientPage.goto(href!);
        await assertNoHorizontalOverflow(recipientPage);
        await assertThemeApplied(recipientPage, theme);
        await expect(recipientPage.getByRole("button", { name: "Reveal secret" })).toBeVisible();

        await recipientPage.getByRole("button", { name: "Reveal secret" }).click();
        await recipientPage.locator("pre").waitFor();
        await assertNoHorizontalOverflow(recipientPage);

        await recipientContext.close();
      });

      test("info page renders without overflow and correct theme", async ({ page }) => {
        await page.goto("/info");
        await assertNoHorizontalOverflow(page);
        await assertThemeApplied(page, theme);
      });

      test("safety page renders without overflow, correct theme, quick-exit reachable", async ({
        page,
      }) => {
        await page.goto("/safety");
        await assertNoHorizontalOverflow(page);
        await assertThemeApplied(page, theme);
        // The one element that must never be unreachable on this page, at
        // any viewport — see safety-page.spec.ts for the above-the-fold
        // assertion this deliberately doesn't duplicate.
        await expect(page.getByRole("link", { name: "Leave this site now" })).toBeVisible();
      });
    });
  }
}
