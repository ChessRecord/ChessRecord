/**
 * The canonical game record plus the rules that operate on lists of games:
 * normalising untrusted input, ordering for display and duplicate detection.
 */

import { isNonEmptyArray, isEmpty, toNumberOr } from "../lib/values.js";

/**
 * @typedef {Object} Game
 * @property {string} id            Unique id (UUID); regenerated on import
 * @property {string} white
 * @property {number} whiteRating   0 when unknown
 * @property {string} whiteTitle    "" when untitled
 * @property {string} black
 * @property {number} blackRating   0 when unknown
 * @property {string} blackTitle    "" when untitled
 * @property {string} result        As entered ("1-0", "1 - 0", "½ - ½", "*", …)
 * @property {string} tournament
 * @property {number} round         >= 1
 * @property {number | null} board  null when the game has no board number
 * @property {string} time          Time control such as "90+30" ("" when unknown)
 * @property {string} date          "YYYY-MM-DD" ("" when unknown)
 * @property {string} gameLink      URL of the game
 */

export const generateGameId = () => crypto.randomUUID();

/**
 * Coerce one untrusted record into the canonical {@link Game} shape.
 *
 * NOTE: the `(x || fallback).trim()` expressions are kept exactly as they were. When a
 * value has the wrong type the engine's TypeError message quotes the failing expression,
 * and that message is shown to the user in the import dialog.
 *
 * @param {any} game
 * @returns {Game}
 */
export function normalizeGame(game) {
  return {
    id: game.id || generateGameId(),
    white: (game.white || "Unknown").trim(),
    whiteRating: toNumberOr(game.whiteRating, 0),
    whiteTitle: (game.whiteTitle || "").trim(),
    black: (game.black || "Unknown").trim(),
    blackRating: toNumberOr(game.blackRating, 0),
    blackTitle: (game.blackTitle || "").trim(),
    result: (game.result || "*").trim(),
    tournament: (game.tournament || "Unknown").trim(),
    round: Math.max(1, toNumberOr(game.round, 1)),
    board: toNumberOr(game.board, null) || null, // board 0 is treated as "no board"
    time: (game.time || "").trim(),
    date: (game.date || "").replace(/\./g, "-").trim(),
    gameLink: (game.gameLink || "").trim(),
  };
}

/**
 * @param {unknown} games
 * @returns {Game[]} Empty when `games` is not a non-empty array
 */
export function normalizeGames(games) {
  if (!isNonEmptyArray(games)) return [];
  return games.map((game) => normalizeGame(game));
}

/**
 * Sort in place for display:
 *   1. tournament date, newest first (a tournament is dated by its latest game)
 *   2. tournament name, alphabetical
 *   3. round, ascending
 *   4. board, ascending (games without a board first)
 *
 * @param {Game[]} games
 */
export function sortGames(games) {
  if (isEmpty(games)) return;

  // Compute each tournament's newest date once, instead of parsing dates inside the comparator.
  const tournamentMaxDates = new Map();
  for (const g of games) {
    const t = g.tournament || "Unknown";
    const d = g.date ? Date.parse(g.date) : 0;
    const currentMax = tournamentMaxDates.get(t) || 0;
    if (!isNaN(d) && d > currentMax) {
      tournamentMaxDates.set(t, d);
    }
  }

  games.sort((a, b) => {
    const dateA = tournamentMaxDates.get(a.tournament || "Unknown") || 0;
    const dateB = tournamentMaxDates.get(b.tournament || "Unknown") || 0;
    if (dateB !== dateA) return dateB - dateA;

    if (a.tournament !== b.tournament)
      return (a.tournament || "").localeCompare(b.tournament || "");

    const roundDiff = (a.round ?? 0) - (b.round ?? 0);
    if (roundDiff !== 0) return roundDiff;

    if (a.board === b.board) return 0;
    if (a.board == null) return -1;
    if (b.board == null) return 1;
    return a.board - b.board;
  });
}

/**
 * Would `candidate` clash with an existing game in the same tournament, round and date?
 * A clash is the same White player OR the same Black player (a player cannot play twice
 * in a round); it does not catch a player appearing with the opposite colour.
 *
 * @param {Game[]} games
 * @param {Pick<Game, "white" | "black" | "date" | "tournament" | "round">} candidate
 */
export function isDuplicateGame(games, { white, black, date, tournament, round }) {
  return games.some(
    (g) =>
      (g.white === white || g.black === black) &&
      g.date === date &&
      g.tournament === tournament &&
      g.round === round,
  );
}
