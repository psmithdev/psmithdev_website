#!/usr/bin/env node
// Upload cached images to a Cloudflare R2 bucket using the wrangler CLI.
// Idempotent: skips objects that already exist in the bucket.
//
// Prereqs:
//   1. `npx wrangler login` once.
//   2. Create the bucket: `npx wrangler r2 bucket create <name>`.
//   3. (Recommended) Wire a custom domain so objects are public, e.g.
//      assets.psmithdev.com → bucket. Set --public-base accordingly.
//
// Usage:
//   node scripts/upload-r2.mjs --bucket psmithdev-assets \
//     --public-base https://assets.psmithdev.com \
//     --prefix posts
//
// Re-writes scripts/image-manifest.json with a `publicUrl` per image, which
// the content-migration step (Phase 3) consumes.

import { readFile, writeFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(HERE, '.cache/images');
const MANIFEST_PATH = join(HERE, 'image-manifest.json');

const args = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const BUCKET = arg('bucket');
const PUBLIC_BASE = arg('public-base'); // e.g. https://assets.psmithdev.com
const PREFIX = arg('prefix', 'posts');
const DRY_RUN = args.includes('--dry-run');

if (!BUCKET || !PUBLIC_BASE) {
  console.error(
    'Usage: node scripts/upload-r2.mjs --bucket <name> --public-base <https://…> [--prefix posts] [--dry-run]'
  );
  process.exit(1);
}

const contentTypeFor = (ext) => {
  switch (ext) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
};

function run(cmd, cmdArgs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function objectExists(key) {
  const res = await run('npx', [
    'wrangler',
    'r2',
    'object',
    'get',
    `${BUCKET}/${key}`,
    '--remote',
    '--pipe',
  ]);
  return res.code === 0;
}

async function uploadObject(key, localPath, contentType) {
  const res = await run('npx', [
    'wrangler',
    'r2',
    'object',
    'put',
    `${BUCKET}/${key}`,
    '--file',
    localPath,
    '--content-type',
    contentType,
    '--remote',
  ]);
  if (res.code !== 0) {
    throw new Error(`wrangler exited ${res.code}: ${res.stderr.trim()}`);
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const images = manifest.images.filter((i) => i.hash);

  console.log(
    `Uploading ${images.length} images to r2://${BUCKET}/${PREFIX}/`
  );
  console.log(`Public base: ${PUBLIC_BASE}`);
  console.log(`Dry run: ${DRY_RUN ? 'yes' : 'no'}\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const key = `${PREFIX}/${img.filename}`;
    const localPath = join(CACHE_DIR, img.filename);
    const publicUrl = `${PUBLIC_BASE.replace(/\/$/, '')}/${key}`;

    process.stdout.write(`[${i + 1}/${images.length}] ${key}`);

    if (DRY_RUN) {
      img.publicUrl = publicUrl;
      process.stdout.write(' [dry-run]\n');
      continue;
    }

    try {
      await stat(localPath);
    } catch {
      process.stdout.write(` [SKIP: local file missing]\n`);
      failed++;
      continue;
    }

    try {
      if (await objectExists(key)) {
        skipped++;
        process.stdout.write(' [exists]\n');
      } else {
        await uploadObject(key, localPath, contentTypeFor(img.ext));
        uploaded++;
        process.stdout.write(' [uploaded]\n');
      }
      img.publicUrl = publicUrl;
    } catch (err) {
      failed++;
      process.stdout.write(` [FAIL: ${err.message}]\n`);
    }
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(`\nDone.`);
  console.log(`  uploaded: ${uploaded}`);
  console.log(`  skipped:  ${skipped} (already in bucket)`);
  console.log(`  failed:   ${failed}`);
  console.log(`\nManifest updated with publicUrl values: ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
