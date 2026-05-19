#!/usr/bin/env node
// Scaffold a new essay / making / tech post.
//
// Usage:
//   node scripts/new-post.mjs essay  "Why I keep a logbook"
//   node scripts/new-post.mjs making "Trestle bed frame, queen size"
//   node scripts/new-post.mjs tech   "Migrating off Hashnode"
//   node scripts/new-post.mjs essay  "Notes on rest"  --slug rest-notes
//   node scripts/new-post.mjs essay  "Notes on rest"  --date 2026-04-12
//
// Writes web/src/content/posts/<slug>.md with frontmatter pre-filled.
// Refuses to overwrite unless --force is passed.

import { writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '../web/src/content/posts');
const VALID_CATEGORIES = ['essay', 'making', 'tech'];

const argv = process.argv.slice(2);
const flags = { force: false, slug: null, date: null };
const positional = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--force') flags.force = true;
  else if (a === '--slug') flags.slug = argv[++i];
  else if (a === '--date') flags.date = argv[++i];
  else positional.push(a);
}

if (positional.length < 2) {
  console.error('Usage: node scripts/new-post.mjs <essay|making|tech> "Title" [--slug NAME] [--date YYYY-MM-DD] [--force]');
  process.exit(1);
}

const [category, title] = positional;

if (!VALID_CATEGORIES.includes(category)) {
  console.error(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  process.exit(1);
}

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const slug = flags.slug ? slugify(flags.slug) : slugify(title);
const outPath = join(OUT_DIR, `${slug}.md`);
const date = flags.date ?? new Date().toISOString().slice(0, 10);

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

function yamlString(s) {
  if (/[:#\[\]{}&*!|>'"%@`,\n]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return `"${s}"`;
}

(async () => {
  if (await exists(outPath) && !flags.force) {
    console.error(`Refusing to overwrite ${outPath} (pass --force to clobber)`);
    process.exit(1);
  }

  const content = `---
title: ${yamlString(title)}
publishedAt: ${date}
category: ${category}
tags: []
excerpt: ""
# Add cover image once uploaded to R2:
# cover: "https://assets.psmith.dev/posts/<sha256>.jpeg"
---

Write the body in Markdown here.
`;

  await writeFile(outPath, content);
  console.log(`\nCreated ${outPath}`);
  console.log(`  Slug: /posts/${slug}/`);
  console.log(`  Category: ${category}`);
  console.log(`\nNext: write the body, fill in tags + excerpt, drop a cover image into R2, then commit.`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
