#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CONTENT_DIR = join(ROOT, 'src/content');

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

function rel(path) {
  return relative(ROOT, path);
}

function frontmatter(source) {
  const match = /^---\n([\s\S]*?)\n---/.exec(source);
  return match?.[1] ?? '';
}

function hasFrontmatterKey(fm, key) {
  return new RegExp(`^${key}:\\s*\\S`, 'm').test(fm);
}

function isWeakAlt(alt) {
  const trimmed = alt.trim();
  return (
    trimmed.length === 0 ||
    /\.(avif|gif|jpe?g|png|webp)$/i.test(trimmed) ||
    /^(img|dsc|pxl|screenshot)[-_ .0-9a-z]*$/i.test(trimmed)
  );
}

const failures = [];
const warnings = [];

for await (const file of walk(CONTENT_DIR)) {
  const source = await readFile(file, 'utf8');
  const fm = frontmatter(source);
  const path = rel(file);

  if (!hasFrontmatterKey(fm, 'excerpt')) {
    warnings.push(`${path}: missing excerpt`);
  }

  if (hasFrontmatterKey(fm, 'cover') && !hasFrontmatterKey(fm, 'coverAlt')) {
    warnings.push(`${path}: cover image is missing coverAlt`);
  }

  for (const match of source.matchAll(/!\[([^\]]*)\]\([^)]+\)/g)) {
    if (isWeakAlt(match[1])) {
      const line = source.slice(0, match.index).split('\n').length;
      warnings.push(`${path}:${line}: weak markdown image alt text`);
    }
  }

  for (const match of source.matchAll(/<iframe\b[^>]*>/gi)) {
    const tag = match[0];
    const line = source.slice(0, match.index).split('\n').length;
    for (const attr of ['loading="lazy"', 'referrerpolicy=', 'sandbox=']) {
      if (!tag.includes(attr)) {
        failures.push(`${path}:${line}: iframe missing ${attr}`);
      }
    }
  }
}

if (warnings.length > 0) {
  console.warn(`Content audit warnings (${warnings.length}):`);
  for (const warning of warnings) console.warn(`  ${warning}`);
}

if (failures.length > 0) {
  console.error(`Content audit failures (${failures.length}):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('Content audit passed.');
