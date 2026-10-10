/**
 * Game files the app can read (.pgn, .json, .chr) and the records it writes (.chr).
 * Pure text in → games out; reading files and showing messages is the caller's job.
 */

import { normalizeGames } from "../domain/game.js";
import { normalizeResult } from "../domain/result.js";
import { isNonEmptyArray } from "../lib/values.js";
import { parseChesSoup } from "./chessoup.js";
import { parsePgn } from "./pgn.js";

/** Every ChesSoup file starts with this registry sentinel. */
const CHESSOUP_MARKER = "§";

/**
 * Parse the text of an uploaded file into normalised games, choosing the parser from
 * the file extension.
 *
 * @param {string} fileName
 * @param {string} content
 * @returns {import("../domain/game.js").Game[]}
 * @throws {Error} with a user-presentable message for unsupported or malformed files
 */
export function parseGameFile(fileName, content) {
  const name = fileName.toLowerCase();
  if (name.endsWith(".pgn")) return normalizeGames(parsePgn(content));
  if (name.endsWith(".chr") && content.trim().startsWith(CHESSOUP_MARKER)) {
    return normalizeGames(parseChesSoup(content));
  }
  if (name.endsWith(".json")) {
    const rawData = JSON.parse(content);
    if (!isNonEmptyArray(rawData)) {
      throw new Error(`"${fileName}" doesn't contain a valid list of games.`);
    }
    return normalizeGames(rawData);
  }
  throw new Error(
    `"${fileName}" is not a supported format. Please use .pgn, .json, or .chr files.`,
  );
}

/**
 * Prepare stored games for export: ids are dropped (they are regenerated on import)
 * and results are written in canonical PGN form. Non-object entries are skipped.
 *
 * @param {import("../domain/game.js").Game[]} games
 */
export function toExportRecords(games) {
  const records = [];
  for (const game of games) {
    if (!game || typeof game !== "object") continue;
    const { id, result, ...rest } = game; // `id` is dropped on purpose
    records.push({ ...rest, result: normalizeResult(result) });
  }
  return records;
}
