import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

// Serve under a repository prefix to exercise GitHub Pages project-site URLs.
const root = path.resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!pathname.startsWith("/collection/")) throw new Error("Not found");
    const file = path.resolve(
      root,
      pathname.slice("/collection/".length) || "index.html",
    );
    if (!file.startsWith(`${root}/`)) throw new Error("Not found");
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/collection/`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE_PATH
      ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-11-12T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-12T12:00:01Z"));
  await page.emulateMedia({ colorScheme: "dark" });
  // Legacy binary choices must not keep the new default stuck in an override.
  await page.addInitScript(() =>
    localStorage.setItem("website-theme", "light"),
  );
  await page.goto(url);
  await page.locator(".wallpaper").first().waitFor();
  // Website theme follows the device until a separate, persistent choice is made.
  const websiteTheme = () =>
    page.evaluate(() => document.documentElement.dataset.theme);
  assert.equal(await websiteTheme(), "dark");
  assert.equal(
    await page.locator("[data-theme-label]").textContent(),
    "System",
  );
  assert.equal(
    await page.locator("#theme-toggle img").getAttribute("src"),
    "brand.svg",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page
    .getByRole("button", { name: "Website theme: system. Switch to light" })
    .click();
  await page
    .getByRole("button", { name: "Website theme: light. Switch to dark" })
    .click();
  assert.equal(await websiteTheme(), "dark");
  assert.equal(
    await page
      .locator(":root")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(11, 11, 15)",
  );
  assert.equal(
    await page.locator('meta[name="theme-color"]').getAttribute("content"),
    "#0b0b0f",
  );
  assert.equal(
    await page
      .locator(".wallpaper img")
      .first()
      .evaluate((el) => getComputedStyle(el).filter),
    "none",
  );
  assert.equal(
    await page.locator("body").evaluate((el) => getComputedStyle(el).filter),
    "none",
  );
  await page.reload();
  await page.locator(".wallpaper").first().waitFor();
  assert.equal(await websiteTheme(), "dark");
  await page
    .getByRole("button", { name: "Website theme: dark. Switch to system" })
    .click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page.reload();
  await page.locator(".wallpaper").first().waitFor();
  assert.equal(
    await page.locator("[data-theme-label]").textContent(),
    "System",
  );
  await page
    .getByRole("button", { name: "Website theme: system. Switch to light" })
    .click();
  assert.equal(await websiteTheme(), "light");
  assert.equal(
    await page
      .locator(":root")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(244, 244, 240)",
  );
  await page
    .getByRole("button", { name: "Website theme: light. Switch to dark" })
    .click();

  const manifest = JSON.parse(
    await readFile(path.join(root, "collection.json")),
  );
  assert.equal(await page.locator(".wallpaper").count(), manifest.length);
  // The same visual mark must land on both endpoints without a duplicate logo.
  const bounds = (selector) => page.locator(selector).boundingBox();
  const scroll = async (y) => {
    await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
    await page.evaluate(() => dispatchEvent(new Event("scroll")));
    await page.clock.runFor(50);
  };
  const assertAligned = (actual, expected) => {
    for (const key of ["x", "y", "width", "height"])
      assert.ok(
        Math.abs(actual[key] - expected[key]) < 1.5,
        `${key}: ${actual[key]} vs ${expected[key]}`,
      );
  };
  // At the top, both desktop cards (including captions) fit in the viewport.
  for (const [width, height] of [
    [1440, 900],
    [1280, 720],
    [1920, 1080],
    [1920, 800],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await scroll(0);
    const card = await page.locator(".wallpaper").nth(1).boundingBox();
    assert.ok(
      card.y + card.height <= height,
      `First row clipped at ${width} × ${height}: bottom ${card.y + card.height}`,
    );
    assert.equal((await bounds(".header")).height, 77);
    assert.ok(
      await page
        .locator(".intro .hero-brand")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
  }
  assert.equal(
    await page.locator(".collection-status, #mode-description").count(),
    0,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await scroll(0);
  const fullMark = await bounds(".brand-morph");
  assertAligned(fullMark, await bounds(".hero-brand"));
  assert.equal(await page.locator(".header-note, .eyebrow").count(), 0);
  await scroll(120);
  const midway = await bounds(".brand-morph");
  assert.ok(midway.width < fullMark.width && midway.width > 150);
  await page.screenshot({ path: "/tmp/wallpaper-brand-midway.png" });
  await scroll(650);
  assertAligned(await bounds(".brand-morph"), await bounds(".header .brand"));
  await page.screenshot({ path: "/tmp/wallpaper-brand-compact.png" });
  await scroll(0);
  assertAligned(await bounds(".brand-morph"), fullMark);

  // Ensure every generated asset and download exists, not just visible lazy images.
  for (const item of manifest)
    for (const mode of ["light", "dark"])
      for (const field of ["thumbnail", "preview", "original"]) {
        assert.ok(
          (await stat(path.join(root, decodeURIComponent(item[mode][field]))))
            .size > 0,
        );
      }
  const phase = () =>
    page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--dark-opacity"),
    );
  const choose = (mode) =>
    page.locator(`.toolbar [data-mode="${mode}"]`).click();
  await choose("dark");
  assert.equal(await phase(), "1");
  await choose("light");
  assert.equal(await phase(), "0");
  await page.emulateMedia({ colorScheme: "dark" });
  await choose("system");
  assert.equal(await phase(), "1");
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(
    () =>
      document.documentElement.style.getPropertyValue("--dark-opacity") === "0",
  );
  await choose("dynamic");
  await page.clock.runFor(4999);
  assert.equal(await phase(), "0");
  await page.clock.runFor(1);
  assert.equal(await phase(), "1");
  await page.clock.runFor(5000);
  assert.equal(await phase(), "0");
  await page.clock.runFor(1500);
  // Image layers implement an actual opacity transition, not a hard source swap.
  assert.equal(
    await page
      .locator(".dark-layer")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "1.4s",
  );
  for (const card of await page.locator(".wallpaper").all()) {
    await card.scrollIntoViewIfNeeded();
    await card
      .locator("img")
      .evaluateAll((images) =>
        Promise.all(images.map((image) => image.decode())),
      );
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "/tmp/wallpaper-gallery-desktop.png" });
  const first = page.locator(".open-wallpaper").first();
  await first.click();
  assert.equal(await page.locator("#viewer").evaluate((el) => el.open), true);
  assert.equal(
    await page
      .locator("#viewer")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgb(11, 11, 15)",
  );
  assert.equal(
    await page
      .locator("#viewer-light")
      .evaluate((el) => getComputedStyle(el).filter),
    "none",
  );

  assert.equal(
    await page
      .locator(".viewer-stage")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    "rgba(0, 0, 0, 0)",
  );
  await page.waitForFunction(
    () => document.querySelector("#preview-status").textContent === "",
  );
  assert.equal(
    await page.locator("#download-light").getAttribute("href"),
    manifest[0].light.original,
  );
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page.locator("#viewer-title").textContent(),
    manifest.at(-1).title,
  );
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.locator("#viewer-title").textContent(),
    manifest[0].title,
  );
  await page.waitForFunction(
    () => document.querySelector("#preview-status").textContent === "",
  );
  assert.equal(
    await page.locator("#close-viewer .letter").textContent(),
    "Esc",
  );
  assert.equal(
    await page.locator("#close-viewer").getAttribute("aria-keyshortcuts"),
    "Escape",
  );
  assert.ok(!(await page.locator("#close-viewer").textContent()).includes("×"));
  await page.screenshot({ path: "/tmp/wallpaper-gallery-viewer.png" });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#viewer").evaluate((el) => el.open), false);
  assert.equal(
    await first.evaluate((el) => el === document.activeElement),
    true,
  );
  await page.selectOption("#category", "Elden Ring");
  assert.equal(
    await page.locator(".wallpaper").count(),
    manifest.filter((item) => item.category === "Elden Ring").length,
  );
  await choose("dark");
  await page.reload();
  await page.locator(".wallpaper").first().waitFor();
  assert.equal(await phase(), "1");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal((await bounds(".header")).height, 60);
  await scroll(0);
  assertAligned(await bounds(".brand-morph"), await bounds(".hero-brand"));
  await page.screenshot({ path: "/tmp/wallpaper-brand-mobile.png" });
  await scroll(650);
  assertAligned(await bounds(".brand-morph"), await bounds(".header .brand"));
  await scroll(0);

  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "/tmp/wallpaper-gallery-mobile.png",
    fullPage: true,
  });
  await page.locator(".open-wallpaper").first().click();
  await page.waitForFunction(
    () => document.querySelector("#preview-status").textContent === "",
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector("#viewer").scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: "/tmp/wallpaper-gallery-mobile-viewer.png" });
  await page.locator("#close-viewer .keycap").click();
  assert.equal(await page.locator("#viewer").evaluate((el) => el.open), false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("has-brand-morph"),
  );
  assert.equal(await page.locator(".brand-morph").isVisible(), false);
  assert.equal(
    await page
      .locator(".hero-brand")
      .evaluate((el) => getComputedStyle(el).opacity),
    "1",
  );

  assert.equal(
    await page
      .locator(".dark-layer")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  assert.deepEqual(errors, []);
  // A failed manifest request must leave a useful visible error.
  await page.route("**/collection.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.reload();
  await page.waitForFunction(() =>
    document
      .querySelector("#load-status")
      .textContent.includes("couldn’t load"),
  );
  console.log(
    `Browser checks passed: ${manifest.length} pairs, assets, project URL prefix, all modes, 5-second cycle, navigation, focus, downloads, filters, persistence, mobile, reduced motion, and loading errors.`,
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
