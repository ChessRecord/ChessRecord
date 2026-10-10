/**
 * The grouped, searchable list of games on the home page.
 *
 * Rendering is batched so a library of tens of thousands of games stays responsive: the
 * first batch is painted synchronously and the rest follow in later timer ticks.
 */

import { createHighlighter } from "../../lib/text.js";
import { renderGameEntry } from "./game-entry-view.js";

/** Games per batch. A batch always ends on a tournament boundary, so it may run over. */
const RENDER_BATCH_SIZE = 100;

const pluralize = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;

/**
 * @param {Object} options
 * @param {HTMLElement} options.list              Container for the tournament sections
 * @param {HTMLElement} options.gameCountEl       Receives "12 Games" / "No Games"
 * @param {HTMLElement} options.tournamentCountEl Receives "3 Events" (or nothing)
 * @param {() => import("../../domain/game.js").Game[]} options.getGames Current games, sorted
 */
export function createGameListView({ list, gameCountEl, tournamentCountEl, getGames }) {
  /** Timer of the next pending batch, so a newer render can cancel a stale one. */
  let pendingTimer = null;

  /** The game total is NOT filtered by the search; the event count is. */
  function updateCounts(totalGames, eventCount) {
    gameCountEl.innerHTML = totalGames ? pluralize(totalGames, "Game", "Games") : "No Games";
    tournamentCountEl.innerHTML = eventCount ? pluralize(eventCount, "Event", "Events") : "";
  }

  /**
   * Replace the list contents with the games matching `searchTerm` (player names or
   * tournament; case-insensitive), grouped by tournament.
   *
   * @param {string} searchTerm
   */
  function render(searchTerm) {
    // Cancel an unfinished background render so it cannot append to the cleared list.
    if (pendingTimer != null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }

    const games = getGames();
    const query = searchTerm.trim().toLowerCase();
    const matches = query
      ? games.filter(
          (game) =>
            (game.white || "").toLowerCase().includes(query) ||
            (game.black || "").toLowerCase().includes(query) ||
            (game.tournament || "").toLowerCase().includes(query),
        )
      : games;

    const gamesByTournament = new Map();
    for (const game of matches) {
      const key = game.tournament || "Unknown";
      let group = gamesByTournament.get(key);
      if (!group) gamesByTournament.set(key, (group = []));
      group.push(game);
    }

    updateCounts(games.length, gamesByTournament.size);

    const sections = [...gamesByTournament];
    const highlight = query ? createHighlighter(query) : null;
    let nextIndex = 0;

    const renderBatch = () => {
      const html = [];
      let rendered = 0;

      while (nextIndex < sections.length && rendered < RENDER_BATCH_SIZE) {
        const [tournament, tournamentGames] = sections[nextIndex++];
        const label = highlight ? highlight(tournament) : tournament;
        html.push(
          `<div class="tournament-section"><div class="tournament-header"><h3>${label}</h3><h3 class="dot">●</h3></div>`,
        );
        for (const game of tournamentGames) html.push(renderGameEntry(game));
        html.push(`</div>`);
        rendered += tournamentGames.length;
      }

      list.insertAdjacentHTML("beforeend", html.join(""));

      pendingTimer = nextIndex < sections.length ? setTimeout(renderBatch, 0) : null;
    };

    // Clear once, then paint the first batch right away; the rest follow on timers.
    list.innerHTML = "";
    renderBatch();
  }

  return { render };
}
