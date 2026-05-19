# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Parker Smith's personal website — a Hugo static site using the `paper` theme. Content is mostly travel logs, woodworking/maker projects, and personal essays.

## Layout

- `quickstart/` — the Hugo site root (note: not the repo root). All Hugo commands run from here.
  - `content/posts/` — Markdown posts; each file becomes a post at `/posts/<slug>/`.
  - `assets/images/` — image assets referenced from posts (filenames are Hashnode-era hashes — site was migrated from Hashnode, see commit `5ffd265`).
  - `themes/paper/` — git submodule (`https://github.com/nanxiaobei/hugo-paper`). Clone with `--recurse-submodules` or run `git submodule update --init` after cloning.
  - `hugo.toml` — site config (title, theme params, social links). `baseURL` is still the placeholder `https://example.org/` — update before deploying.
  - `public/` — generated output, checked into git.
- `travelmap.html` — standalone AmCharts 3 travel map page, independent of the Hugo build.

## Commands

```bash
cd quickstart
hugo server -D       # local dev with drafts at http://localhost:1313
hugo new content posts/<slug>.md
hugo                 # build to ./public
```

## Notes

- No test suite, lint, or CI — this is a content repo.
- The `paper` theme is a submodule; don't edit files inside `themes/paper/` (changes will be lost on submodule update). Override via `quickstart/layouts/` or `quickstart/assets/` instead.
- `disableHLJS = true` and `math = true` (KaTeX) are set in `hugo.toml`.
