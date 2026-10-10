/**
 * Fetching a player's Chess-Results page (through the CORS proxy) and turning it into
 * the data the pairings table shows.
 */

import { toNumberOr, isEmpty } from "../../lib/values.js";
import { parseHtml, parsePairings, parsePlayerInfo } from "./chess-results-parser.js";
import { formatRatingDelta, normalisePoints } from "./format.js";

/** chess-results.com sends no CORS headers, so pages are fetched through this relay. */
const PROXY_URL = "https://proxy.chessrecord.workers.dev/";

/**
 * Fetch raw HTML through the proxy.
 *
 * @param {string} url
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
async function fetchPage(url, signal) {
  const res = await fetch(PROXY_URL + url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching page.`);
  return res.text();
}

/** Fetch one opponent's profile page and return their Rank ("" if unknown or on any failure). */
async function fetchOpponentRank(profileUrl, signal) {
  try {
    const rank = parsePlayerInfo(parseHtml(await fetchPage(profileUrl, signal)))["Rank"];
    return rank?.trim() || "";
  } catch {
    return "";
  }
}

/**
 * Fetch a player's page and enrich every round with the opponent's current rank and the
 * projected rating change for a win, draw and loss.
 *
 * @param {string} url Chess-Results player URL
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ playerInfo: Record<string, string>, rating: number, rtgchg: number, rounds: Object[] }>}
 */
export async function getChessResults(url, signal) {
  if (!new URL(url).hostname.endsWith("chess-results.com")) {
    throw new Error("Please enter a valid Chess-Results URL.");
  }

  const page = parseHtml(await fetchPage(url, signal));
  const playerInfo = parsePlayerInfo(page);
  const pairings = parsePairings(page, url);

  if (isEmpty(pairings)) throw new Error("No pairings found for this player.");

  const rating =
    parseInt(
      playerInfo["Rating"] ?? playerInfo["Rating international"] ?? playerInfo["Rating national"],
      10,
    ) || 0;
  const rtgchg = parseFloat((playerInfo["FIDE rtg +/-"] ?? "0").replace(/,/g, "."));

  // Look up all opponents' ranks in parallel, once per distinct profile (team events can
  // list the same player several times).
  const profileUrls = [...new Set(pairings.map((p) => p.opponentProfileUrl).filter(Boolean))];
  const rankByUrl = new Map();
  await Promise.allSettled(
    profileUrls.map(async (profileUrl) => {
      rankByUrl.set(profileUrl, await fetchOpponentRank(profileUrl, signal));
    }),
  );

  const rounds = pairings.map((pairing) => ({
    ...pairing,
    opponentPoints: normalisePoints(pairing.opponentPoints),
    opponentRank: pairing.opponentProfileUrl
      ? (rankByUrl.get(pairing.opponentProfileUrl) ?? "")
      : "",
    win: formatRatingDelta(rating, pairing.opponentRating, 1),
    draw: formatRatingDelta(rating, pairing.opponentRating, 0.5),
    loss: formatRatingDelta(rating, pairing.opponentRating, 0),
  }));

  return { playerInfo, rating, rtgchg, rounds };
}

/**
 * Flatten the parsed profile plus computed rating fields into the object the header
 * renders (and the session cache stores).
 */
export function buildPlayerData(playerInfo, rating, rtgchg, url) {
  return {
    url,
    name: playerInfo["Name"] ?? "",
    title: playerInfo["Title"] ?? "",
    rank: playerInfo["Rank"] ?? "",
    federation: playerInfo["Federation"] ?? "",
    points: playerInfo["Points"] ?? "",
    rating: toNumberOr(rating, 0),
    rtgchg: toNumberOr(rtgchg, 0),
  };
}
