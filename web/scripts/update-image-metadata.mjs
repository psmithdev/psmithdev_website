#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import probe from 'probe-image-size';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONTENT_DIR = join(ROOT, 'src/content');
const OUT = join(ROOT, 'src/data/image-metadata.json');
const IMAGE_URL_RE = new RegExp(
  String.raw`https://assets\.psmith\.dev/[^\s)'"<>]+`,
  'g'
);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (/\.mdx?$/.test(entry.name)) {
      yield path;
    }
  }
}

const urls = new Set();
for await (const file of walk(CONTENT_DIR)) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(IMAGE_URL_RE)) urls.add(match[0]);
}

const metadata = {};
for (const url of [...urls].sort()) {
  try {
    const result = await probe(url);
    metadata[url] = {
      width: result.width,
      height: result.height,
      type: result.type,
    };
  } catch (error) {
    console.warn(`Could not probe ${url}: ${error.message}`);
  }
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(metadata, null, 2) + '\n');

console.log(
  `Wrote ${Object.keys(metadata).length} image entries to ${relative(ROOT, OUT)}.`
);
