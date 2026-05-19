#!/usr/bin/env node
// Scaffold a new travel post.
//
// Usage:
//   node scripts/new-travel.mjs "Lisbon" "Portugal"
//   node scripts/new-travel.mjs "Lisbon" "Portugal" 38.7223 -9.1393
//   node scripts/new-travel.mjs "Lisbon" "Portugal" --slug lisbon-trip-2024
//   node scripts/new-travel.mjs --visited 2025-09-12 "Lisbon" "Portugal"
//
// Behavior:
//   - Slug defaults to `<city>-<country>` (kebab-case). Use --slug to override
//     when you have multiple posts about the same city.
//   - If lat/lng are omitted, looks them up via OpenStreetMap Nominatim (free,
//     no API key, rate-limited so don't batch this for hundreds of cities).
//   - Refuses to overwrite an existing file unless you pass --force.
//   - publishedAt defaults to today (the visit date is separate via --visited).

import { writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '../web/src/content/travel');

const argv = process.argv.slice(2);
const flags = { force: false, slug: null, visited: null };
const positional = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--force') flags.force = true;
  else if (a === '--slug') flags.slug = argv[++i];
  else if (a === '--visited') flags.visited = argv[++i];
  else positional.push(a);
}

if (positional.length < 2) {
  console.error('Usage: node scripts/new-travel.mjs <city> <country> [lat] [lng] [--slug NAME] [--visited YYYY-MM-DD] [--force]');
  process.exit(1);
}

const [city, country, latArg, lngArg] = positional;
let lat = latArg != null ? Number(latArg) : null;
let lng = lngArg != null ? Number(lngArg) : null;

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const slug = flags.slug
  ? slugify(flags.slug)
  : `${slugify(city)}-${slugify(country)}`;

const outPath = join(OUT_DIR, `${slug}.md`);

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

function yamlString(s) {
  // Quote if contains anything YAML-special; otherwise leave bare.
  if (/[:#\[\]{}&*!|>'"%@`,\n]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return `"${s}"`;
}

const today = new Date().toISOString().slice(0, 10);
const visited = flags.visited ?? today;

(async () => {
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
