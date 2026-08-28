import { expect, test } from "@playwright/test";

test("quick-exit is the first thing on the page, above the fold, on desktop and mobile", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 375, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/safety");

    const quickExit = page.getByRole("link", { name: "Leave this site now" });
    await expect(quickExit).toBeVisible();

    const box = await quickExit.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(viewport.height);

    // It must be the first element on the page — nothing else precedes it.
    const firstElementText = await page.evaluate(() => document.body.querySelector("main")?.firstElementChild?.textContent);
    expect(firstElementText).toBe("Leave this site now");
  }
});

test("quick-exit navigates instantly with no confirmation dialog", async ({ page }) => {
  await page.goto("/safety");

  // Stub the external neutral destination so the test doesn't depend on
  // real network access, while still proving a real cross-origin
  // navigation was triggered.
  await page.route("https://www.google.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>ok</body></html>" }),
  );

  let dialogFired = false;
  page.on("dialog", () => {
    dialogFired = true;
  });

  await page.getByRole("link", { name: "Leave this site now" }).click();
  await page.waitForURL("https://www.google.com/");

  expect(dialogFired).toBe(false);
});

test("safety page auto-exits after a few quiet minutes, with a warning pulse first", async ({
  page,
}) => {
  // Mocked clock so this doesn't require a real 5-minute wait — see
  // QuickExit.tsx's autoExitMinutes handling.
  await page.clock.install();
  await page.goto("/safety");

  let navigated = false;
  await page.route("https://www.google.com/**", (route) => {
    navigated = true;
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>ok</body></html>" });
  });

  const quickExit = page.getByRole("link", { name: "Leave this site now" });

  // Well before the warning window (60s left): no pulse yet.
  await page.clock.runFor("03:00");
  await expect(quickExit).not.toHaveClass(/quick-exit-urgent/);

  // Inside the last minute: the subtle pulse warning kicks in.
  await page.clock.runFor("01:30");
  await expect(quickExit).toHaveClass(/quick-exit-urgent/);

  // Full 5 minutes of inactivity elapsed: auto-exits, same destination and
  // no confirmation dialog as a manual click.
  let dialogFired = false;
  page.on("dialog", () => {
    dialogFired = true;
  });
  // The exit navigation tears down the frame the clock's CDP session is
  // attached to mid-call, which can surface as a rejected runFor promise
  // even though the navigation it triggered succeeded — that's the actual
  // thing under test here, so it's caught and ignored rather than treated
  // as a failure, and confirmed instead via the route flag below.
  await page.clock.runFor("01:00").catch(() => {});
  await expect.poll(() => navigated).toBe(true);
  expect(dialogFired).toBe(false);
});

test("any page activity resets the safety page's auto-exit timer", async ({ page }) => {
  await page.clock.install();
  await page.goto("/safety");

  await page.route("https://www.google.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>ok</body></html>" }),
  );

  // Get close to the deadline, then interact with the page — this should
  // push the deadline back out rather than let it fire.
  await page.clock.runFor("04:45");
  await page.mouse.move(10, 10);
  await page.clock.runFor("04:45");

  // Nearly 9:30 of mocked time has passed in total, well past the
  // original 5:00 deadline, but the reset means the page is still here.
  await expect(page.getByRole("link", { name: "Leave this site now" })).toBeVisible();
  expect(page.url()).toContain("/safety");
});

test("compact quick-exit in the header works the same way on the create and info pages", async ({
  page,
}) => {
  await page.route("https://www.google.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>ok</body></html>" }),
  );

  for (const path of ["/", "/info"]) {
    await page.goto(path);
    const quickExit = page.getByRole("link", { name: "Quick exit" });
    await expect(quickExit).toBeVisible();
    // Doesn't link to the dedicated safety page — it's a self-contained
    // exit action, not a pointer to /safety (which must stay undiscoverable).
    await expect(quickExit).not.toHaveAttribute("href", "/safety");

    await quickExit.click();
    await page.waitForURL("https://www.google.com/");
  }
});

test("safety page is not reachable within 2 clicks from the homepage", async ({ page }) => {
  async function linksOn(path: string): Promise<string[]> {
    await page.goto(path);
    const hrefs = await page.locator("a[href]").evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute("href") ?? ""),
    );
    return hrefs.filter((href) => href.startsWith("/"));
  }

  const depthOne = await linksOn("/");
  expect(depthOne).not.toContain("/safety");

  // Sequential, not Promise.all — a single Page can't navigate concurrently
  // with itself.
  const depthTwo: string[] = [];
  for (const href of depthOne) {
    depthTwo.push(...(await linksOn(href)));
  }
  expect(depthTwo).not.toContain("/safety");
});
