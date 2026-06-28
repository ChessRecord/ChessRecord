/**
 * ui.js — Global UI behaviors (Dropdowns, loaders)
 *
 * Depends on: utils.js (isValidString)
 *
 * Provides small helpers for UI feedback: loader toggles,
 * and a lightweight global initializer for dropdown controls.
 *
 * Exposed globals:
 *   initGlobalUI() → void
 */

"use strict";

/* ─── Global UI Helpers ──────────────────────────────────────────────────── */

/**
 * Show or hide player-title elements depending on their content.
 *
 * Hides when the text is empty or "none" (case-insensitive).
 *
 * @returns {void}
 */
function refreshTitle() {
  document.querySelectorAll(".player-title").forEach((el) => {
    const content = el.textContent.trim().toLowerCase();
    el.style.display = !content || content === "none" ? "none" : "";
  });
}

/**
 * Display a loading state for a target element, saving prior content to restore later.
 *
 * @param {string} target - CSS selector for element whose content will be replaced
 * @param {string} [message] - Optional message to show in place of the element content
 * @returns {void}
 */
function showLoader(target, message) {
  const el = document.querySelector(target);
  if (!el) return;

  if (typeof el._oldLoaderValue === "undefined") {
    el._oldLoaderValue = el.innerHTML;
  }

  // Look for a loader in the same container (e.g., inside the same button)
  const loader = el.parentElement?.querySelector(".loader");
  if (loader) loader.style.display = "inline";

  el.innerHTML = isValidString(message) ? message : "Loading";
}

/**
 * Restore previously saved content and hide any inline loader indicator.
 *
 * @param {string} target - CSS selector for element to restore
 * @returns {void}
 */
function hideLoader(target) {
  const el = document.querySelector(target);
  if (!el) return;

  const loader = el.parentElement?.querySelector(".loader");
  if (loader) loader.style.display = "none";

  if (typeof el._oldLoaderValue !== "undefined") {
    el.innerHTML = el._oldLoaderValue;
    delete el._oldLoaderValue;
  }
}

/* ─── Global UI Initializer ──────────────────────────────────────────────── */

/**
 * Initialize global UI behaviors (options dropdown toggles, outside-click handlers).
 *
 * This is intended to be called once on DOMContentLoaded.
 *
 * @returns {void}
 */
const initGlobalUI = () => {
  const optionsButton = document.querySelector(".options");
  const dropdown = document.querySelector(".dropdown");

  // Toggle on button click; the stopPropagation prevents the document-level
  // click listener below from immediately closing it on the same event.
  optionsButton?.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("show");
  });

  // Close when clicking anywhere outside the dropdown. Only registered when
  // a dropdown exists — no point in a global listener on pages without one.
  if (dropdown) {
    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target)) dropdown.classList.remove("show");
    });
  }
};

document.addEventListener("DOMContentLoaded", initGlobalUI);
