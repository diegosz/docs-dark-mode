/* Dark Mode for Google Docs — content script (runs at document_start).
 *
 * Its only job is to add/remove classes on <html>:
 *   - dde-enabled         -> dark mode is on
 *   - dde-mode-grayscale  -> use the grayscale page filter
 *   - dde-mode-colorful   -> use the colour-preserving page filter (default)
 * dark.css does the rest. Keeping the toggle in a class means the CSS is
 * always present but inert until enabled, which is what kills the flash.
 */
(function () {
  "use strict";

  var DEFAULTS = { enabled: true, mode: "colorful" };
  var CACHE_KEY = "dde:state"; // page-origin localStorage cache for instant paint

  function applyState(state) {
    var root = document.documentElement;
    if (!root) return;
    root.classList.toggle("dde-enabled", !!state.enabled);
    var grayscale = state.mode === "grayscale";
    root.classList.toggle("dde-mode-grayscale", grayscale);
    root.classList.toggle("dde-mode-colorful", !grayscale);
  }

  // 1. INSTANT PAINT: read the last-known state synchronously from the page's
  //    own localStorage so the dark theme is applied before the first paint,
  //    with no flash of the light UI on reload. chrome.storage is async and
  //    would otherwise let one light frame slip through.
  try {
    var cached = JSON.parse(window.localStorage.getItem(CACHE_KEY));
    if (cached) applyState(cached);
  } catch (e) {
    /* first run, private mode, or blocked storage — ignore */
  }

  function syncFromChromeStorage() {
    chrome.storage.local.get(DEFAULTS, function (state) {
      applyState(state);
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(state));
      } catch (e) {
        /* ignore */
      }
    });
  }

  // 2. AUTHORITATIVE STATE: chrome.storage is the source of truth (the popup
  //    writes here). Reconcile and refresh the localStorage cache.
  syncFromChromeStorage();

  // 3. LIVE UPDATES: toggling in the popup updates every open Docs tab without
  //    a reload.
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local") syncFromChromeStorage();
  });

  // 4. SELECTOR SELF-CHECK (developer aid, opt-in): the single most reliable way
  //    to catch Google renaming a class is to look in the user's own logged-in
  //    session, where every selector actually exists. To enable, run in the
  //    Docs tab console:  localStorage.setItem('dde:debug', '1')
  //    Then reload. Zero-match "must be present" selectors are logged. Off by
  //    default so normal users never see console noise. Keep this list aligned
  //    with the critical presence:"load" entries in tools/selectors.json.
  try {
    if (window.localStorage.getItem("dde:debug") === "1") {
      var MUST_BE_PRESENT = [
        ".kix-appview-editor",
        ".kix-canvas-tile-content",
        "#docs-toolbar-wrapper",
        "#docs-menubars",
      ];
      window.addEventListener("load", function () {
        // Give the canvas + toolbar a few seconds to render before checking.
        window.setTimeout(function () {
          var missing = MUST_BE_PRESENT.filter(function (sel) {
            return document.querySelectorAll(sel).length === 0;
          });
          if (missing.length) {
            console.warn(
              "[Docs Dark Mode] selector drift — these no longer match any element:",
              missing,
              "\nGoogle may have renamed them; update content/dark.css + tools/selectors.json."
            );
          } else {
            console.info("[Docs Dark Mode] selector self-check OK (" + MUST_BE_PRESENT.length + " selectors).");
          }
        }, 6000);
      });
    }
  } catch (e) {
    /* ignore */
  }
})();
