# Repository Guidelines

## Project Structure & Module Organization

This repository contains Parker Smith's personal site. Active development happens in `web/`, an Astro 5 site deployed to Cloudflare Pages. Source files live in `web/src/`: pages in `pages/`, shared UI in `components/`, layouts in `layouts/`, global styling in `styles/global.css`, and content collections in `content/posts/` and `content/travel/`. Static public assets and Cloudflare routing files live in `web/public/`.

The root `scripts/` directory contains one-shot migration utilities and `image-manifest.json`; treat these as migration/reference tooling unless you are working on content import or image upload. `quickstart/` is the old Hugo output/theme area and should not be the default place for new work.

## Build, Test, and Development Commands

Run site commands from `web/`:

```bash
npm run dev      # start Astro dev server at http://localhost:4321
npm run check    # run Astro/TypeScript validation
npm run build    # build the site and run the postbuild Hashnode CDN leak check
npm run preview  # preview the production build locally
```

For migration/image work from the repository root, use `node scripts/migrate-images.mjs` and `node scripts/upload-r2.mjs` only after confirming the intended asset destination.

## Coding Style & Naming Conventions

Use TypeScript, Astro components, and plain CSS following existing patterns. Prefer two-space indentation in `.astro`, `.ts`, `.mjs`, `.css`, and Markdown frontmatter. Name Astro components in PascalCase, such as `TravelMap.astro`; use lowercase route filenames and collection slugs, such as `travel/index.astro` or `berlin-germany.md`.

Keep content frontmatter aligned with `web/src/content/config.ts`. Travel entries require location metadata with city, country, latitude, and longitude.

## Testing Guidelines

There is no dedicated unit test suite. The required quality gates are:

```bash
cd web
npm run check
npm run build
```

`npm run build` also runs `web/scripts/check-no-hashnode.mjs`, which fails if generated output references `cdn.hashnode.com`. For UI changes, verify the affected page in `npm run dev` or `npm run preview`.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects under 72 characters, for example `Add travel map teaser` or `Fix RSS metadata`. Make one commit per logical change after verification, and confirm the current branch before the first commit in a session.

Pull requests should include a clear summary, rationale, linked issue or task ID when available, and screenshots for UI changes. Never delete remote branches without asking.

## Security & Configuration Tips

Images are served from Cloudflare R2 at `https://assets.psmith.dev/`; upload new images before referencing them in content. Keep redirects in `web/public/_redirects` current when moving or renaming public URLs.
