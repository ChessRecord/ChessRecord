/**
 * Click-to-toggle dropdown menu that closes when the user clicks anywhere outside it.
 * The menu is shown by the `show` class.
 */

/**
 * @param {{ toggle: HTMLElement, menu: HTMLElement }} elements
 * @returns {{ close: () => void }}
 */
export function initDropdownMenu({ toggle, menu }) {
  const close = () => menu.classList.remove("show");

  // stopPropagation stops the document listener below from closing the menu on the
  // very click that opened it.
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.classList.toggle("show");
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target)) close();
  });

  return { close };
}
