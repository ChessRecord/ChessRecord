/**
 * Game results come in several spellings ("1-0", "1 - 0", "½ - ½", "1/2-1/2").
 * Games keep whatever spelling they were entered with; these helpers convert to
 * a display form or to the canonical PGN form on the way out.
 */

import { isNonEmptyString } from "../lib/values.js";

/** Trim, turn "½" into "1/2" and drop all whitespace. */
const cleanResult = (result) => result.trim().replace(/½/g, "1/2").replace(/\s+/g, "");

/**
 * Display form: "1-0" → "1 - 0", "1/2-1/2" → "½ - ½".
 * Unrecognised text is returned trimmed; invalid input yields "*".
 *
 * @param {string} result
 * @returns {string}
 */
export function formatResult(result) {
  if (!isNonEmptyString(result)) return "*";
  switch (cleanResult(result)) {
    case "1-0":
      return "1 - 0";
    case "0-1":
      return "0 - 1";
    case "1/2-1/2":
      return "½ - ½";
    default:
      return result.trim();
  }
}

/**
 * Canonical PGN form: "1-0", "0-1" or "1/2-1/2". Anything else maps to "*".
 *
 * @param {string} result
 * @returns {string}
 */
export function normalizeResult(result) {
  if (!isNonEmptyString(result)) return "*";
  const cleaned = cleanResult(result);
  switch (cleaned) {
    case "1-0":
    case "0-1":
    case "1/2-1/2":
      return cleaned;
    default:
      return "*";
  }
}
