# Adding a new travel post

Each travel entry is a single Markdown file in `web/src/content/travel/`. Filename → URL slug. Build is auto-deployed by Cloudflare Workers Builds on push to `main`.

A travel post can be either a **single-city** post (one pin on the map) or a **multi-stop trip** post (one post, multiple pins, all linking back to the same writeup). The helper script supports both modes.

## The fast path (helper script) — single city

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

## The fast path (helper script) — multi-stop trip

Pass `--title` and one `--stop` per city:

```bash
# auto-geocode each stop
node scripts/new-travel.mjs \
  --title "10 Days in China" \
  --slug china-2026 \
  --stop "Shenzhen,China" \
  --stop "Beijing,China" \
  --stop "Shanghai,China"

# or pass explicit coords per stop (skips geocoding)
node scripts/new-travel.mjs \
  --title "Iberian loop" \
  --slug iberian-loop \
  --stop "Lisbon,Portugal,38.7223,-9.1393" \
  --stop "Seville,Spain,37.3886,-5.9823" \
  --stop "Madrid,Spain,40.4168,-3.7038"
```

The trip becomes one post at `/travel/<slug>/` and **N pins on the map**, one per stop, all linking back to the post. The first stop is also written as `location:` for the post's primary marker.

## What the script does in both modes

- Writes `web/src/content/travel/<slug>.md` with frontmatter pre-filled
- Geocodes via OpenStreetMap Nominatim when lat/lng are omitted
- Refuses to overwrite an existing file (pass `--force` to clobber)
- Single-city slug defaults to `<city>-<country>`; trip slug defaults to slugified title; use `--slug` to override either
- Tags include `travel` and a deduplicated entry per country

## What the file looks like — single city

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

## What the file looks like — multi-stop trip

A trip post adds a `stops:` array. The schema requires the existing `location:` field too (one primary marker), but the **map renders one pin per entry in `stops:`** rather than the primary. Convention: set `location:` to the first stop.

```markdown
---
title: "10 Days in China: Shenzhen, Beijing, and Shanghai"
publishedAt: 2026-05-19
visitedAt: 2026-05-19
location:
  city: "Shenzhen"
  country: "China"
  lat: 22.5431
  lng: 114.0579
stops:
  - { city: "Shenzhen", country: "China", lat: 22.5431, lng: 114.0579 }
  - { city: "Beijing", country: "China", lat: 39.9042, lng: 116.4074 }
  - { city: "Shanghai", country: "China", lat: 31.2304, lng: 121.4737 }
tags:
  - travel
  - china
excerpt: "Two weeks across three cities."
cover: "https://assets.psmith.dev/posts/<sha256>.jpeg"
---

Trip notes here.
```

Each pin's popup will show the trip title and a sublabel for the specific city (e.g. "Beijing, China"). All three pins link to the same post URL.

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

Two patterns:

- **Separate posts per city** (existing pattern for Italy: Florence, Rome, Venice, etc.). Each is its own file, its own URL, its own pin. Use this when each city deserves its own writeup.
- **One trip post, multiple stops** (the `stops:` pattern above). Each stop is its own pin on the map, but they all link back to one writeup. Use this for a single trip across multiple cities that reads as one story.

Both can coexist — adding a multi-stop trip post doesn't conflict with existing single-city posts in the same country. The country shows up in:

- Filename (default): `<city>-<country>` for single, slugified title for trips.
- `location.country` field on the primary marker.
- Each stop's `country` field.
- `tags`: the script auto-adds `travel` and each unique country.

If you happen to revisit the same city, use `--slug` to disambiguate (e.g. `--slug rome-2024`).

## Removing or renaming a post

If you delete a file from `web/src/content/travel/`, the corresponding URL will 404 on the next deploy. To avoid broken inbound links:

1. Add a line to `web/public/_redirects` mapping the old path → new path (or `/travel/`):
   ```
   /travel/old-slug    /travel/new-slug/    301
   ```
2. Then delete (or rename) the source file.

Cloudflare Workers reads `_redirects` from the static asset directory and serves the 301 at the edge.
