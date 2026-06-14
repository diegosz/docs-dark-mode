/* Live selector drift check — opens a REAL Google Docs/Sheets editor in a
 * headless browser and verifies the selectors content/dark.css depends on still
 * exist.
 *
 * No Google login required: point the URL at a throwaway file shared "Anyone
 * with the link -> Viewer". A logged-out browser renders the read-only editor,
 * which still contains the selectors we assert as critical (page/canvas/grid,
 * app shell, menubar). (Automating an actual Google *login* is blocked/ToS-risky
 * — this avoids it entirely; Viewer also keeps the test files un-editable.)
 *
 * Note: the Docs *formatting toolbar* (#docs-toolbar-wrapper, .goog-toolbar-*)
 * only loads in EDIT mode, so those selectors are registered presence:"variable"
 * (skipped here) and covered instead by the deterministic lint + the runtime
 * self-check in content.js. Sheets/Slides keep their toolbars in view mode.
 *
 * App-aware: pass --app=docs (default) or --app=sheets. Each app asserts only
 * the selectors that apply to it (registry `app` field: "docs", "sheets", or
 * "both"; legacy entries with no field default to "docs") and waits for that
 * app's shell. Only presence:"load" selectors are asserted; critical:true misses
 * fail the run (exit 1), others are warnings.
 *
 *   node tools/check-live-selectors.mjs <url> --app=docs
 *   DDE_APP=sheets TEST_URL="https://docs.google.com/spreadsheets/d/XXXX/edit" node tools/check-live-selectors.mjs
 *
 * On critical drift it writes selector-drift-report.json (with candidate DOM for
 * triage) and exits 1. Exit 2 = misconfigured (no URL / shell never loaded).
 * Set CHROMIUM_PATH to use a system browser (e.g. /snap/bin/chromium locally).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(readFileSync(join(root, "tools", "selectors.json"), "utf8"));
const REPORT_PATH = join(root, "selector-drift-report.json");

const args = process.argv.slice(2);
const appArg = (args.find((a) => a.startsWith("--app=")) || "").split("=")[1];
const APP = (appArg || process.env.DDE_APP || "docs").toLowerCase(); // "docs" | "sheets"
const url =
  args.find((a) => a.startsWith("http")) ||
  process.env.TEST_URL ||
  process.env.DOCS_TEST_URL ||
  process.env.SHEETS_TEST_URL;

// The shell element that proves the editor for this app has loaded.
const SHELL = { docs: ".kix-appview-editor", sheets: ".grid-container", slides: ".workspace-container" };
const shellSel = SHELL[APP] || SHELL.docs;

if (!url) {
  console.error("✖ No URL. Pass it as an argument or set TEST_URL / DOCS_TEST_URL.");
  process.exit(2);
}
if (!SHELL[APP]) {
  console.error(`✖ Unknown --app=${APP}. Use "docs" or "sheets".`);
  process.exit(2);
}

// A selector applies to the current app if its `app` is "both" or matches APP;
// entries with no `app` field are legacy Docs/shared selectors -> treated "docs".
const appliesToApp = (meta) => {
  const a = meta.app || "docs";
  return a === "both" || a === APP;
};

const assertable = Object.entries(registry.selectors).filter(
  ([, v]) => v.presence === "load" && appliesToApp(v)
);
const criticalSel = assertable.filter(([, v]) => v.critical).map(([k]) => k);
const optionalSel = assertable.filter(([, v]) => !v.critical).map(([k]) => k);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
let exitCode = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  console.log(`[${APP}] Opening ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Wait for the editor shell. If it never appears, the doc probably isn't
  // shared "Anyone with link -> Viewer" (or Google changed the shell) — a misconfiguration.
  try {
    await page.waitForSelector(shellSel, { timeout: 45000 });
  } catch {
    console.error(`✖ ${APP} editor shell (${shellSel}) never loaded.`);
    console.error("  Is the URL shared 'Anyone with the link -> Viewer'? Did the shell selector change?");
    process.exit(2);
  }
  // Give the canvas + chrome time to paint.
  await page.waitForTimeout(8000);

  async function countMissing(selectors) {
    const missing = [];
    for (const sel of selectors) {
      const n = await page.locator(sel).count();
      if (n === 0) missing.push(sel);
    }
    return missing;
  }

  const missingCritical = await countMissing(criticalSel);
  const missingOptional = await countMissing(optionalSel);

  if (missingOptional.length) {
    console.warn(`⚠ ${missingOptional.length} non-critical selector(s) not found (may be view-dependent):`);
    for (const s of missingOptional) console.warn(`    ${s}  (${registry.selectors[s].role})`);
  }

  if (missingCritical.length) {
    exitCode = 1;
    console.error(`\n✖ ${missingCritical.length} CRITICAL ${APP} selector(s) missing from the live page:`);
    for (const s of missingCritical) console.error(`    ${s}  (${registry.selectors[s].role})`);

    // Capture candidate DOM so a human / the auto-fix workflow has the "what".
    const candidates = await page.evaluate(() => {
      const ids = [...new Set([...document.querySelectorAll("[id]")].map((e) => "#" + e.id))];
      const topClasses = new Set();
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.top < 140 && r.width > 0 && r.height > 0) {
          el.classList.forEach((c) => topClasses.add("." + c));
        }
      }
      return { ids: ids.slice(0, 250), topRegionClasses: [...topClasses].sort() };
    });

    writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          app: APP,
          checkedAt: process.env.DDE_TODAY || null,
          url,
          missingCritical: missingCritical.map((s) => ({ selector: s, role: registry.selectors[s].role })),
          missingOptional,
          candidateDom: candidates,
        },
        null,
        2
      )
    );
    console.error(`\nWrote ${REPORT_PATH} with candidate DOM for triage.`);
  } else {
    console.log(`\n✓ All ${criticalSel.length} critical ${APP} selectors present in the live page.`);
  }
} finally {
  await browser.close();
}
process.exit(exitCode);
