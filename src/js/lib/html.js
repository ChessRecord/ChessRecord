/**
 * Helpers for building HTML strings out of untrusted text.
 *
 * Game records come from files the user imports, FIDE search results and scraped
 * Chess-Results pages, so none of their text may be interpolated into `innerHTML` as it is.
 */

const ENTITIES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

/**
 * Escape a value for use as HTML text or inside a quoted attribute value (`"` and `'` are
 * escaped, so it is safe in both). `null` and `undefined` become "".
 *
 * @param {unknown} value
 * @returns {string}
 */
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);

/**
 * Is `url` safe to use as a link target? Escaping cannot make `javascript:` or `data:` URLs
 * harmless, so only http(s) links qualify. Relative URLs resolve against the page and count
 * as safe, because that is exactly how the browser will treat them.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isSafeUrl(url) {
  try {
    const { protocol } = new URL(url, document.baseURI);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
