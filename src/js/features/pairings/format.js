/** Display formatting for the pairings page. */

import { calcChange } from "../../domain/rating.js";
import { formatSigned } from "../../lib/text.js";
import { isNonEmptyString } from "../../lib/values.js";

/**
 * Chess-Results writes half points as "0,5" / ",5"; show them as "½" (an HTML entity,
 * so the result is for innerHTML).
 *
 * @param {string} raw
 */
export const normalisePoints = (raw) =>
  isNonEmptyString(raw) ? raw.replace(/0?,5/g, "&#189;") : "";

/**
 * Projected rating change for one game as "+N" / "-N", or "" when it cannot be projected.
 *
 * @param {number} playerRating
 * @param {number} opponentRating
 * @param {number} score 1 = win, 0.5 = draw, 0 = loss
 */
export function formatRatingDelta(playerRating, opponentRating, score) {
  const delta = calcChange(playerRating, opponentRating, score);
  return delta === "" ? "" : formatSigned(delta);
}
