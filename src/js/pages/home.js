/**
 * Entry point of index.html (the games list).
 *
 * Creates the store and hands it to the page features. Module scripts are deferred,
 * so the DOM is fully parsed by the time this runs.
 */

import { initGamesList } from "../features/games-list/games-list.js";
import { printBanner } from "../lib/banner.js";
import { requireElement } from "../lib/dom.js";
import { createGameStore } from "../storage/game-store.js";
import { initDropdownMenu } from "../ui/dropdown-menu.js";
import { initThemeToggle } from "../ui/theme-toggle.js";

async function main() {
  printBanner();

  const menu = initDropdownMenu({
    toggle: requireElement(".menu-toggle"),
    menu: requireElement(".dropdown"),
  });
  initThemeToggle();

  // The store starts opening IndexedDB right away; the list features are only
  // attached once the saved games have been read.
  const store = createGameStore();
  await store.load();
  initGamesList({ store, menu });
}

main().catch((error) => console.error(error));
