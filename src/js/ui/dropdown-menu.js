/**
 * Click-to-toggle dropdown menu that closes when the user clicks anywhere outside it.
 * The menu is shown by the `show` class; the toggle's `aria-expanded` follows it.
 */

/**
 * @param {{ toggle: HTMLElement, menu: HTMLElement }} elements
 * @returns {{ close: () => void }}
 */
export function initDropdownMenu({ toggle, menu }) {
  /** The one place that opens or closes the menu, so the class and ARIA state cannot disagree. */
  const setOpen = (isOpen) => {
    menu.classList.toggle("show", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  };
  const close = () => setOpen(false);

  // stopPropagation stops the document listener below from closing the menu on the
  // very click that opened it.
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(!menu.classList.contains("show"));
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target)) close();
  });

  return { close };
}
