/* Popup UI — reads/writes the toggle state in chrome.storage.local.
 * The content script reacts to those writes via chrome.storage.onChanged,
 * so open Docs tabs update live. */
(function () {
  "use strict";

  var DEFAULTS = { enabled: true, mode: "colorful" };

  var enabledEl = document.getElementById("enabled");
  var modeRow = document.getElementById("mode-row");
  var modeEls = document.querySelectorAll('input[name="mode"]');

  function reflectEnabled(on) {
    modeRow.classList.toggle("is-disabled", !on);
  }

  // Load current state into the controls.
  chrome.storage.local.get(DEFAULTS, function (state) {
    enabledEl.checked = !!state.enabled;
    reflectEnabled(!!state.enabled);
    for (var i = 0; i < modeEls.length; i++) {
      modeEls[i].checked = modeEls[i].value === state.mode;
    }
  });

  // Persist changes.
  enabledEl.addEventListener("change", function () {
    chrome.storage.local.set({ enabled: enabledEl.checked });
    reflectEnabled(enabledEl.checked);
  });

  for (var j = 0; j < modeEls.length; j++) {
    modeEls[j].addEventListener("change", function (e) {
      if (e.target.checked) chrome.storage.local.set({ mode: e.target.value });
    });
  }
})();
