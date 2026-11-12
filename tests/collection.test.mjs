import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverPairs, urlPath } from "../scripts/collection.mjs";

async function fixture(t, files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "wallpaper-pairs-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of files) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), "");
  }
  return root;
}
test("matches numbered variants and mixed formats without crossing folders", async (t) => {
  const root = await fixture(t, [
    "game/light.jpg",
    "game/dark.png",
    "game/light-2.png",
    "game/dark-2.jpg",
    "game/alternate/light.png",
    "game/alternate/dark.png",
    "game/notes.txt",
  ]);
  const pairs = await discoverPairs(root);
  assert.equal(pairs.length, 3);
  assert.equal(new Set(pairs.map((p) => p.id)).size, 3);
  const numbered = pairs.find((p) => p.detail === "Pair 2");
  assert.equal(numbered.files.light, "game/light-2.png");
  assert.equal(numbered.files.dark, "game/dark-2.jpg");
});
test("skips unmatched images with warnings rather than crossing pair suffixes", async (t) => {
  const root = await fixture(t, ["game/light.png", "game/dark-2.png"]);
  const warnings = [];
  assert.deepEqual(
    await discoverPairs(root, {
      onWarning: (message) => warnings.push(message),
    }),
    [],
  );
  assert.equal(warnings.length, 2);
  assert.ok(
    warnings.every((message) => message.includes("Skipping incomplete pair")),
  );
});
test("refuses ambiguous duplicate formats", async (t) => {
  const root = await fixture(t, [
    "game/light.png",
    "game/light.jpg",
    "game/dark.png",
  ]);
  await assert.rejects(discoverPairs(root), /Duplicate light/);
});
test("encodes URL path components without removing folder boundaries", () => {
  assert.equal(urlPath("a folder/name#1.png"), "a%20folder/name%231.png");
});
