import { expect, test } from "@playwright/test";

test("robots.txt allows the public pages and blocks secrets/safety/api", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.ok()).toBe(true);
  const body = await response.text();

  expect(body).toMatch(/Allow:\s*\/\s*$/m);
  expect(body).toContain("Allow: /info");
  expect(body).toContain("Allow: /batch");
  expect(body).toContain("Disallow: /safety");
  expect(body).toContain("Disallow: /s/");
  expect(body).toContain("Disallow: /api/");
  expect(body).toContain("Sitemap:");
});

test("sitemap.xml lists the create, info, and batch pages, and nothing else", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const body = await response.text();

  expect(body).toContain("<loc>");
  expect(body.match(/<url>/g)?.length).toBe(3);
  expect(body).toMatch(/<loc>https?:\/\/[^<]*\/info<\/loc>/);
  expect(body).toMatch(/<loc>https?:\/\/[^<]*\/batch<\/loc>/);
  // Never a per-secret or safety-page URL — see robots.ts for why.
  expect(body).not.toContain("/safety");
  expect(body).not.toContain("/s/");
});

test("homepage has Open Graph and Twitter card metadata pointing at a generated image", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    /Selfdestruct/,
  );
  const ogImage = page.locator('meta[property="og:image"]');
  await expect(ogImage).toHaveAttribute("content", /opengraph-image/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );

  // The image itself actually renders, not just a broken/absent route.
  const ogImageUrl = await ogImage.getAttribute("content");
  const imageResponse = await page.request.get(ogImageUrl!);
  expect(imageResponse.ok()).toBe(true);
  expect(imageResponse.headers()["content-type"]).toBe("image/png");
});

test("a one-time secret link is noindex/nofollow, with a generic title that reveals nothing", async ({
  page,
}) => {
  await page.goto("/s/some-nonexistent-id-for-seo-check");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(page).toHaveTitle(/Selfdestruct/);
  // The title must never hint at specific content — always the same
  // generic string regardless of what (if anything) the link holds.
  await expect(page).toHaveTitle("Selfdestruct — one-time secret");
});

test("indexable pages have a self-referential canonical URL", async ({ page }) => {
  // Origin-agnostic, like the sitemap test above — SITE_URL (and so the
  // rendered canonical) doesn't necessarily match Playwright's own baseURL
  // in every environment this suite runs in.
  const cases: [string, RegExp][] = [
    ["/", /^https?:\/\/[^/]+\/?$/],
    ["/info", /^https?:\/\/[^/]+\/info\/?$/],
    ["/batch", /^https?:\/\/[^/]+\/batch\/?$/],
  ];

  for (const [path, pattern] of cases) {
    await page.goto(path);
    const href = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(href).toMatch(pattern);
  }
});

test("noindex pages carry no canonical tag at all", async ({ page }) => {
  // Both pages set `alternates: {}` explicitly for this — without it, Next
  // inherits the root layout's canonical ("/") wholesale, which would have
  // these pages falsely claim the homepage as their own canonical URL. See
  // the comment on each page's metadata export.
  for (const path of ["/safety", "/s/some-nonexistent-id-for-seo-check"]) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  }
});

test("homepage carries a valid WebSite JSON-LD block", async ({ page }) => {
  await page.goto("/");
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  const data = JSON.parse(raw!);

  expect(data["@type"]).toBe("WebSite");
  expect(data.name).toBe("Selfdestruct");
  expect(data.url).toBeTruthy();
});

test("info page's FAQPage JSON-LD matches the visible FAQ one-for-one", async ({ page }) => {
  await page.goto("/info");
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  const data = JSON.parse(raw!);

  expect(data["@type"]).toBe("FAQPage");
  const visibleCount = await page.locator(".faq-item").count();
  expect(data.mainEntity.length).toBe(visibleCount);
  // Spot-check the first question text matches what's actually on the page,
  // not just that the counts happen to line up.
  const firstVisibleQuestion = await page.locator(".faq-item summary").first().textContent();
  expect(data.mainEntity[0].name).toBe(firstVisibleQuestion);
});
