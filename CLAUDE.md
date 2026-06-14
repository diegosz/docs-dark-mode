# CLAUDE.md

Project guidance for Claude Code. Read this first when working in this repo.

> **Resuming a session?** Read [`MEMORY.md`](./MEMORY.md) for current working
> state — what's done, decisions made, and next steps. This file is the durable
> architecture; `MEMORY.md` is the live snapshot.

## What this is

**Dark Mode for Google Docs, Sheets & Slides** — a Manifest V3 Chrome extension
that gives the Google Docs, Sheets and Slides editors a dark theme. This repo's
root is the extension root. `content_scripts` matches
`document/*`, `spreadsheets/*` and `presentation/*`; one `dark.css` serves all
three (each app's selectors are distinct, so its rules are inert on the others).
Apps: Docs = "kix", Sheets = "waffle", Slides = "punch".

**Slides is different**: slides render as **SVG** (not canvas), and a slide is a
design artifact, so the theme deliberately **does not invert the slide** — it
only darkens the editor chrome (filmstrip, workspace backdrop, speaker notes,
§10 of `dark.css`). The slide keeps its true colors. Docs/Sheets DO invert their
canvas.

## The one architectural fact that explains everything

Since 2021, Google Docs paints the document body — **text *and* images** — onto
a single `<canvas class="kix-canvas-tile-content">`. The body has **no DOM text
nodes**. This forces a two-layer design:

| Layer | What it is | How it's themed |
|---|---|---|
| **Editor chrome** — toolbar, menus, title bar, comments, left nav panel, formula bar, sheet tabs | real HTML/DOM | normal CSS color overrides |
| **Document page / Sheets grid** — text, images, cells, charts | a `<canvas>` (`.kix-canvas-tile-content` in Docs, `.grid-container canvas` in Sheets) | a single `filter: invert(0.9) hue-rotate(180deg)` |

**Consequence (do not try to "fix" this):** embedded images invert along with the
text because they share the canvas. There is no image element to isolate —
confirmed empirically (`document.querySelectorAll('img')` returns `[]` inside a
doc). Per-image preservation is impossible on Chromium; the user has accepted
inverted images. The only true preservation would be to *not* darken the page.

## How the code is organized

- `manifest.json` — MV3. Only the `storage` permission; `content_scripts`
  matches `https://docs.google.com/document/*`, injected at `document_start`.
- `content/dark.css` — the theme. **Every rule is gated behind `html.dde-enabled`**
  so the stylesheet is inert when the toggle is off. `dde-mode-grayscale` /
  `dde-mode-colorful` switch the page filter.
- `content/content.js` — adds/removes the gating classes on `<html>`. Reads a
  `localStorage['dde:state']` cache synchronously (kills the flash of light on
  reload), then reconciles with `chrome.storage.local` (the source of truth) and
  listens for `onChanged` for live updates. Has an opt-in selector self-check:
  `localStorage['dde:debug']='1'` logs zero-match critical selectors.
- `popup/` — toolbar popup: on/off toggle + Colorful/Grayscale page style.
- `icons/` — generated PNGs (16/32/48/128). Do not hand-edit; run the generator.
- `docs/` — GitHub Pages site (`privacy.html`) = the Web Store privacy-policy URL.
- `tools/selectors.json` — registry of every Google-owned selector `dark.css`
  depends on, classified by `presence` (load/variable/interaction), `critical`,
  and `layer`. **Keep it in sync with `dark.css`** (the lint enforces this).
- `.github/workflows/` — CI/CD (see README §4).

## Commands

```bash
node tools/make-icons.mjs       # regenerate icons  (pnpm icons)
./package.sh                    # build docs-dark-mode-vX.Y.Z.zip  (pnpm build)
node tools/lint-selectors.mjs   # check dark.css selectors vs registry  (pnpm lint:selectors)
node tools/check-live-selectors.mjs <url> --app=docs|sheets   # live drift check
#   locally set CHROMIUM_PATH=/snap/bin/chromium (no prebuilt Playwright browser on this OS)
```

Test locally: `chrome://extensions` → Developer mode → **Load unpacked** → pick
this folder → open any `docs.google.com/document/...`. Reload the extension card
after editing CSS/JS.

## Conventions & rules

- **Adding/removing a Google selector in `dark.css`?** Update `tools/selectors.json`
  too, or `pnpm lint:selectors` fails. If the selector uses a new namespace
  prefix, add it to `GOOGLE_PREFIXES` in `tools/lint-selectors.mjs`.
- **The visible outline-item label is `.navigation-item-content`** (not
  `…-content-container`) and the active row is `.navigation-item-title`. Google
  paints them dim gray; the theme forces them white.
- Keep permissions minimal — `storage` only. Permission creep is the #1 Web Store
  rejection cause for theme extensions.
- No remote code / `eval` (MV3 forbids it). Everything bundled locally.
- `package.sh` ships only `manifest.json`, `content/`, `popup/`, `icons/`. Dev
  files (`tools/`, `docs/`, `.github/`, `*.md`) are excluded from the zip.

## Publishing gotchas (verified 2026)

- MV3 is mandatory; MV2 is not accepted.
- **The first Web Store upload must be done manually** (the API can only *update*
  an existing item). Subsequent releases are automated via a `v*` tag.
- **Bump `manifest.json` `version` every release** — the store rejects re-used
  versions. `release.yml` enforces tag == manifest version.
- Releases are **signed with keyless cosign** (`cosign sign-blob` of a checksums
  file via GitHub OIDC → Fulcio/Rekor, no keys to manage). `release.yml` needs
  `id-token: write` + `contents:
  write`, attaches `.zip` + `checksums.txt` + `.sig` + `.pem` to a GitHub Release,
  and only publishes to the Web Store if `CWS_EXTENSION_ID` is set.

## Environment note (this machine)

Ubuntu 26.04 — Playwright has **no prebuilt Chromium** here. The live-selector
tooling must launch the system browser:
`chromium.launchPersistentContext(profileDir, { executablePath: '/snap/bin/chromium' })`.
`pnpm exec playwright install chromium` fails; don't rely on it.
