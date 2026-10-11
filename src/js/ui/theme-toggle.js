/**
 * Light/dark theme: restores the saved preference and adds the floating toggle button.
 * The preference lives in localStorage ("darkTheme" → true/false).
 *
 * The theme is the `dark-theme` class on <html>. theme-init.js normally sets it before the
 * first paint; `initThemeToggle` sets it again so the page is right even without that script.
 */

import { localEntry } from "../storage/web-storage.js";

const DARK_CLASS = "dark-theme";
const preference = localEntry("darkTheme");

export function initThemeToggle() {
  const root = document.documentElement;
  if (preference.get() === true) root.classList.add(DARK_CLASS);

  const button = document.createElement("button");
  button.id = "theme-toggle-btn";
  button.type = "button";
  button.setAttribute("aria-label", "Toggle dark theme");
  button.innerHTML = '<i class="fa-solid fa-circle-half-stroke" aria-hidden="true"></i>';
  button.addEventListener("click", () => {
    preference.set(root.classList.toggle(DARK_CLASS));
  });
  document.body.appendChild(button);
}
