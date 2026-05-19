# Adding a new travel post

Each travel entry is a single Markdown file in `web/src/content/travel/`. Filename → URL slug. Build is auto-deployed by Cloudflare Workers Builds on push to `main`.

## The fast path (helper script)

```bash
# auto-geocode (fastest if the city name is unambiguous)
node scripts/new-travel.mjs "Lisbon" "Portugal"

# explicit lat/lng (better when geocoding picks the wrong "Springfield")
node scripts/new-travel.mjs "Madrid" "Spain" 40.4168 -3.7038

# multiple posts about the same city — use --slug to differentiate
node scripts/new-travel.mjs "Tokyo" "Japan" --slug tokyo-2024
node scripts/new-travel.mjs "Tokyo" "Japan" --slug tokyo-2026

# set the visit date (publish date defaults to today)
node scripts/new-travel.mjs --visited 2024-09-12 "Porto" "Portugal"
```

The script:
- Writes `web/src/content/travel/<slug>.md` with frontmatter pre-filled
- Geocodes via OpenStreetMap Nominatim if you skip lat/lng
- Refuses to overwrite an existing file (pass `--force` to clobber)
- Slug defaults to `<city>-<country>`; use `--slug` to override

## What the file looks like

After scaffolding, the file looks like this — fill in `excerpt`, uncomment `cover` once you've uploaded one, and write the body:

```markdown
---
title: "Lisbon, Portugal"
publishedAt: 2026-05-19
visitedAt: 2026-05-19
location:
  city: "Lisbon"
  country: "Portugal"
  lat: 38.7077
  lng: -9.1366
tags:
  - travel
  - portugal
excerpt: "A week of pastéis de nata and tiled facades."
cover: "https://assets.psmith.dev/posts/<sha256>.jpeg"
---

Notes from Lisbon. Markdown body goes here.

![A yellow tram on Rua do Almada](https://assets.psmith.dev/posts/<sha256>.jpeg)
```

Schema is enforced by `web/src/content/config.ts` — the build will fail loudly if anything's missing.

## Adding images

Cover images and inline body images both live on Cloudflare R2 at `assets.psmith.dev`. Two ways to upload:

**Wrangler CLI** (good for one-off uploads from the terminal):

```bash
cd web
npx wrangler r2 object put psmithdev-assets/posts/lisbon-tram.jpeg \
  --file ~/Pictures/lisbon-tram.jpeg \
  --content-type image/jpeg \
  --remote
```

Then reference it as `https://assets.psmith.dev/posts/lisbon-tram.jpeg`.

**R2 dashboard** (good when uploading multiple files at once): Cloudflare → R2 → `psmithdev-assets` → Upload, into the `posts/` prefix.

Filenames are up to you. Existing migrated images use `<sha256>.<ext>` for dedup; new uploads can use any descriptive name. Keep the `posts/` prefix to match the convention.

## Lat/lng gotchas

- Easiest way to get coordinates manually: Google Maps → right-click the spot → click the coords at the top of the menu to copy.
- Nominatim sometimes picks a weird coordinate for ambiguous names ("Cambridge UK" vs "Cambridge MA"). Always glance at the printed lat/lng after running the script. Re-run with explicit args if it's wrong.
- Don't batch 100 cities through the geocoder in a loop — Nominatim is a free OSM service and rate-limits. For a handful at a time, it's fine.

## Workflow for a batch of cities

1. Scaffold all the files: `node scripts/new-travel.mjs ...` per city
2. Open each file, write the body, fill in `excerpt`
3. Upload cover + body images to R2
4. Uncomment the `cover:` line in each, paste the URL
5. One commit for the batch, push
6. Cloudflare auto-builds and deploys; new pins appear on `/travel/` and the homepage map

## Multiple cities in the same country

The country shows up in three places:
- Filename (default): `florence-italy.md`, `rome-italy.md`, etc. — `<city>-<country>` is the natural slug pattern.
- `location.country` field: drives the popup text (e.g. "Florence, Italy").
- `tags`: the script auto-adds `travel` and `<country>` as tags.

Nothing about the schema or routing prevents multiple cities per country — every Italian city is its own pin and its own post. The only conflict is if you happen to revisit the same city; then use `--slug` to disambiguate (e.g. `--slug rome-2024`).

## Removing or renaming a post

If you delete a file from `web/src/content/travel/`, the corresponding URL will 404 on the next deploy. To avoid broken inbound links:

1. Add a line to `web/public/_redirects` mapping the old path → new path (or `/travel/`):
   ```
   /travel/old-slug    /travel/new-slug/    301
   ```
2. Then delete (or rename) the source file.

Cloudflare Workers reads `_redirects` from the static asset directory and serves the 301 at the edge.
