/**
 * Press "/" anywhere on the page to jump to the search box; Escape leaves it again.
 *
 * Ignored while typing in another field, while a dialog is open, when a modifier key
 * is held, or during IME composition.
 */

import { isModalOpen } from "../../ui/modal.js";

/**
 * @param {Object} options
 * @param {HTMLInputElement} options.search
 * @param {{ close: () => void }} options.menu Closed when the shortcut moves focus
 */
export function initSearchShortcut({ search, menu }) {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
      return;
    }

    const target = event.target;
    const isTyping =
      target instanceof HTMLElement &&
      (target.isContentEditable || target.matches("input, textarea, select"));
    if (isTyping) return;

    // Don't pull focus out from behind an open dialog.
    if (isModalOpen()) return;

    event.preventDefault(); // keeps "/" out of the field and off Firefox's quick-find
    menu.close();
    search.focus();
    search.select();
  });

  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") search.blur();
  });
}
