#!/usr/bin/env node
// Scan old Hugo markdown for external image URLs, download to a local cache
// keyed by content hash, and emit a manifest. Idempotent — re-runs skip files
// already on disk and only refetch missing ones.
//
// Usage:
//   node scripts/migrate-images.mjs            # scan + download
//   node scripts/migrate-images.mjs --scan     # scan only, no download
//   node scripts/migrate-images.mjs --limit 5  # download first N (debug)

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const SRC_DIR = join(REPO, 'quickstart/content/posts');
const CACHE_DIR = join(HERE, '.cache/images');
const MANIFEST_PATH = join(HERE, 'image-manifest.json');

const args = process.argv.slice(2);
const SCAN_ONLY = args.includes('--scan');
const LIMIT_IDX = args.indexOf('--limit');
const LIMIT = LIMIT_IDX >= 0 ? Number(args[LIMIT_IDX + 1]) : Infinity;

// URL detection: cdn.hashnode.com (covers all 212 images per audit) plus
// generic http(s) URLs in cover: fields. Fallback regex catches stragglers.
const URL_RE =
  /https?:\/\/[^\s)"'<>]+?\.(?:jpe?g|png|gif|webp|avif)(?:\?[^\s)"'<>]*)?/gi;
const COVER_RE = /^cover:\s*(https?:\/\/[^\s"']+)/im;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const extOf = (url) => {
  const clean = url.split('?')[0].toLowerCase();
  const e = extname(clean).replace(/^\./, '');
  return e === 'jpg' ? 'jpeg' : e || 'jpeg';
};

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function scanPosts() {
  const files = (await readdir(SRC_DIR))
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort();

  // url -> { posts: Set<slug>, contexts: Set<'cover'|'body'> }
  const urls = new Map();

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const content = await readFile(join(SRC_DIR, file), 'utf8');

    const coverMatch = content.match(COVER_RE);
    if (coverMatch) {
      const url = coverMatch[1].replace(/['",]$/, '');
      const entry = urls.get(url) ?? { posts: new Set(), contexts: new Set() };
      entry.posts.add(slug);
      entry.contexts.add('cover');
      urls.set(url, entry);
    }

    for (const match of content.matchAll(URL_RE)) {
      const url = match[0];
      const entry = urls.get(url) ?? { posts: new Set(), contexts: new Set() };
      entry.posts.add(slug);
      entry.contexts.add('body');
      urls.set(url, entry);
    }
  }

  return urls;
}

async function downloadOne(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'psmithdev-migrate/1.0' },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function main() {
  console.log(`Scanning ${SRC_DIR}…`);
  const urls = await scanPosts();
  console.log(`Found ${urls.size} unique image URLs across posts.\n`);

  if (SCAN_ONLY) {
    for (const [url, info] of urls) {
      console.log(`  ${url}`);
      console.log(`    posts: ${[...info.posts].join(', ')}`);
    }
    return;
  }

  await mkdir(CACHE_DIR, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDir: 'quickstart/content/posts',
    cacheDir: 'scripts/.cache/images',
    images: [],
  };

  let downloaded = 0;
  let cached = 0;
  let failed = 0;
  let count = 0;

  for (const [url, info] of urls) {
    if (++count > LIMIT) break;

    process.stdout.write(`[${count}/${Math.min(urls.size, LIMIT)}] ${url}`);

    try {
      const buf = await downloadOne(url);
      const hash = sha256(buf);
      const ext = extOf(url);
      const filename = `${hash}.${ext}`;
      const localPath = join(CACHE_DIR, filename);

      if (await exists(localPath)) {
        cached++;
        process.stdout.write(' [cached]\n');
      } else {
        await writeFile(localPath, buf);
        downloaded++;
        process.stdout.write(` [ok ${(buf.length / 1024).toFixed(0)}kb]\n`);
      }

      manifest.images.push({
        sourceUrl: url,
        hash,
        ext,
        filename,
        bytes: buf.length,
        posts: [...info.posts].sort(),
        contexts: [...info.contexts].sort(),
      });
    } catch (err) {
      failed++;
      process.stdout.write(` [FAIL: ${err.message}]\n`);
      manifest.images.push({
        sourceUrl: url,
        error: String(err.message),
        posts: [...info.posts].sort(),
        contexts: [...info.contexts].sort(),
      });
    }
  }

  // Dedupe stats — multiple URLs may hash to same file (Hashnode sometimes
  // serves the same cover URL twice).
  const uniqueHashes = new Set(
    manifest.images.filter((i) => i.hash).map((i) => i.hash)
  ).size;

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(`\nDone.`);
  console.log(`  downloaded: ${downloaded}`);
  console.log(`  cached:     ${cached}`);
  console.log(`  failed:     ${failed}`);
  console.log(`  unique by content hash: ${uniqueHashes}`);
  console.log(`\nManifest: ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
