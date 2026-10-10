/**
 * Entry point of new.html (the New Game form).
 * Module scripts are deferred, so the DOM is fully parsed by the time this runs.
 */

import { initNewGameForm } from "../features/new-game/new-game-form.js";
import { printBanner } from "../lib/banner.js";
import { requireElement } from "../lib/dom.js";
import { createGameStore } from "../storage/game-store.js";
import { initCustomSelects } from "../ui/custom-select.js";
import { initThemeToggle } from "../ui/theme-toggle.js";

async function main() {
  printBanner();

  // Never let the browser submit (and reload) the page natively, not even during the
  // short window while the saved games are still loading.
  requireElement("#game-form").addEventListener("submit", (event) => event.preventDefault());

  initThemeToggle();
  initCustomSelects();

  // Duplicate detection needs the saved games, so wire the form up once they are loaded.
  const store = createGameStore();
  await store.load();
  initNewGameForm({ store });
}

main().catch((error) => console.error(error));
