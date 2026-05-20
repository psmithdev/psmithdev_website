#!/usr/bin/env node
// Scaffold a new travel post — single-city OR multi-stop trip.
//
// Single-city usage:
//   node scripts/new-travel.mjs "Lisbon" "Portugal"
//   node scripts/new-travel.mjs "Lisbon" "Portugal" 38.7223 -9.1393
//   node scripts/new-travel.mjs "Lisbon" "Portugal" --slug lisbon-trip-2024
//   node scripts/new-travel.mjs --visited 2025-09-12 "Lisbon" "Portugal"
//
// Multi-stop trip usage (one --stop per city, repeated):
//   node scripts/new-travel.mjs \
//     --title "10 Days in China" \
//     --slug china-2026 \
//     --stop "Shenzhen,China" \
//     --stop "Beijing,China" \
//     --stop "Shanghai,China"
//
// You can also pass explicit coords in a --stop to skip geocoding:
//   --stop "Shenzhen,China,22.5431,114.0579"
//
// Behavior:
//   - Slug defaults to `<city>-<country>` (single mode) or slugify(title) (trip mode).
//   - lat/lng auto-fetched via OpenStreetMap Nominatim when omitted (rate-limited;
//     don't run in a tight loop for hundreds of cities).
//   - Refuses to overwrite an existing file unless --force is passed.
//   - publishedAt defaults to today; --visited overrides visitedAt.

import { writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '../web/src/content/travel');

const argv = process.argv.slice(2);
const flags = {
  force: false,
  slug: null,
  visited: null,
  title: null,
  stops: [], // raw "City,Country" or "City,Country,lat,lng"
};
const positional = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--force') flags.force = true;
  else if (a === '--slug') flags.slug = argv[++i];
  else if (a === '--visited') flags.visited = argv[++i];
  else if (a === '--title') flags.title = argv[++i];
  else if (a === '--stop') flags.stops.push(argv[++i]);
  else positional.push(a);
}

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function yamlString(s) {
  if (/[:#\[\]{}&*!|>'"%@`,\n]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return `"${s}"`;
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function geocode(city, country) {
  const q = encodeURIComponent(`${city}, ${country}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'psmithdev-website/1.0 (https://psmith.dev)' },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = await res.json();
  if (!data.length) throw new Error(`No geocoding result for "${city}, ${country}"`);
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
}

async function parseStop(spec) {
  const parts = spec.split(',').map((p) => p.trim());
  if (parts.length === 2) {
    const [city, country] = parts;
    console.log(`Geocoding "${city}, ${country}" via Nominatim…`);
    const { lat, lng } = await geocode(city, country);
    console.log(`  → ${lat}, ${lng}`);
    return { city, country, lat, lng };
  }
  if (parts.length === 4) {
    const [city, country, lat, lng] = parts;
    return { city, country, lat: Number(lat), lng: Number(lng) };
  }
  throw new Error(`--stop expects "City,Country" or "City,Country,lat,lng" (got "${spec}")`);
}

const today = new Date().toISOString().slice(0, 10);
const visited = flags.visited ?? today;

(async () => {
  // Mode: multi-stop trip
  if (flags.stops.length > 0) {
    const title = flags.title ?? (positional[0] || null);
    if (!title) {
      console.error('Multi-stop mode needs --title "Trip title" (or a positional title arg).');
      process.exit(1);
    }
    const slug = slugify(flags.slug ?? title);
    const outPath = join(OUT_DIR, `${slug}.md`);

    if (await exists(outPath) && !flags.force) {
      console.error(`Refusing to overwrite ${outPath} (pass --force to clobber)`);
      process.exit(1);
    }

    const stops = [];
    for (const spec of flags.stops) stops.push(await parseStop(spec));

    const primary = stops[0];
    const countries = [...new Set(stops.map((s) => slugify(s.country)))];
    const tags = ['travel', ...countries];

    const stopsYaml = stops
      .map(
        (s) =>
          `  - { city: ${yamlString(s.city)}, country: ${yamlString(s.country)}, lat: ${s.lat}, lng: ${s.lng} }`
      )
      .join('\n');

    const content = `---
title: ${yamlString(title)}
publishedAt: ${today}
visitedAt: ${visited}
location:
  city: ${yamlString(primary.city)}
  country: ${yamlString(primary.country)}
  lat: ${primary.lat}
  lng: ${primary.lng}
stops:
${stopsYaml}
tags:
${tags.map((t) => `  - ${t}`).join('\n')}
excerpt: ""
# Add cover image once uploaded to R2:
# cover: "https://assets.psmith.dev/posts/<sha256>.jpeg"
---

Notes from ${stops.map((s) => s.city).join(', ')}.
`;

    await writeFile(outPath, content);
    console.log(`\nCreated ${outPath}`);
    console.log(`  Slug: /travel/${slug}/`);
    console.log(`  Stops (${stops.length}):`);
    for (const s of stops) console.log(`    - ${s.city}, ${s.country} (${s.lat}, ${s.lng})`);
    console.log(`\nNext: write the body, drop a cover image into R2, then commit.`);
    return;
  }

  // Mode: single city
  if (positional.length < 2) {
    console.error(
      'Usage:\n' +
      '  Single city: node scripts/new-travel.mjs <city> <country> [lat] [lng] [--slug N] [--visited YYYY-MM-DD]\n' +
      '  Trip: node scripts/new-travel.mjs --title "Trip name" --stop "City,Country" --stop "City,Country" [--slug N]'
    );
    process.exit(1);
  }

  const [city, country, latArg, lngArg] = positional;
  let lat = latArg != null ? Number(latArg) : null;
  let lng = lngArg != null ? Number(lngArg) : null;

  const slug = flags.slug
    ? slugify(flags.slug)
    : `${slugify(city)}-${slugify(country)}`;
  const outPath = join(OUT_DIR, `${slug}.md`);

  if (await exists(outPath) && !flags.force) {
    console.error(`Refusing to overwrite ${outPath} (pass --force to clobber)`);
    process.exit(1);
  }

  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    console.log(`Geocoding "${city}, ${country}" via Nominatim…`);
    const g = await geocode(city, country);
    lat = g.lat;
    lng = g.lng;
    console.log(`  → ${lat}, ${lng}`);
  }

  const tags = ['travel', slugify(country)];

  const content = `---
title: ${yamlString(`${city}, ${country}`)}
publishedAt: ${today}
visitedAt: ${visited}
location:
  city: ${yamlString(city)}
  country: ${yamlString(country)}
  lat: ${lat}
  lng: ${lng}
tags:
${tags.map((t) => `  - ${t}`).join('\n')}
excerpt: ""
# Add cover image once uploaded to R2:
# cover: "https://assets.psmith.dev/posts/<sha256>.jpeg"
---

Notes from ${city}.
`;

  await writeFile(outPath, content);
  console.log(`\nCreated ${outPath}`);
  console.log(`  Slug: /travel/${slug}/`);
  console.log(`  Pin:  ${lat}, ${lng}`);
  console.log(`\nNext: write the body, drop a cover image into R2, then commit.`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
