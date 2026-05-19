# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Parker Smith's personal website at **psmith.dev** — an Astro 5 static site on Cloudflare Pages. Content is travel logs (with an interactive map), woodworking/maker projects, personal essays, and the occasional tech post.

Migrated from a Hugo + Hashnode-export site in May 2026. See `/Users/parker/.claude/plans/i-want-to-overhaul-immutable-church.md` for the original rebuild plan.

## Layout

```
psmithdev_website/
├── web/                           # Astro site (this is where work happens)
│   ├── src/
│   │   ├── content/
│   │   │   ├── config.ts          # Zod schemas for `posts` + `travel` collections
│   │   │   ├── posts/             # Essays, making, tech (category field in frontmatter)
│   │   │   └── travel/            # Travel posts; carry `location: {city,country,lat,lng}`
│   │   ├── layouts/               # BaseLayout, PostLayout
│   │   ├── components/            # Header, Footer, TravelMap (MapLibre)
│   │   ├── pages/                 # index, posts/[slug], travel/[slug], essays, making, about, rss.xml
│   │   └── styles/global.css      # Warm/journal design tokens (terracotta accent, serif body)
│   ├── public/
│   │   ├── _redirects             # Cloudflare Pages — old Hugo URLs → new paths
│   │   └── favicon.svg
│   ├── scripts/check-no-hashnode.mjs   # postbuild guard: fails if cdn.hashnode.com leaks into dist/
│   ├── astro.config.mjs           # @astrojs/cloudflare adapter, static output, KaTeX
│   └── package.json
└── scripts/                       # One-shot migration scripts (kept for reference)
    ├── migrate-images.mjs         # Hashnode CDN → local .cache/images/
    ├── upload-r2.mjs              # .cache/images/ → R2 bucket via wrangler
    ├── migrate-content.mjs        # Hugo md + manifest → Astro content collections
    └── image-manifest.json        # sourceUrl → hash mapping (committed)
```

## Commands

```bash
cd web
npm run dev          # http://localhost:4321
npm run build        # also runs the no-hashnode postbuild check
npm run check        # astro type-check
```

## Architecture notes

- **Images live on Cloudflare R2** at `https://assets.psmith.dev/posts/<sha256>.<ext>`. The `cover` field in frontmatter and all body `![](...)` URLs point at R2. There is **no Astro `<Image>` / `astro:assets` processing** — covers use plain `<img>`. If you add new images, upload to R2 first and reference the public URL.
- **Two collections, one URL space.** `posts` collection renders at `/posts/<slug>/`; `travel` renders at `/travel/<slug>/`. Don't reuse a slug across both.
- **Travel map** (`src/components/TravelMap.astro`) reads the `travel` collection at build time and serializes pins into the page as JSON. MapLibre initializes lazily via `IntersectionObserver`. Carto Positron raster tiles (no API key).
- **`_redirects`** maintains parity for the 13 travel slugs that moved from `/posts/<city>/` to `/travel/<city>/` during the rebuild. If you rename or remove a post, add a redirect.
- **KaTeX** is wired (`remark-math` + `rehype-katex`) — `$...$` inline and `$$...$$` block work in any Markdown file.
- **No test suite.** Build success + the postbuild leak check are the quality gates.

## Deploying

Cloudflare Pages connected to `main`. Pushes deploy automatically; PRs get preview URLs.

To run a one-off image upload (e.g. after migrating fresh content):
```bash
node scripts/migrate-images.mjs                                        # download to .cache/images/
node scripts/upload-r2.mjs --bucket psmithdev-assets \
  --public-base https://assets.psmith.dev --prefix posts               # idempotent
```

## Known gaps

- Two `lh3.googleusercontent.com` images in `web/src/content/posts/bread.md` still point at Google's CDN (the original migrate-images regex required a file extension and Google URLs don't have one). They render fine but aren't owned. Migrate when convenient.
