/** Elo arithmetic. */

/**
 * Expected score of a player against an opponent (0..1).
 *
 * @param {number} myRating
 * @param {number} oppRating
 */
export function expectedScore(myRating, oppRating) {
  return 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
}

/**
 * Projected rating change for one game, rounded to one decimal.
 * Returns "" when the opponent is unrated (rating 0), where no estimate is possible.
 *
 * @param {number} myRating
 * @param {number} oppRating
 * @param {number} result 1 = win, 0.5 = draw, 0 = loss
 * @param {number} [k=40] K-factor
 * @returns {number | ""}
 */
export function calcChange(myRating, oppRating, result, k = 40) {
  if (oppRating === 0) return "";
  const expected = expectedScore(myRating, oppRating);
  return Math.round(k * (result - expected) * 10) / 10;
}
