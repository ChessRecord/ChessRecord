/** Client for the Lichess FIDE player API. */

import { normalizeFidePlayer } from "../../domain/player.js";

const FIDE_BASE = "https://lichess.org/api/fide/player";
const FIDE_API_TIMEOUT = 5000;

/**
 * Fetch one FIDE player by numeric FIDE ID.
 *
 * @param {string | number} id
 * @returns {Promise<ReturnType<typeof normalizeFidePlayer>>}
 * @throws {Error} for an invalid id, a non-OK response, a timeout (5 s) or an unknown player
 */
export async function fetchFidePlayer(id) {
  if (!id || isNaN(id)) throw new Error(`Invalid FIDE ID: ${id}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FIDE_API_TIMEOUT);
  try {
    const res = await fetch(`${FIDE_BASE}/${id}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    if (!data.name) throw new Error(`No player found for FIDE ID: ${id}`);
    return normalizeFidePlayer(data);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Search players by name. The caller passes an AbortSignal so a request can be cancelled
 * when the query changes.
 *
 * @param {string} query
 * @param {AbortSignal} signal
 * @returns {Promise<ReturnType<typeof normalizeFidePlayer>[] | null>}
 *          null when the request was aborted on purpose; [] on any other failure
 */
export async function fetchPlayerSuggestions(query, signal) {
  try {
    const res = await fetch(`${FIDE_BASE}?q=${encodeURIComponent(query.trim())}`, { signal });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return (await res.json()).map(normalizeFidePlayer);
  } catch (error) {
    if (error.name === "AbortError") return null;
    console.error("Error fetching player suggestions:", error);
    return [];
  }
}
