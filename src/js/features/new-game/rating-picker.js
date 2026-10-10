/** Choosing which of a player's three FIDE ratings fits a game. */

import { getTimeControlCategory } from "../../domain/time-control.js";

/**
 * Pick the rating matching the game's time control: Classical → standard, Rapid → rapid,
 * Blitz and Bullet → blitz. With no time control (or an unclassifiable one) the standard
 * rating is used.
 *
 * @param {{ standard?: number, rapid?: number, blitz?: number }} ratings
 * @param {string} [time] Time control as typed, e.g. "10+5"
 * @returns {number}
 */
export function pickRating({ standard = 0, rapid = 0, blitz = 0 } = {}, time) {
  if (!time?.trim()) return standard;
  return (
    { Classical: standard, Rapid: rapid, Blitz: blitz, Bullet: blitz }[
      getTimeControlCategory(time)
    ] ?? standard
  );
}
