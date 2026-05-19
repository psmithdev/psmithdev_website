#!/usr/bin/env node
// Post-build check: no cdn.hashnode.com URLs should appear in the built site.
// All Hashnode-hosted images must be migrated to assets.psmith.dev (R2).
// Exits non-zero if any are found.

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '../dist');
const NEEDLE = 'cdn.hashnode.com';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(html|xml|json|txt)$/.test(entry.name)) yield p;
  }
}

const hits = [];
for await (const file of walk(DIST)) {
  const content = await readFile(file, 'utf8');
  if (content.includes(NEEDLE)) hits.push(file);
}

if (hits.length === 0) {
  console.log(`✓ No "${NEEDLE}" URLs in dist/.`);
  process.exit(0);
}

console.error(`✗ Found "${NEEDLE}" in ${hits.length} file(s):`);
for (const f of hits) console.error(`  ${f}`);
process.exit(1);
