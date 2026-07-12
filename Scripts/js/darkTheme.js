/**
 * darkTheme.js — Dark theme toggle
 * Depends on: utils.js (Storage)
 *
 * Creates a fixed-position toggle button that switches the <body> between
 * light and dark themes. The user's preference is persisted in localStorage
 * and restored on every page load.
 *
 * Exposed globals: none (auto-initializes on DOMContentLoaded)
 */

"use strict";

(() => {
  const storage = Storage.proxy("darkTheme");

  function toggleTheme() {
    const isDark = document.body.classList.toggle("dark-theme");
    storage.set(isDark);
  }

  function loadThemePreference() {
    if (storage.get() === true) document.body.classList.add("dark-theme");
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadThemePreference();

    const btn = document.createElement("button");
    btn.id = "theme-toggle-btn";
    btn.innerHTML = '<i class="fa-solid fa-circle-half-stroke"></i>';
    btn.addEventListener("click", toggleTheme);
    document.body.appendChild(btn);
  });
})();
