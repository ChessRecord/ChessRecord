/** Pure rules for turning the raw New Game form values into a stored game. */

import { generateGameId } from "../../domain/game.js";
import { abbreviateTitle, toDisplayName } from "../../domain/player.js";
import { toNumberOr } from "../../lib/values.js";

/**
 * @typedef {Object} RawPlayer
 * @property {string} rawName    Trimmed
 * @property {string} rawTitle
 * @property {string} rawRating
 *
 * @typedef {Object} FormState
 * @property {string} result       The select's raw value; "0" means nothing chosen yet
 * @property {string} time
 * @property {string} tournament
 * @property {number} round
 * @property {string} date
 * @property {string} gameLink
 * @property {{ white: RawPlayer, black: RawPlayer }} players
 */

/**
 * Cheap checks on the raw form state.
 * @param {FormState} state
 * @returns {string | null} A message for the user, or null when the form is acceptable
 */
export function validateFormState(state) {
  if (state.result === "0") return "Please select a result!";
  if (!state.players.white.rawName) return "White player name cannot be empty!";
  if (!state.players.black.rawName) return "Black player name cannot be empty!";
  if (!state.gameLink) return "Please enter a game link!";
  return null;
}

/** Raw text inputs → clean `{ name, title, rating }` for each side. */
export function formatPlayers({ white, black }) {
  const format = ({ rawName, rawTitle, rawRating }) => ({
    name: toDisplayName(rawName),
    title: abbreviateTitle(rawTitle.toUpperCase()),
    rating: toNumberOr(rawRating, 0),
  });
  return { white: format(white), black: format(black) };
}

/**
 * Assemble a game record (not yet normalised: tournament and link are still untrimmed,
 * and there is no board number).
 *
 * @param {ReturnType<typeof formatPlayers>} players
 * @param {Pick<FormState, "result" | "time" | "tournament" | "round" | "date" | "gameLink">} fields
 */
export function buildGame(players, { result, time, tournament, round, date, gameLink }) {
  return {
    id: generateGameId(),
    white: players.white.name,
    whiteRating: players.white.rating,
    whiteTitle: players.white.title,
    black: players.black.name,
    blackRating: players.black.rating,
    blackTitle: players.black.title,
    result,
    tournament,
    round,
    time,
    date,
    gameLink,
  };
}
