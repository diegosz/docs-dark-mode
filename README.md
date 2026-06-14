# Dark Mode for Google Docs

A Manifest V3 Chrome extension that gives Google Docs a comfortable dark theme:
a dark editor UI plus an inverted, easy-on-the-eyes page.

## How it works (and one honest limitation)

Google Docs is really two different things, and dark mode has to treat them
differently:

| Layer | What it is | How we darken it |
| --- | --- | --- |
| **Editor chrome** — toolbar, menus, title bar, comment sidebar | ordinary HTML/DOM | normal CSS color overrides (`content/dark.css`) |
| **The document page** — your text + images | painted onto an HTML `<canvas>` since 2021 | a single CSS `filter: invert() hue-rotate()` over the canvas |

Because the page is a **canvas**, the text and any embedded images are *pixels*,
not elements — there is nothing to recolor individually. The only way to darken
the page is to invert the whole canvas, which **also inverts embedded images and
charts**. There is no per-image fix on Chromium; this affects every Docs dark-mode
extension (including Dark Reader). The **Grayscale** page style in the popup makes
inverted images look less jarring. If you need images to stay perfectly true,
toggle dark mode off while reviewing them.

### Files

```
docs-dark-mode/
├── manifest.json          # MV3 manifest (only the `storage` permission)
├── content/
│   ├── dark.css           # the theme — every rule gated behind html.dde-enabled
│   └── content.js         # adds/removes the gating class; kills the load flash
├── popup/                 # the toolbar popup: on/off + Colorful/Grayscale
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── icons/                 # 16/32/48/128 PNGs (generated)
├── docs/                  # GitHub Pages site (privacy.html) — the privacy-policy URL
├── tools/
│   ├── make-icons.mjs        # dependency-free icon generator
│   ├── lint-selectors.mjs    # checks dark.css selectors vs the registry (CI)
│   ├── check-live-selectors.mjs  # live drift check via headless Docs (CI)
│   └── selectors.json        # registry of Google selectors we depend on
├── .github/workflows/     # CI/CD: lint, pages, drift, claude, auto-fix, release
├── package.sh             # builds the Web Store .zip
├── package.json           # dev scripts + Playwright (not shipped)
├── PRIVACY.md             # privacy policy (also published via docs/privacy.html)
└── README.md
```

State is stored with `chrome.storage.local` and applied live to every open Docs
tab via `chrome.storage.onChanged` — no reload needed when you flip the toggle.

---

## 1. Test it locally (unpacked)

You don't need to package or publish anything to try it:

1. Open **`chrome://extensions`** in Chrome (or Edge — same steps).
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the **`docs-dark-mode/`** folder (the one
   containing `manifest.json`).
4. The extension appears as a card. Pin it from the puzzle-piece icon in the
   toolbar so the popup is easy to reach.
5. Open any document at **`https://docs.google.com/document/...`**. It should be
   dark immediately. Click the toolbar icon to toggle it or switch page style.

### The dev loop

- **Edited `dark.css`, `content.js`, or the popup?** Click the **reload** (↻)
  icon on the extension's card in `chrome://extensions`, then refresh the Docs
  tab. (Popup-only changes usually just need the popup reopened.)
- **Edited `manifest.json`?** Always reload the extension card.
- **Errors?** They surface on the extension card (an **Errors** button) and in
  DevTools: right-click the page → Inspect for content-script logs; on the
  extension card click **service worker / popup** to inspect the popup.

### What to verify

- Toggle off → the page returns to Google's normal light theme with no leftover
  styling (all CSS is gated behind `html.dde-enabled`).
- Reload a Docs tab with dark mode on → no flash of the light UI (the
  `localStorage` cache in `content.js` paints dark before first paint).
- Open the **Colorful** vs **Grayscale** styles and confirm the page filter
  changes.
- Open a doc with an image → confirm the documented inversion behavior.

---

## 2. Package it

```bash
./package.sh
```

This regenerates the icons and produces `docs-dark-mode-v1.0.0.zip` with
`manifest.json` at the **root** of the archive (a Web Store requirement) and only
the runtime files — no `tools/`, `*.md`, or dotfiles. Chrome only accepts `.zip`
uploads.

To bump the version, edit `"version"` in `manifest.json` and re-run the script.

---

## 3. Publish to the Chrome Web Store

> Verified against Google's developer docs as of June 2026.

### One-time setup

1. **Use a dedicated Google account** for publishing if you can — the account
   email **cannot be changed later**, and all policy notices go there.
2. Go to the **[Developer Dashboard](https://chrome.google.com/webstore/devconsole)**,
   accept the developer agreement, and pay the **one-time US $5 registration
   fee** (not recurring; covers up to ~20 published items).

### Submit

3. Click **Add new item** and upload `docs-dark-mode-v1.0.0.zip`.
4. Fill in the **Store listing** tab:
   - **Title** (≤75 chars), **Summary** (≤132 chars, plain text), and a detailed
     **Description**.
   - **Icon**: 128×128 PNG (use `icons/icon128.png`).
   - **Screenshots**: 1–5 at **1280×800** (or 640×400). Capture a Docs document
     in dark mode — these matter most for installs.
   - **Small promo tile**: 440×280 (optional but recommended).
   - Pick a **category** (e.g. _Workflow & Planning_ or _Accessibility_) and
     language.
5. Fill in the **Privacy** tab — reviewers read this closely, and it's the most
   common rejection area for theme extensions:
   - **Single purpose**: e.g. _"Applies a dark theme to the Google Docs editor."_
   - **Permission justification** — `storage`: _"Remembers the user's on/off and
     page-style preference. No data leaves the device."_ Justify the
     `docs.google.com` host access: _"Injects the dark-theme stylesheet into the
     Docs editor."_
   - **Remote code**: declare **No** (everything is bundled; MV3 forbids remote
     code).
   - **Data usage**: check that you **don't collect or use** user data, and tick
     the certification boxes.
   - **Privacy policy URL**: publish `docs/privacy.html` to GitHub Pages (see
     §4) and paste `https://<owner>.github.io/<repo>/privacy.html`. Required
     whenever an extension handles any user data, and recommended regardless.
6. **Distribution** tab — choose visibility:
   - **Private** (Trusted testers) or **Unlisted** for a soft launch / testing
     by URL — both still go through review.
   - **Public** when you're ready for everyone.
7. **Submit for review.**

### After submitting — what to expect

- **Review time**: often under 24 hours for a simple extension; **1–3 business
  days** is typical; a brand-new account with broad permissions can take **2–4
  weeks**. This extension's minimal `storage`-only footprint helps.
- **Don't cancel and resubmit** a pending item — it restarts the review clock and
  can flag the account.
- **Keep permissions minimal.** Permission creep is the #1 rejection cause for
  theme/dark-mode extensions; this build deliberately requests only `storage`
  and a single host match.

### Common rejection reasons for this category (already mitigated here)

- ❌ Requesting broad host permissions (`<all_urls>`, `tabs`) → ✅ we scope to
  `docs.google.com/document` only.
- ❌ Being "just a theme/launcher" (single-purpose violation) → ✅ self-contained
  functionality with a clear single purpose.
- ❌ Remote/eval code → ✅ everything is local; no `eval`, no remote scripts.
- ❌ Cloning an existing project (e.g. Dark Reader) → ✅ original implementation.

---

## 4. Automation (CI/CD)

Everything below lives in `.github/workflows/` and runs once the project is a
GitHub repo. **None of it is required to use or even publish the extension** —
it's optional infrastructure for hosting the privacy policy, catching selector
drift, and shipping updates hands-free.

### Push it to GitHub

```bash
cd docs-dark-mode
git init && git add -A && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

### Host the privacy policy on GitHub Pages  (`pages.yml`)

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`; the `pages.yml` workflow publishes the `docs/` folder.
3. Your policy is live at **`https://<owner>.github.io/<repo>/privacy.html`** —
   paste that into the Web Store **Privacy** tab.

   (Simpler alternative with no workflow: Settings → Pages → *Deploy from a
   branch* → `main` / `/docs`. The folder must be named `docs/`, which it is.)

### Keep selectors from silently breaking

Google renames Docs CSS classes occasionally. Three layers guard against it,
weakest dependency first:

1. **`lint.yml`** (every push/PR) — `tools/lint-selectors.mjs` checks that every
   Google selector in `dark.css` is documented in `tools/selectors.json` and
   vice-versa. Deterministic, no network. Catches typos and accidental removals.
2. **`selector-drift.yml`** (weekly + manual) — opens a real editor with
   Playwright and asserts the `critical`/`presence:"load"` selectors still match.
   Runs **one matrix leg per app** (Docs, Sheets, Slides), each app-filtered via
   the registry's `app` field (`docs` / `sheets` / `slides` / `both`) so no leg
   false-alarms on another app's selectors. **No Google login needed**: set repo
   **variables** `DOCS_TEST_URL`, `SHEETS_TEST_URL` and `SLIDES_TEST_URL` to
   throwaway files shared **"Anyone with the link → Viewer"** (read-only — the
   files stay un-editable). Each leg is skipped if its variable is unset. On drift
   it opens a per-app GitHub issue (label `selector-drift-docs` / `-sheets` /
   `-slides`) containing `candidateDom` (the live class/id names) so you — or
   Claude — can find the new selector.
   - The asserted (critical) selectors — page/canvas/grid, app shell, menubar —
     all exist in read-only mode. The **Docs formatting toolbar** only loads when
     editing, so its selectors are marked `presence:"variable"` (not live-checked)
     and are instead covered by the deterministic lint + the in-page self-check.
3. **Runtime self-check** (in `content.js`, opt-in) — the most reliable signal,
   because it runs in *your* logged-in session where everything exists. In a
   Docs tab console run `localStorage.setItem('dde:debug','1')` and reload;
   zero-match selectors are logged.

### Assisted auto-fix  (`claude.yml`, `auto-fix-selectors.yml`)

Blindly rewriting a renamed selector isn't safe — you need to know Google's
*new* name. The drift check supplies exactly that (`candidateDom`), so the fix
becomes tractable:

- **Automatic path**: set repo variable `AUTO_FIX_ON_DRIFT=true`. The drift issue
  then `@claude`-mentions itself; `claude.yml` (using
  `anthropics/claude-code-action@v1`) reads the report and opens a **pull
  request** updating `dark.css` + `selectors.json`.
- **Manual path**: run **`auto-fix-selectors.yml`** from the Actions tab and
  paste the broken selectors / `candidateDom`.

Either way Claude opens a PR — **it is never auto-merged**. A human reviews and
visually verifies against live Docs, because Claude cannot see Google's page and
is only as good as the supplied context. Requires the `ANTHROPIC_API_KEY` secret
and the [Claude GitHub App](https://github.com/apps/claude) installed.

### Auto-release to the Chrome Web Store  (`release.yml`)

```bash
# bump the version FIRST (the store rejects re-used versions)
#   edit manifest.json:  "version": "1.0.1"
git commit -am "Release 1.0.1"
git tag v1.0.1 && git push origin main --tags     # tag push triggers release.yml
```

`release.yml` verifies the tag matches `manifest.json`, builds the zip,
**signs it**, publishes a **GitHub Release** with the signed artifacts, and then
(if the Web Store secrets are set) publishes via the Chrome Web Store API
(`mnao305/chrome-extension-upload@v6`). The store publish step is skipped if
`CWS_EXTENSION_ID` isn't configured, so signed GitHub Releases work on their own.

**Signed releases (keyless cosign).** The release workflow `cosign sign-blob`s a
`sha256` checksums file using the GitHub Actions
OIDC token → a short-lived Sigstore **Fulcio** cert, recorded in the **Rekor**
transparency log. **No keys to manage** (it just needs `id-token: write`). Each
release attaches the `.zip`, `docs-dark-mode_checksums.txt`, and its `.sig` +
`.pem`. Verify a download:

```bash
cosign verify-blob \
  --certificate-identity-regexp '^https://github.com/<owner>/<repo>/\.github/workflows/release\.yml@.*' \
  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \
  --certificate docs-dark-mode_checksums.txt.pem \
  --signature  docs-dark-mode_checksums.txt.sig \
  docs-dark-mode_checksums.txt
sha256sum -c docs-dark-mode_checksums.txt   # confirms the .zip matches
```

> Note: this signs the **release artifact** for supply-chain provenance. It's
> independent of the Web Store's own signing of the published `.crx` (which
> Google does on its end and the browser verifies).

**One-time prerequisites:**

1. **Publish the first version manually** (§3) — the API can only *update* an
   existing item, not create one. Note the 32-char extension ID.
2. Create OAuth credentials and a refresh token:
   - Google Cloud Console → new project → enable **Chrome Web Store API**.
   - **OAuth consent screen** (External) → add your own email under **Test
     users** (skipping this causes a 403 later).
   - **Credentials → OAuth client ID → Web application** → add
     `https://developers.google.com/oauthplayground` as an authorized redirect
     URI → save the **client ID + secret**.
   - At [OAuth Playground](https://developers.google.com/oauthplayground): gear →
     *Use your own OAuth credentials* (paste ID+secret) → add the scope
     `https://www.googleapis.com/auth/chromewebstore` → Authorize → Exchange →
     copy the **refresh token**.
   - Ensure the publishing Google account has **2-Step Verification** enabled.
3. Add four repo **secrets**: `CWS_EXTENSION_ID`, `CWS_CLIENT_ID`,
   `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`.

### Secrets & variables summary

| Name | Kind | Used by | Purpose |
|---|---|---|---|
| `DOCS_TEST_URL` | variable | `selector-drift.yml` | view-only (Viewer-shared) test **doc** URL |
| `SHEETS_TEST_URL` | variable | `selector-drift.yml` | view-only (Viewer-shared) test **sheet** URL |
| `SLIDES_TEST_URL` | variable | `selector-drift.yml` | view-only (Viewer-shared) test **presentation** URL |
| `AUTO_FIX_ON_DRIFT` | variable | `selector-drift.yml` | `true` → @claude opens fix PRs |
| `ANTHROPIC_API_KEY` | secret | `claude.yml`, `auto-fix-selectors.yml` | Claude auto-fix |
| `CWS_EXTENSION_ID` | secret | `release.yml` | Web Store item ID (also gates the store-publish step) |
| `CWS_CLIENT_ID` / `CWS_CLIENT_SECRET` / `CWS_REFRESH_TOKEN` | secret | `release.yml` | CWS API OAuth |

Cosign signing needs **no secrets** — it uses the workflow's `id-token: write`
OIDC permission (already set in `release.yml`).

---

## Notes & alternatives

- **Selectors can change.** Google occasionally renames Docs CSS classes; if part
  of the chrome stops theming, update the selectors in `content/dark.css` (and
  `tools/selectors.json`). The §4 drift checks are designed to catch this early.
- **No-extension alternative**: Chrome's `chrome://flags/#enable-force-dark`
  ("Auto Dark Mode for Web Contents") darkens pages at the browser level,
  including the Docs canvas — useful as a fallback, though with less control.
- **Supported apps**: Google Docs (`/document/*`), Sheets (`/spreadsheets/*`),
  and Slides (`/presentation/*`).
  - **Sheets** ("waffle" app) — grid canvas, formula bar, sheet tabs (§9 of
    `dark.css`). The grid is a canvas, so cell colors, conditional formatting and
    charts invert with it (same trade-off as images in Docs).
  - **Slides** ("punch" app) — slides render as **SVG**, and a slide is a design
    artifact, so we deliberately **do not invert the slide** (it keeps its true
    colors and images). Only the editor chrome is darkened: filmstrip, workspace
    backdrop, speaker notes (§10). The white slide sits as a bright rectangle on a
    dark workspace, like a design tool's dark mode.

---

## License

[MIT](./LICENSE).
