import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { discoverPairs, urlPath } from "./collection.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");
const source = path.join(root, "individual-images");
// Set this to the public URL of a mirror of individual-images to host originals elsewhere.
const externalBase = process.env.WALLPAPER_BASE_URL?.replace(/\/$/, "");
if (externalBase && !/^https:\/\//.test(externalBase))
  throw new Error("WALLPAPER_BASE_URL must be an HTTPS URL");
const pairs = await discoverPairs(source);
if (!pairs.length) throw new Error("No wallpaper pairs found");
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "images"), { recursive: true });
await cp(path.join(root, "site"), output, { recursive: true });
const manifest = [];
for (const pair of pairs) {
  const item = {
    id: pair.id,
    title: pair.title,
    detail: pair.detail,
    category: pair.category,
  };
  for (const mode of ["light", "dark"]) {
    const relative = pair.files[mode];
    const input = path.join(source, relative);
    const metadata = await sharp(input).metadata();
    const thumbnail = `images/${pair.id}-${mode}-thumb.webp`;
    const preview = `images/${pair.id}-${mode}-preview.webp`;
    await sharp(input)
      .rotate()
      .resize({ width: 960, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(path.join(output, thumbnail));
    await sharp(input)
      .rotate()
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 88 })
      .toFile(path.join(output, preview));
    if (!externalBase) {
      const destination = path.join(output, "originals", relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(input, destination);
    }
    item[mode] = {
      thumbnail,
      preview,
      original: externalBase
        ? `${externalBase}/${urlPath(relative)}`
        : `originals/${urlPath(relative)}`,
      width: metadata.autoOrient.width,
      height: metadata.autoOrient.height,
    };
  }
  manifest.push(item);
}
await writeFile(
  path.join(output, "collection.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(path.join(output, ".nojekyll"), "");
console.log(
  `Built ${manifest.length} pairs in dist/ (${externalBase ? "external" : "local"} originals).`,
);
