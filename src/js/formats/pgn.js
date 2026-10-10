/** PGN import: turns PGN text (for example a Lichess study export) into game records. */

import { isNonEmptyString, toNumberOr } from "../lib/values.js";

/**
 * Return a cached RegExp for extracting a PGN tag value like [Event "..."]
 * Caches compiled expressions to avoid repeated RegExp allocation.
 *
 * @returns {(tag:string) => RegExp}
 */
const getTagRegex = (() => {
  const cache = new Map();
  return (tag) => {
    if (!cache.has(tag)) cache.set(tag, new RegExp(`\\[${tag}\\s"([^"]*)"\\]`));
    return cache.get(tag);
  };
})();

/**
 * Parse PGN text into game records (not yet normalised). Games are separated by a
 * blank line followed by an `[Event` header. Returns [] for empty or invalid input.
 *
 * @param {string} pgn
 * @returns {Object[]}
 */
export function parsePgn(pgn) {
  if (!isNonEmptyString(pgn)) return [];
  const games = pgn.split(/\r?\n\r?\n(?=\[Event)/).filter(Boolean);
  return games.map((game, idx) => {
    const getTag = (tag) => game.match(getTagRegex(tag))?.[1] ?? "";
    const resultStr = getTag("Result").trim();
    const roundParts = getTag("Round").split(".");
    return {
      white: getTag("White").trim() || "Unknown",
      whiteRating: Math.max(0, toNumberOr(getTag("WhiteElo"), 0)),
      whiteTitle: getTag("WhiteTitle").trim() || "",
      black: getTag("Black").trim() || "Unknown",
      blackRating: Math.max(0, toNumberOr(getTag("BlackElo"), 0)),
      blackTitle: getTag("BlackTitle").trim() || "",
      result: resultStr,
      tournament: (getTag("StudyName") || getTag("Event")).trim().split(":").pop() || "Unknown",
      round: Math.max(1, toNumberOr(roundParts[0] || NaN, idx + 1)),
      board: toNumberOr(getTag("Board"), 0) || toNumberOr(roundParts[1], 0) || null,
      time: getTag("TimeControl").trim() || "",
      date: getTag("Date").replace(/\./g, "-") || "",
      gameLink: getTag("ChapterURL") || getTag("Site") || "",
    };
  });
}
