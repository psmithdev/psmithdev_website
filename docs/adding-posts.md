# Adding a new essay, making, or tech post

All three live in the same `posts` collection at `web/src/content/posts/`. They're distinguished by the `category` field in frontmatter (one of `essay`, `making`, `tech`), which controls:

- Which index page lists the post (`/essays/` lists `category: essay`; `/making/` lists `category: making`).
- The eyebrow label above the title on the post page ("Essay" / "Making" / "Tech").

URL pattern is the same for all three: `/posts/<slug>/`. (For travel posts, see [adding-travel-posts.md](./adding-travel-posts.md) — they live in a separate collection because they carry lat/lng for the map.)

## The fast path (helper script)

```bash
# essay
node scripts/new-post.mjs essay "Why I keep a logbook"

# maker / woodworking
node scripts/new-post.mjs making "Trestle bed frame, queen size"

# tech writeup
node scripts/new-post.mjs tech "Migrating off Hashnode"

# override the slug (default is kebab-case of the title)
node scripts/new-post.mjs essay "Notes on rest" --slug rest-notes

# backdate (default publishedAt is today)
node scripts/new-post.mjs essay "Last summer's lessons" --date 2025-09-04
```

The script:
- Writes `web/src/content/posts/<slug>.md` with frontmatter pre-filled
- Refuses to overwrite an existing file (pass `--force` to clobber)
- Defaults slug to kebab-case of the title; use `--slug` to override
- Validates the category against the schema's enum

## What the file looks like

After scaffolding, fill in `tags`, write the `excerpt`, uncomment `cover` once you have a hero image, and write the body:

```markdown
---
title: "Trestle bed frame, queen size"
publishedAt: 2026-05-19
category: making
tags:
  - woodworking
  - furniture
  - bedroom
excerpt: "Walnut and white oak. Knockdown joinery so it can move with us."
cover: "https://assets.psmith.dev/posts/<sha256>.jpeg"
---

Write the body in Markdown.

![A walnut trestle bed frame in a sunlit bedroom](https://assets.psmith.dev/posts/<sha256>.jpeg)

## Materials

- 8/4 walnut for the legs
- 4/4 white oak for the slats

## Process

…
```

Schema is enforced by `web/src/content/config.ts`. Missing or mis-typed fields fail the build.

## Picking the right category

- **`essay`** — long-form writing, personal reflection, anything not strictly maker or tech. Travel reflections that aren't about a single location also go here.
- **`making`** — woodworking, cooking, soap, bread, sailboat work, anything made by hand. The `/making/` page renders these as a grid.
- **`tech`** — programming, hardware tinkering, dev-process writeups. Currently a small bucket; lives on the homepage's recent list, no dedicated index page yet.

If a post genuinely straddles two, pick the dominant one and add the other as a tag. The category is only a filter; tags carry the nuance.

## Adding images

Cover and inline images live on Cloudflare R2 at `assets.psmith.dev`. Two ways to upload:

**Wrangler CLI** (good for one-off uploads):

```bash
cd web
npx wrangler r2 object put psmithdev-assets/posts/walnut-trestle-bed.jpeg \
  --file ~/Pictures/walnut-trestle-bed.jpeg \
  --content-type image/jpeg \
  --remote
```

Then reference it in the markdown as `https://assets.psmith.dev/posts/walnut-trestle-bed.jpeg`.

**R2 dashboard**: Cloudflare → R2 → `psmithdev-assets` → Upload, into the `posts/` prefix. Good for batches.

Filenames are up to you — use descriptive ones for new uploads. Existing migrated images use `<sha256>.<ext>` because that's what the migration script produced; that's not a requirement. Keep the `posts/` prefix to match the convention.

## Workflow for a batch of posts

1. Scaffold all the files with the helper
2. Open each, write the body, fill in `tags` + `excerpt`
3. Upload cover + body images to R2
4. Uncomment the `cover:` line in each, paste the URL
5. One commit for the batch, push
6. Cloudflare Workers Builds auto-builds and deploys; posts appear on their category index and on the homepage's recent list

## Drafts

Add `draft: true` to the frontmatter to keep a post out of every index, the homepage, and RSS. It still builds as a routable page at `/posts/<slug>/` — useful for sharing a preview link before publishing. Remove or set `draft: false` when ready.

```yaml
---
title: "Halfway through writing this one"
publishedAt: 2026-05-19
category: essay
draft: true
---
```

## Removing or renaming a post

If you delete a file from `web/src/content/posts/`, the corresponding URL will 404 on the next deploy. To avoid broken inbound links:

1. Add a line to `web/public/_redirects` mapping the old path → new path (or `/`):
   ```
   /posts/old-slug    /posts/new-slug/    301
   ```
2. Then delete (or rename) the source file.

Cloudflare Workers reads `_redirects` from the static asset directory and serves the 301 at the edge.
