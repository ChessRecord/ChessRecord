/** Tiny DOM helpers shared by every page. */

/**
 * Look up an element that the page markup is required to contain.
 * Failing loudly beats a confusing "cannot read properties of null" later on.
 *
 * @template {Element} [T=HTMLElement]
 * @param {string} selector CSS selector (usually an id selector)
 * @param {ParentNode} [root=document]
 * @returns {T}
 */
export function requireElement(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return /** @type {T} */ (element);
}

/** Resolve after the browser has painted, so UI changes are visible before a blocking `alert()`. */
export const afterNextPaint = () =>
  new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
