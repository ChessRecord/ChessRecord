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
 * Has the fresh data changed at all since the cached copy was drawn?
 *
 * The two are compared as whole values, so everything the page shows counts (any round's
 * result, an opponent's rank or rating, the points, the player, the URL …) and a field added
 * later cannot be forgotten here. The cache went through JSON in sessionStorage, so the
 * comparison goes through JSON as well. A false "changed" only costs a redraw; a false
 * "unchanged" would leave stale data on screen.
 */
export function hasPairingsChanged(cachedRounds, cachedPlayerData, rounds, playerData) {
  return (
    !cachedRounds ||
    !cachedPlayerData ||
    JSON.stringify([cachedRounds, cachedPlayerData]) !== JSON.stringify([rounds, playerData])
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

  /** The newest search. Starting another one aborts it, and only it may touch the loader. */
  let currentRequest = null;

  /**
   * Search for the URL in the input (or the saved one when it is empty) and update the
   * table if the data changed. The loader stays up until the NEWEST search has finished;
   * a search that was superseded neither draws anything nor hides the loader.
   */
  async function showPairingsFromInput() {
    let url = input.value.trim();
    if (!url) {
      url = savedUrl.get() ?? "";
      if (url) input.value = url;
    }
    if (!url) return;

    currentRequest?.abort();
    const request = new AbortController();
    currentRequest = request;
    showLoader(searchButton);

    try {
      const { playerInfo, rating, rtgchg, rounds } = await getChessResults(url, request.signal);
      if (request.signal.aborted) return; // superseded while the answer was on its way
      const playerData = buildPlayerData(playerInfo, rating, rtgchg, url);

      if (hasPairingsChanged(savedRounds.get(), savedPlayerData.get(), rounds, playerData)) {
        view.render(rounds, playerData, url);
        savedRounds.set(rounds);
        savedPlayerData.set(playerData);
      }
      savedUrl.set(url);
    } catch (error) {
      // A superseded search fails with an abort, or with whatever it hit before the abort
      // reached it; either way the user has moved on and must not see its error.
      if (request.signal.aborted || error.name === "AbortError") return;
      alert(error.message || "No Pairings found for this URL.");
      console.error(error);
    } finally {
      if (currentRequest === request) {
        currentRequest = null;
        hideLoader(searchButton);
      }
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
