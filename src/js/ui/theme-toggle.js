/**
 * Light/dark theme: restores the saved preference and adds the floating toggle button.
 * The preference lives in localStorage ("darkTheme" → true/false).
 */

import { localEntry } from "../storage/web-storage.js";

const DARK_CLASS = "dark-theme";
const preference = localEntry("darkTheme");

export function initThemeToggle() {
  if (preference.get() === true) document.body.classList.add(DARK_CLASS);

  const button = document.createElement("button");
  button.id = "theme-toggle-btn";
  button.innerHTML = '<i class="fa-solid fa-circle-half-stroke"></i>';
  button.addEventListener("click", () => {
    preference.set(document.body.classList.toggle(DARK_CLASS));
  });
  document.body.appendChild(button);
}
