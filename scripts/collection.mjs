import { readdir } from "node:fs/promises";
import path from "node:path";

const names = {
  "all-you-need-is-kill": "All You Need Is Kill",
  "arakawa-under-the-bridge": "Arakawa Under the Bridge",
  "dark-souls-3": "Dark Souls III",
  "cyberpunk-edgerunners": "Cyberpunk: Edgerunners",
  "elden-ring": "Elden Ring",
  "ergo-proxy": "Ergo Proxy",
  "nier-replicant": "NieR Replicant",
  AYNIK_the_duo: "The duo",
  "after-end-E": "After ending E",
};
const pretty = (value) =>
  names[value] ??
  value.replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());
export const urlPath = (value) =>
  value.split(path.sep).map(encodeURIComponent).join("/");

export async function discoverPairs(root, { onWarning = console.warn } = {}) {
  const pairs = [];
  async function visit(directory, relative = "") {
    const entries = (await readdir(directory, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name, "en", { numeric: true }),
    );
    const matches = new Map();
    for (const entry of entries) {
      if (entry.isDirectory())
        await visit(
          path.join(directory, entry.name),
          path.join(relative, entry.name),
        );
      if (!entry.isFile()) continue;
      const match = /^(light|dark)(-\d+)?\.(png|jpe?g|webp|avif)$/i.exec(
        entry.name,
      );
      if (!match) continue;
      const [, mode, suffix = ""] = match;
      const key = suffix.toLowerCase();
      const pair = matches.get(key) ?? {};
      if (pair[mode.toLowerCase()])
        throw new Error(
          `Duplicate ${mode} image in ${relative}, pair ${suffix || "1"}`,
        );
      pair[mode.toLowerCase()] = path.join(relative, entry.name);
      matches.set(key, pair);
    }
    for (const [suffix, files] of matches) {
      if (!files.light || !files.dark) {
        onWarning(
          `Skipping incomplete pair in ${relative}: ${suffix || "default"} needs both light and dark`,
        );
        continue;
      }
      const parts = relative.split(path.sep);
      const title = pretty(parts[0]);
      const detail = parts.slice(1).map(pretty);
      if (matches.size > 1 || suffix)
        detail.push(`Pair ${suffix.slice(1) || "1"}`);
      pairs.push({
        id: `${parts.join("/")}${suffix}`
          .replace(/[^a-z0-9/\-]/gi, "-")
          .toLowerCase()
          .replaceAll("/", "--"),
        title,
        detail: detail.join(" / "),
        category: title,
        files,
      });
    }
  }
  await visit(root);
  return pairs.sort((a, b) =>
    `${a.title} ${a.detail}`.localeCompare(`${b.title} ${b.detail}`, "en", {
      numeric: true,
    }),
  );
}
