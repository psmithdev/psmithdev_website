# psmith.dev

Parker Smith's personal website — travel logs (with an interactive map), woodworking/maker projects, and essays. Built with [Astro](https://astro.build) and deployed to [Cloudflare Workers](https://workers.cloudflare.com/) with images served from [Cloudflare R2](https://developers.cloudflare.com/r2/).

Live at **[psmith.dev](https://psmith.dev)**. Migrated from a Hugo + Hashnode site in May 2026; see [`CLAUDE.md`](./CLAUDE.md) for architecture details.

## Layout

```
psmithdev_website/
├── web/                 # the Astro site (almost all work happens here)
├── scripts/             # one-shot migration + authoring helper scripts
├── docs/                # authoring guides for new posts
└── CLAUDE.md            # architecture reference for AI assistants
```

## Local development

```bash
cd web
npm install              # one time
npm run dev              # http://localhost:4321
npm run build            # also runs the no-hashnode postbuild check
```

Deploys happen automatically on push to `main` via Cloudflare Workers Builds (see Cloudflare dashboard → Workers & Pages → `psmithdev` → Settings → Build).

## Adding content

- **Travel post** (lat/lng pin on the map): see [`docs/adding-travel-posts.md`](./docs/adding-travel-posts.md)
- **Essay, making, or tech post**: see [`docs/adding-posts.md`](./docs/adding-posts.md)

Both guides describe their respective helper script (`scripts/new-travel.mjs`, `scripts/new-post.mjs`) and walk through frontmatter, image upload to R2, drafts, and removals.

## Other scripts

| Script | When to use |
|---|---|
| `scripts/new-travel.mjs` | Scaffold a new travel post (auto-geocodes via OpenStreetMap) |
| `scripts/new-post.mjs` | Scaffold a new essay / making / tech post |
| `scripts/migrate-images.mjs` | Re-run the original Hashnode → local image migration (one-shot, kept for reference) |
| `scripts/upload-r2.mjs` | Sync local image cache to R2 (idempotent) |
| `scripts/migrate-content.mjs` | Re-run the original Hugo → Astro content migration (one-shot, kept for reference) |

## Architecture at a glance

- Content lives in two Astro collections: `posts` (essay / making / tech via a `category` field) and `travel` (carries lat/lng for the map).
- Images are served from `https://assets.psmith.dev/posts/<filename>` (Cloudflare R2 + custom domain).
- The travel map is MapLibre GL with Carto Positron raster tiles. The 1MB MapLibre bundle lazy-loads via `IntersectionObserver` so it only fetches when a map scrolls into view.
- URL parity from the old Hugo site is maintained via `web/public/_redirects`.
- Build-time guard in `web/scripts/check-no-hashnode.mjs` fails the build if any `cdn.hashnode.com` URLs leak into the output.

For more detail (schemas, deploy config, known gaps), see [`CLAUDE.md`](./CLAUDE.md).
