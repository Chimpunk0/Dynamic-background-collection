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
  await page.goto(url);
  await page.locator(".wallpaper").first().waitFor();
  const manifest = JSON.parse(
    await readFile(path.join(root, "collection.json")),
  );
  assert.equal(await page.locator(".wallpaper").count(), manifest.length);
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
  await page.locator("#close-viewer").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
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
