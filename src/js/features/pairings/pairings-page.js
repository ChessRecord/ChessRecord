/**
 * Pairings page feature: looks up a Chess-Results player URL, shows the pairings table,
 * and remembers the last URL and result so the page can show them again instantly.
 *
 * Storage:
 *   localStorage   "chessResultsUrl"   last URL searched (pre-fills the input next visit)
 *   sessionStorage "pairingsRounds"    last rounds shown   ┐ restored immediately on reload,
 *   sessionStorage "pairingsPlayerData" last player header ┘ then refreshed from the network
 */

import { requireElement } from "../../lib/dom.js";
import { localEntry, sessionEntry } from "../../storage/web-storage.js";
import { hideLoader, showLoader } from "../../ui/loader.js";
import { buildPlayerData, getChessResults } from "./chess-results-client.js";
import { createPairingsView } from "./pairings-view.js";

const savedUrl = localEntry("chessResultsUrl");
const savedRounds = sessionEntry("pairingsRounds");
const savedPlayerData = sessionEntry("pairingsPlayerData");

/**
 * Has the fresh data changed enough to redraw? Only the number of rounds, the player's
 * rating, rating change, points and the LAST round's result are compared.
 */
export function hasPairingsChanged(cachedRounds, cachedPlayerData, rounds, playerData) {
  return (
    !cachedRounds ||
    !cachedPlayerData ||
    cachedRounds.length !== rounds.length ||
    cachedPlayerData.rating !== playerData.rating ||
    cachedPlayerData.rtgchg !== playerData.rtgchg ||
    cachedPlayerData.points !== playerData.points ||
    cachedRounds[cachedRounds.length - 1]?.result !== rounds[rounds.length - 1]?.result
  );
}

export function initPairingsPage() {
  const form = requireElement("#pairings-form");
  const input = /** @type {HTMLInputElement} */ (requireElement("#url-input"));
  const searchButton = requireElement("#search-url-btn");
  const view = createPairingsView({
    profile: requireElement("#player-profile"),
    table: requireElement("#pairings-table"),
    note: requireElement("#note"),
  });

  /** Aborts the request of the previous search when a new one starts. */
  let currentRequest = null;

  /**
   * Search for the URL in the input (or the saved one when it is empty) and update the
   * table if the data changed. The loader is always dismissed afterwards.
   */
  async function showPairingsFromInput() {
    let url = input.value.trim();
    if (!url) {
      url = savedUrl.get() ?? "";
      if (url) input.value = url;
    }
    if (!url) return;

    showLoader(searchButton);
    currentRequest?.abort();
    currentRequest = new AbortController();
    const { signal } = currentRequest;

    try {
      const { playerInfo, rating, rtgchg, rounds } = await getChessResults(url, signal);
      const playerData = buildPlayerData(playerInfo, rating, rtgchg, url);

      if (hasPairingsChanged(savedRounds.get(), savedPlayerData.get(), rounds, playerData)) {
        view.render(rounds, playerData, url);
        savedRounds.set(rounds);
        savedPlayerData.set(playerData);
      }
      savedUrl.set(url);
    } catch (error) {
      if (error.name === "AbortError") return;
      alert(error.message || "No Pairings found for this URL.");
      console.error(error);
    } finally {
      hideLoader(searchButton);
    }
  }

  // Show the previous result immediately, then check the network for updates.
  const storedUrl = savedUrl.get();
  const cachedRounds = savedRounds.get();
  const cachedPlayerData = savedPlayerData.get();

  if (storedUrl) input.value = storedUrl;
  if (cachedRounds && cachedPlayerData && cachedPlayerData.url === storedUrl) {
    view.render(cachedRounds, cachedPlayerData, storedUrl);
  }
  if (storedUrl) showPairingsFromInput();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showPairingsFromInput();
  });
}
