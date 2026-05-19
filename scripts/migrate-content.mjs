#!/usr/bin/env node
// Migrate Hashnode-era Hugo markdown → Astro content collections.
//
// Reads:  quickstart/content/posts/*.md
// Writes: web/src/content/posts/*.md   (essays / making / tech)
//         web/src/content/travel/*.md  (travel posts with location data)
//
// Transforms:
//   * Frontmatter: datePublished → publishedAt, drops cuid/slug, adds
//     `category` (posts) or `location` (travel), normalizes `tags`.
//   * Image URLs: rewrites any URL in scripts/image-manifest.json to its
//     R2 publicUrl (or a derived URL via --public-base if upload is still
//     pending). URLs not in the manifest are left untouched with a warning.
//
// Usage:
//   node scripts/migrate-content.mjs                                # uses publicUrl from manifest
//   node scripts/migrate-content.mjs --public-base https://assets.psmithdev.com/posts
//   node scripts/migrate-content.mjs --dry-run                      # report only

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const SRC_DIR = join(REPO, 'quickstart/content/posts');
const POSTS_OUT = join(REPO, 'web/src/content/posts');
const TRAVEL_OUT = join(REPO, 'web/src/content/travel');
const MANIFEST_PATH = join(HERE, 'image-manifest.json');

const args = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const DRY_RUN = args.includes('--dry-run');
const PUBLIC_BASE_OVERRIDE = arg('public-base'); // e.g. https://assets.psmithdev.com/posts

// --- categorization ---

const TRAVEL = {
  'amsterdam-the-netherlands':   { city: 'Amsterdam',    country: 'Netherlands',    lat: 52.3676, lng: 4.9041 },
  'berlin-germany':              { city: 'Berlin',       country: 'Germany',        lat: 52.52,   lng: 13.405 },
  'brussels-belgium':            { city: 'Brussels',     country: 'Belgium',        lat: 50.8503, lng: 4.3517 },
  'budapest-hungary':            { city: 'Budapest',     country: 'Hungary',        lat: 47.4979, lng: 19.0402 },
  'florence-italy':              { city: 'Florence',     country: 'Italy',          lat: 43.7696, lng: 11.2558 },
  'la-cinque-terre-hike-italy':  { city: 'Cinque Terre', country: 'Italy',          lat: 44.1281, lng: 9.7106 },
  'london-united-kingdom':       { city: 'London',       country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  'paris-france':                { city: 'Paris',        country: 'France',         lat: 48.8566, lng: 2.3522 },
  'prague-czech-republic':       { city: 'Prague',       country: 'Czech Republic', lat: 50.0755, lng: 14.4378 },
  'rome-italy':                  { city: 'Rome',         country: 'Italy',          lat: 41.9028, lng: 12.4964 },
  'venice-italy':                { city: 'Venice',       country: 'Italy',          lat: 45.4408, lng: 12.3155 },
  'vienna-austria':              { city: 'Vienna',       country: 'Austria',        lat: 48.2082, lng: 16.3738 },
  'zagarolo-italy':              { city: 'Zagarolo',     country: 'Italy',          lat: 41.8395, lng: 12.8336 },
};

const CATEGORY = {
  // making
  'baby-high-chair':                                'making',
  'birdhouse':                                      'making',
  'bread':                                          'making',
  'cutting-boards-and-serving-trays':               'making',
  'fine-furniture-making':                          'making',
  'giant-wooden-hearts-connecticut-state-capitol-lawn': 'making',
  'glass-flower-storage-box':                       'making',
  'godfather-steves-deck':                          'making',
  'grandmas-backyard-brook-footbridge':             'making',
  'grandpas-workshop':                              'making',
  'sailboat-maintenance':                           'making',
  'sign-making-and-plaques':                        'making',
  'soapmaking':                                     'making',
  'trestle-bed-frame-twin-size':                    'making',
  'wood-turned-pens':                               'making',
  // tech
  'arch-linux-dell-xps-13-9343':                    'tech',
  // essay (default for anything else not in TRAVEL)
  'electric-daisy-carnival':                        'essay',
  'half-and-full-marathon-training-log':            'essay',
  'hiking-with-tyler':                              'essay',
  'lessons-from-if-intermittent-fasting':           'essay',
  'missouri-nursing-homes-grandma-2022':            'essay',
  'psychedelic-science-2023':                       'essay',
  'tomorrowland':                                   'essay',
  'zen-meditation':                                 'essay',
};

// Skip stubs / dev junk
const SKIP = new Set(['giraffehello']);

// --- frontmatter parser (handles only the shapes used by Hashnode export) ---

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: null, body: text };
  const lines = m[1].split(/\r?\n/);
  const body = m[2];
  const fm = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const kv = line.match(/^([a-zA-Z_][\w]*):\s*(.*)$/);
    if (!kv) { i++; continue; }
    const key = kv[1];
    let rest = kv[2].trim();
    if (rest === '') {
      // multi-line list
      const items = [];
      i++;
      while (i < lines.length && /^\s+-\s+/.test(lines[i])) {
        items.push(
          lines[i].replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, '')
        );
        i++;
      }
      fm[key] = items;
    } else {
      // strip surrounding quotes
      if (
        (rest.startsWith('"') && rest.endsWith('"')) ||
        (rest.startsWith("'") && rest.endsWith("'"))
      ) {
        rest = rest.slice(1, -1);
      }
      fm[key] = rest;
      i++;
    }
  }
  return { fm, body };
}

function yamlEscape(s) {
  if (s == null) return '""';
  const str = String(s);
  if (/[:#\[\]{}&*!|>'"%@`,\n]/.test(str) || /^\s|\s$/.test(str)) {
    return JSON.stringify(str);
  }
  return str;
}

function buildFrontmatter(obj) {
  const out = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      out.push(`${k}:`);
      for (const item of v) out.push(`  - ${yamlEscape(item)}`);
    } else if (typeof v === 'object') {
      out.push(`${k}:`);
      for (const [ik, iv] of Object.entries(v)) {
        out.push(`  ${ik}: ${yamlEscape(iv)}`);
      }
    } else {
      out.push(`${k}: ${yamlEscape(v)}`);
    }
  }
  out.push('---');
  return out.join('\n');
}

function toIsoDate(hashnodeDate) {
  // "Thu Jan 06 2022 13:34:28 GMT+0000 (Coordinated Universal Time)"
  if (!hashnodeDate) return null;
  const cleaned = hashnodeDate.replace(/\s*\([^)]*\)\s*$/, '');
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// Build URL → publicUrl map from manifest.
function buildUrlMap(manifest) {
  const map = new Map();
  for (const img of manifest.images) {
    if (img.error || !img.hash) continue;
    let publicUrl = img.publicUrl;
    if (!publicUrl && PUBLIC_BASE_OVERRIDE) {
      publicUrl = `${PUBLIC_BASE_OVERRIDE.replace(/\/$/, '')}/${img.filename}`;
    }
    if (publicUrl) map.set(img.sourceUrl, publicUrl);
  }
  return map;
}

function rewriteUrlsInBody(body, urlMap, missing) {
  // Match markdown image syntax: ![alt](URL ...optional attrs...)
  // and bare cdn.hashnode.com URLs.
  const urlRe = /(https?:\/\/[^\s)"'<>]+)/g;
  return body.replace(urlRe, (url) => {
    // strip any trailing ` align="left"` etc that got captured? — handled by the regex char class
    if (urlMap.has(url)) return urlMap.get(url);
    if (url.includes('cdn.hashnode.com') || url.includes('googleusercontent.com')) {
      missing.add(url);
    }
    return url;
  });
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const urlMap = buildUrlMap(manifest);
  console.log(`Manifest: ${urlMap.size} URL → publicUrl mappings`);
  if (urlMap.size === 0) {
    console.log(
      `  (no publicUrl yet — pass --public-base to derive URLs from filenames)`
    );
  }

  if (!DRY_RUN) {
    // Wipe seeds + previous runs so output reflects truth.
    await rm(POSTS_OUT, { recursive: true, force: true });
    await rm(TRAVEL_OUT, { recursive: true, force: true });
    await mkdir(POSTS_OUT, { recursive: true });
    await mkdir(TRAVEL_OUT, { recursive: true });
  }

  const files = (await readdir(SRC_DIR))
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort();

  const missingUrls = new Set();
  const stats = { posts: 0, travel: 0, skipped: 0, uncovered: 0 };

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    if (SKIP.has(slug)) {
      stats.skipped++;
      console.log(`  skip ${slug} (in SKIP list)`);
      continue;
    }

    const raw = await readFile(join(SRC_DIR, file), 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    if (!fm) {
      stats.skipped++;
      console.log(`  skip ${slug} (no frontmatter)`);
      continue;
    }

    const publishedAt = toIsoDate(fm.datePublished) ?? '2022-01-01';
    const cover = fm.cover && urlMap.has(fm.cover) ? urlMap.get(fm.cover) : fm.cover;
    if (fm.cover && cover === fm.cover) {
      // cover URL not mapped
      if (fm.cover.includes('cdn.hashnode.com') || fm.cover.includes('googleusercontent.com')) {
        missingUrls.add(fm.cover);
      }
    }
    if (!fm.cover) stats.uncovered++;

    const newBody = rewriteUrlsInBody(body, urlMap, missingUrls).trimStart();

    const baseFm = {
      title: fm.title,
      publishedAt,
      tags: Array.isArray(fm.tags)
        ? fm.tags.filter((t) => t && t !== 'programming') // drop the legacy default tag
        : [],
      cover,
    };

    let outPath, frontmatter;
    if (TRAVEL[slug]) {
      const loc = TRAVEL[slug];
      frontmatter = buildFrontmatter({
        ...baseFm,
        visitedAt: publishedAt,
        location: loc,
      });
      outPath = join(TRAVEL_OUT, file);
      stats.travel++;
    } else {
      const category = CATEGORY[slug] ?? 'essay';
      frontmatter = buildFrontmatter({ ...baseFm, category });
      outPath = join(POSTS_OUT, file);
      stats.posts++;
    }

    if (!DRY_RUN) {
      await writeFile(outPath, `${frontmatter}\n\n${newBody}`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  posts:  ${stats.posts}`);
  console.log(`  travel: ${stats.travel}`);
  console.log(`  skipped: ${stats.skipped}`);
  console.log(`  posts without cover: ${stats.uncovered}`);
  if (missingUrls.size) {
    console.log(`\nWARNING: ${missingUrls.size} URLs not in manifest (left as-is):`);
    for (const u of [...missingUrls].slice(0, 10)) console.log(`  ${u}`);
    if (missingUrls.size > 10) console.log(`  …and ${missingUrls.size - 10} more`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
