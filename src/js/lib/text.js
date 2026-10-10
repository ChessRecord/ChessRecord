/** String helpers with no dependencies. */

import { isNonEmptyString } from "./values.js";

/** Capitalise every whitespace-delimited word ("o'BRIEN jr" → "O'brien Jr"). */
export function capitalize(str) {
  if (!isNonEmptyString(str)) return "";
  return str.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Escape a string so it can be embedded in a RegExp source. */
export const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Build a function that wraps every case-insensitive occurrence of `query` in
 * `<strong>`. The RegExp is compiled once, so reuse the returned function when
 * highlighting many strings. Returns HTML: callers insert it with innerHTML.
 *
 * @param {string} query Non-empty text to look for (an empty query would match everywhere).
 * @returns {(text: string) => string}
 */
export function createHighlighter(query) {
  const pattern = new RegExp(`(${escapeRegExp(query)})`, "gi");
  return (text) => text.replace(pattern, "<strong>$1</strong>");
}

/** "+5", "-3", "0" for a number; "0" for anything non-numeric. */
export function formatSigned(value) {
  const n = +value;
  return Number.isNaN(n) ? "0" : (n > 0 ? "+" : "") + (n || 0);
}

// Mathematical Sans-Serif Bold block (U+1D5D4 "𝗔" …, digits from U+1D7EC "𝟬").
const BOLD_SANS_LETTERS = 0x1d5d4;
const BOLD_SANS_DIGITS = 0x1d7ec;

/** Convert ASCII letters and digits to Unicode bold sans-serif; other characters pass through. */
export function toBoldSans(str) {
  if (!isNonEmptyString(str)) return "";
  let result = "";
  for (const char of str) {
    const code = char.charCodeAt(0);
    const letterIndex =
      code >= 65 && code <= 90 ? code - 65 : code >= 97 && code <= 122 ? code - 71 : -1;
    if (letterIndex > -1) {
      result += String.fromCodePoint(letterIndex + BOLD_SANS_LETTERS);
    } else if (code >= 48 && code <= 57) {
      result += String.fromCodePoint(code - 48 + BOLD_SANS_DIGITS);
    } else {
      result += char;
    }
  }
  return result;
}
