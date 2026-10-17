/**
 * Keyboard shortcuts for the games list page:
 * - Press "/" anywhere on the page to jump to the search box; Escape leaves it again.
 * - Press "Ctrl+E" to export games.
 * - Press "Ctrl+I" to open the import file picker.
 *
 * Shortcuts are ignored while a dialog is open, during IME composition,
 * or when typing in an editable field (for non-modifier shortcuts).
 */

import { isModalOpen } from "../../ui/modal.js";

/**
 * @param {Object} options
 * @param {HTMLInputElement} options.search
 * @param {{ close: () => void }} options.menu Closed when a shortcut moves focus or triggers an action
 * @param {() => void} [options.onExport] Called when Ctrl+E is pressed
 * @param {() => void} [options.onImport] Called when Ctrl+I is pressed
 */
export function initSearchShortcut({ search, menu, onExport, onImport }) {
  document.addEventListener("keydown", (event) => {
    if (event.isComposing) return;

    // Don't pull focus or trigger actions from behind an open dialog.
    if (isModalOpen()) return;

    const hasModifier = event.ctrlKey || event.metaKey;

    if (event.key === "/" && !hasModifier && !event.altKey) {
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches("input, textarea, select"));
      if (isTyping) return;

      event.preventDefault(); // keeps "/" out of the field and off Firefox's quick-find
      menu.close();
      search.focus();
      search.select();
      return;
    }

    if (hasModifier && !event.altKey && !event.shiftKey) {
      const target = event.target;
      if (target instanceof HTMLElement && target.isContentEditable) return;

      const key = event.key.toLowerCase();
      if (key === "e" && onExport) {
        event.preventDefault();
        menu.close();
        onExport();
      } else if (key === "i" && onImport) {
        event.preventDefault();
        menu.close();
        onImport();
      }
    }
  });

  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") search.blur();
  });
}

export const initShortcuts = initSearchShortcut;

