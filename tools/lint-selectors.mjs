/* Deterministic selector lint — no network, runs in CI on every push/PR.
 *
 * It extracts every Google-namespaced selector token used in
 * content/dark.css and checks it against the committed registry in
 * tools/selectors.json. This catches accidental drift between the code and
 * what we think we depend on (typos, removed coverage, undocumented adds).
 *
 * It does NOT prove the selectors still exist in today's Google Docs — only a
 * live browser can do that (see tools/check-live-selectors.mjs). It also nudges
 * on staleness via each entry's `lastVerified` date.
 *
 *   node tools/lint-selectors.mjs            # lint (exit 1 on mismatch)
 *   node tools/lint-selectors.mjs --list     # print extracted tokens as JSON
 *   node tools/lint-selectors.mjs --max-age 120   # warn if older than N days
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS_PATH = join(root, "content", "dark.css");
const REGISTRY_PATH = join(root, "tools", "selectors.json");

// A token is "Google's" (something we don't control and Google may rename) if
// its name starts with one of these prefixes. Our own classes are dde-*.
const GOOGLE_PREFIXES = [
  "kix-",
  "docs-",
  "docos-",
  "goog-",
  "menu-",
  "modal-",
  "two-panel-",
  "left-sidebar-",
  "navigation-",
  "outlines-",
  "location-indicator-",
  "grid-",
  "row-headers-",
  "column-headers-",
  "waffle-",
  "formula-",
  "cell-",
  "punch-",
  "filmstrip",
  "workspace",
  "speakernotes",
  "chapter-",
];

function isGoogleToken(name) {
  return GOOGLE_PREFIXES.some((p) => name.startsWith(p));
}

/** Extract `.class` / `#id` tokens from CSS, ignoring comments and pseudos. */
function extractTokens(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = new Set();
  // Match a `.` or `#` followed by an identifier (class or id).
  const re = /([.#])(-?[A-Za-z_][A-Za-z0-9_-]*)/g;
  let m;
  while ((m = re.exec(noComments)) !== null) {
    const sigil = m[1];
    const name = m[2];
    if (name.startsWith("dde-")) continue; // our own gating classes
    if (!isGoogleToken(name)) continue; // body/html/etc. handled elsewhere
    tokens.add(sigil + name);
  }
  return tokens;
}

const args = process.argv.slice(2);
const css = readFileSync(CSS_PATH, "utf8");
const used = extractTokens(css);

if (args.includes("--list")) {
  console.log(JSON.stringify([...used].sort(), null, 2));
  process.exit(0);
}

const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
const documented = new Set(Object.keys(registry.selectors));

const undocumented = [...used].filter((t) => !documented.has(t)).sort();
const stale = [...documented].filter((t) => !used.has(t)).sort();

let failed = false;

if (undocumented.length) {
  failed = true;
  console.error("✖ Selectors used in dark.css but missing from tools/selectors.json:");
  for (const t of undocumented) console.error(`    ${t}`);
  console.error("  → Add them to the registry (with role, criticality, lastVerified).");
}

if (stale.length) {
  failed = true;
  console.error("✖ Selectors in tools/selectors.json but no longer used in dark.css:");
  for (const t of stale) console.error(`    ${t}`);
  console.error("  → Remove them from the registry, or restore them in dark.css.");
}

// Freshness nudge (non-failing): default 180 days.
const maxAgeIdx = args.indexOf("--max-age");
const maxAge = maxAgeIdx !== -1 ? Number(args[maxAgeIdx + 1]) : 180;
// Today is injected by CI via DDE_TODAY (YYYY-MM-DD) so this stays deterministic.
const today = process.env.DDE_TODAY;
if (today) {
  const now = Date.parse(today);
  const oldOnes = Object.entries(registry.selectors)
    .filter(([, v]) => v.lastVerified && (now - Date.parse(v.lastVerified)) / 86400000 > maxAge)
    .map(([k, v]) => `${k} (verified ${v.lastVerified})`);
  if (oldOnes.length) {
    console.warn(`\n⚠ ${oldOnes.length} selector(s) not verified against live Docs in >${maxAge} days:`);
    for (const s of oldOnes) console.warn(`    ${s}`);
    console.warn("  → Run the live drift check or spot-check manually, then bump lastVerified.");
  }
}

if (failed) {
  console.error("\nSelector lint FAILED.");
  process.exit(1);
}
console.log(`✓ Selector lint passed — ${used.size} Google selectors, all documented.`);
