# MEMORY.md — working state (resume point)

Snapshot of where this project stands so a fresh session can continue. Pair with
`CLAUDE.md` (durable architecture). Last updated: **2026-06-13**.

## Status: built, working, verified — not yet committed or published

The extension is complete and functioning. It has **not** been put in a git repo
and has **not** been published to the Chrome Web Store yet.

### Done & verified
- Full MV3 extension: dark editor chrome + canvas-inverted page, on/off toggle,
  Colorful/Grayscale page styles, no-flash load, live toggle across tabs.
- Icons generated (pure-Node PNG generator).
- Left **document-tabs / outline navigation panel** themed dark, and a contrast
  fix applied: outline labels (`.navigation-item-content`) forced white, active
  row (`.navigation-item-title` on `.location-indicator-highlight`) shown as
  white text + a blue accent left-bar. Verified by injecting `dark.css` into the
  live test doc and screenshotting.
- **Top header fully themed** (the last gap): the white title bar was the
  `#docs-chrome` container (now darkened); toolbar buttons/toggles/dropdowns
  (`.goog-toolbar-button/-menu-button/-select/-combo-button`) had their own light
  bg dropped to transparent; the "Menus" omnibox search pill
  (`.docs-omnibox-input`) and collaborator avatar rings fixed; the white ruler
  strip (`.docs-ruler` / `#kix-horizontal-ruler`) inverted. The Share
  (`.scb-split-button`) button is intentionally left as an accent CTA. Verified
  by probing + screenshotting the anonymous-editor view.
- **Google Sheets support added** (test doc: the spreadsheet URL below). Same
  canvas approach: `.grid-container canvas` inverted; row/column header
  backgrounds, formula bar + name box (`#formula-bar`, `.cell-input`,
  `.waffle-name-box`), and the bottom sheet-tabs bar (`.grid-bottom-bar`,
  `.docs-sheet-tab`) themed. Title bar + toolbar reuse the shared `#docs-chrome`
  / `.goog-toolbar-*` rules. Manifest now matches `document/*` AND
  `spreadsheets/*`; one `dark.css` serves both. Verified by screenshot — grid,
  chrome, formula bar, tabs, and even an embedded chart all dark. Cell
  colors/charts invert (same canvas caveat as images).
- **Google Slides support added** (test deck URL below). Slides render as **SVG**
  (not canvas) and a slide is a design artifact, so the slide is **left
  true-color** — only the editor chrome is darkened: filmstrip (`.filmstrip`),
  workspace backdrop (`.workspace-container`), speaker notes (`#speakernotes*`).
  Title bar + toolbar reuse the shared rules. Manifest matches `presentation/*`.
  Verified by screenshot — duck image and slide colors preserved, chrome dark.
- Selector lint passing — **121 Google selectors**, all documented in
  `tools/selectors.json` (Sheets tagged `"app": "sheets"`, Slides `"app":
  "slides"`).
- **Drift check is app-aware across all three**: `check-live-selectors.mjs`
  takes `--app=docs|sheets|slides` (per-app shell + `app`-filtered assertions) and
  `selector-drift.yml` runs a docs/sheets/slides matrix (`DOCS_TEST_URL` +
  `SHEETS_TEST_URL` + `SLIDES_TEST_URL`), opening per-app issues. All three legs
  verified passing live (docs: 4 criticals, sheets: 5, slides: 3).
- Full CI/CD authored in `.github/workflows/` (lint, pages, selector-drift,
  claude, auto-fix-selectors, release). Workflow YAML validated.
- `docs/privacy.html` + `PRIVACY.md` written (no data collected).

## Key decisions (with rationale)

- **Images are left INVERTED.** The user explicitly chose this (2026-06-13) after
  I confirmed via DOM probe that the image is baked into the page `<canvas>`
  (`imgs: []`, `bgImages: []`) and cannot be isolated/preserved while the page is
  dark. Grayscale mode exists as a softer option. Do not reopen unless asked.
- **Permissions kept to `storage` only**, scoped to `docs.google.com/document/*`
  — minimizes Web Store rejection risk.
- **Live selector validation uses a VIEWER-shared file, not login.** Google
  blocks/ToS-restricts automated logins; a file shared "Anyone with link → Viewer"
  renders the read-only editor for a logged-out browser, which still contains the
  asserted selectors (page/canvas/grid, app shell, menubar). Viewer keeps the test
  files un-editable. The Docs formatting toolbar is edit-only, so those selectors
  are `presence:"variable"` (not live-checked — covered by the lint + in-page
  self-check). Sheets/Slides keep their toolbars in view mode.
- **Auto-fix opens PRs, never auto-merges** — Claude can't see Google's live page,
  so a human must verify selector fixes.

## Important references

- **Test files** live only as repo **variables** (NOT committed): `DOCS_TEST_URL`,
  `SHEETS_TEST_URL`, `SLIDES_TEST_URL`, each a throwaway file shared **"Anyone with
  the link → Viewer"** (read-only, so the files can't be vandalized). The asserted
  critical selectors all exist in read-only mode (verified 2026-06-14: docs 3,
  sheets 4, slides 2). The Docs formatting toolbar only loads when editing, so it's
  `presence:"variable"` (not asserted). Locally, pass the URL as an argument to
  `tools/check-live-selectors.mjs` with `CHROMIUM_PATH=/snap/bin/chromium`.
- Environment: Ubuntu 26.04; Playwright has no prebuilt Chromium → use
  `executablePath: '/snap/bin/chromium'` with `launchPersistentContext`.
- Contact email (public, Web Store listing + privacy policy): soporte@exo.com.ar.

## Next steps / open items

1. **Commit to git + push to GitHub** (not done yet — repo doesn't exist):
   `git init && git add -A && git commit -m "Initial commit"` then add remote/push.
2. **Enable GitHub Pages** (Settings → Pages → Source: GitHub Actions) to publish
   the privacy policy; grab the `…github.io/<repo>/privacy.html` URL.
3. **First Web Store submission is manual** — upload the zip in the Developer
   Dashboard, complete Store listing + Privacy tabs, note the extension ID.
4. **Wire automation secrets/vars**: `CWS_EXTENSION_ID`, `CWS_CLIENT_ID`,
   `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN` (release), `ANTHROPIC_API_KEY`
   (auto-fix), `DOCS_TEST_URL` + `SHEETS_TEST_URL` + `SLIDES_TEST_URL` + optional
   `AUTO_FIX_ON_DRIFT` (drift). See
   README §4 for the OAuth refresh-token steps.
5. After first publish, releases are automated by pushing a `v*` tag (bump
   `manifest.json` version first). `release.yml` now also **signs the release
   artifacts with keyless cosign** (sign-blob of a checksums file via GitHub OIDC
   → Fulcio/Rekor, no keys) and creates a
   GitHub Release with `.zip` + `checksums.txt` + `.sig` + `.pem`. The Web Store
   publish step is gated on `CWS_EXTENSION_ID`, so signed GitHub Releases work
   before the store is configured. Verify via `cosign verify-blob` (README §4).

## Enhancements offered but not built (pick up if asked)

- "Dark UI only" page style (dark chrome, untouched light page → perfect images).
- Brightness slider for the page filter; keyboard shortcut to toggle.
- Sheets/Slides support (different DOM ids, same canvas — needs own selectors).
- Screenshot/visual diff in the drift check (catches "selector exists but looks
  wrong", which presence checks miss).
- Dimming inactive nav items so the active one stands out more.
