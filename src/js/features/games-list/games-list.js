/**
 * Home page feature: the searchable list of games, deleting a game, and the
 * import/export entries of the options menu.
 */

import { requireElement } from "../../lib/dom.js";
import { formatPlayerLabel } from "../../domain/player.js";
import { createGameListView } from "./game-list-view.js";
import { exportGames, handleImportEvent } from "./game-transfer.js";
import { initSearchShortcut } from "./search-shortcut.js";

/**
 * @param {Object} deps
 * @param {ReturnType<typeof import("../../storage/game-store.js").createGameStore>} deps.store
 *        A store whose games are already loaded
 * @param {{ close: () => void }} deps.menu The options dropdown
 */
export function initGamesList({ store, menu }) {
  const list = requireElement("#games-list");
  const search = /** @type {HTMLInputElement} */ (requireElement("#search-input"));
  const importButton = requireElement("#import-btn");
  const exportButton = requireElement("#export-btn");
  const fileInput = requireElement("#file-input");

  const view = createGameListView({
    list,
    gameCountEl: requireElement("#game-count"),
    tournamentCountEl: requireElement("#tournament-count"),
    getGames: () => store.games,
  });
  const refresh = () => view.render(search.value);

  async function deleteGame(id) {
    const game = store.findById(id);
    if (!game) return;

    const { whiteTitle, white, blackTitle, black } = game;
    const label = `${formatPlayerLabel(whiteTitle, white)} vs ${formatPlayerLabel(blackTitle, black)}`;
    if (!confirm(`Delete:\n ${label} ?`)) return;

    const saving = store.remove(id);
    refresh();
    await saving;
  }

  search.addEventListener("input", (event) => view.render(event.target.value));

  importButton.addEventListener("click", (event) => {
    // The file input sits inside this button, so its own click bubbles back here;
    // ignore it or the picker would open twice.
    if (event.target === fileInput) return;
    menu.close();
    fileInput.click();
  });
  fileInput.addEventListener("change", (event) => handleImportEvent(event, { store, refresh }));
  exportButton.addEventListener("click", () => {
    menu.close();
    exportGames(store.games);
  });

  initSearchShortcut({ search, menu });

  // One delegated listener covers every delete button, however often the list is re-rendered.
  list.addEventListener("click", (event) => {
    const button = event.target.closest(".delete-game-btn");
    if (!button) return;
    event.stopPropagation();
    event.preventDefault();
    deleteGame(button.closest("[data-game-id]")?.dataset.gameId);
  });

  refresh();
}
