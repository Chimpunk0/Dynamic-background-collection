# Dynamic Wallpaper Gallery

A collection of paired light and dark desktop backgrounds, with static web gallery.
Web gallery link: [Here](https://chimpunk0.github.io/Dynamic-background-collection/)

## Features

- Full-screen previews with arrow-key navigation, Escape to close, and original light and dark downloads. Filter the gallery by collection.
- WebP thumbnails up to 960px wide and previews up to 1920px wide. Original files remain untouched.

## Adding wallpapers

Add pairs under `individual-images/<collection>/`:

- Name counterparts `light.<ext>` and `dark.<ext>`. Mixed `.png`, `.jpg`, `.jpeg`, `.webp`, and `.avif` formats are supported.
- Numbered variants such as `light-2.jpg` and `dark-2.png` match by suffix within the same folder.
- Nested folders are supported. Unrelated screenshots are ignored in the gallery.

New pairs are discovered on every build. Incomplete pairs are skipped with a warning until both images are present. The build fails if multiple formats compete for the same light or dark image.

## Local development

Requires Node.js 22 or later and Python 3 for the local preview server.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4173. There is no hot reload; stop the server and rerun after changes. `npm run build` generates the ignored `dist/` directory from `site/` and the source images using `scripts/build.mjs`.

`npm test` checks pairing logic. For browser checks:

```sh
npm run build
npx playwright install chromium
npm run test:browser
```

## GitHub Pages

The workflow in `.github/workflows/pages.yml` installs dependencies, runs pairing checks, builds the gallery, and deploys `dist/` using the official Pages actions. It runs on pushes to `main` and can also be triggered manually.

## Growing beyond Pages storage

GitHub Pages has a [1 GB published-site limit](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). You can keep the viewer there while storing originals elsewhere.

Mirror the contents of `individual-images/` to an HTTPS host, preserving relative paths. Set the repository Actions variable `WALLPAPER_BASE_URL` to that mirror's base URL, or test locally:

```sh
WALLPAPER_BASE_URL=https://images.example.com/wallpapers npm run build
```

The build then omits original copies from `dist/` and links downloads to the mirror. Optimized previews stay local and must still fit Pages limits. Source images remain necessary for builds; this setting does %not shrink Git history or verify that the mirror is available. Cross-origin downloads may open the image instead of saving it, depending on the host's response headers.
