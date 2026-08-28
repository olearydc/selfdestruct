import { expect, test } from "@playwright/test";

// Origin is derived from the configured baseURL rather than hardcoded, so
// this holds against any environment the suite is pointed at (localhost in
// dev, the live production domain when verifying a real deploy).
function assertOnlySameOriginRequests(page: import("@playwright/test").Page, baseURL: string) {
  const sameOrigin = new URL(baseURL).origin;
  const foreignRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== sameOrigin) {
      foreignRequests.push(request.url());
    }
  });

  return () => foreignRequests;
}

test("no third-party requests on the create page", async ({ page, baseURL }) => {
  const getForeignRequests = assertOnlySameOriginRequests(page, baseURL!);
  await page.goto("/");
  await page.getByPlaceholder("Type it. Send it. Gone.").fill("network audit test");
  await page.getByRole("button", { name: "Create secret link" }).click();
  await page.locator(".copy-row a").waitFor();
  expect(getForeignRequests()).toEqual([]);
});

test("no third-party requests on the reveal page", async ({ page, context, baseURL }) => {
  await page.goto("/");
  await page.getByPlaceholder("Type it. Send it. Gone.").fill("network audit test 2");
  await page.getByRole("button", { name: "Create secret link" }).click();
  const href = await page.locator(".copy-row a").getAttribute("href");

  const recipientPage = await context.newPage();
  const getForeignRequests = assertOnlySameOriginRequests(recipientPage, baseURL!);
  await recipientPage.goto(href!);
  await recipientPage.getByRole("button", { name: "Reveal secret" }).click();
  await recipientPage.locator("pre").waitFor();
  expect(getForeignRequests()).toEqual([]);
});

test("Content-Security-Policy header present on every proxied page", async ({ request }) => {
  for (const path of ["/", "/s/nonexistent", "/info", "/safety", "/batch"]) {
    const response = await request.get(path);
    const csp = response.headers()["content-security-policy"];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  }
});
