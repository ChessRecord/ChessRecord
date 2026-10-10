/**
 * Entry point of pairings.html.
 * Module scripts are deferred, so the DOM is fully parsed by the time this runs.
 */

import { initPairingsPage } from "../features/pairings/pairings-page.js";
import { printBanner } from "../lib/banner.js";
import { requireElement } from "../lib/dom.js";
import { initThemeToggle } from "../ui/theme-toggle.js";

printBanner();

// Never let the browser submit (and reload) the page natively.
requireElement("#pairings-form").addEventListener("submit", (event) => event.preventDefault());

initThemeToggle();
initPairingsPage();
