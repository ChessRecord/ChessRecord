// games.js — Index page controller

/* ─── UI Selectors (Configurable) ────────────────────────────────────────── */

const UI = {
  list: "gamesList",
  counts: {
    games: "game-count",
    tournaments: "tournament-count",
  },
  search: "searchInput",
};

/* ─── DOM Cache ──────────────────────────────────────────────────────────── */

// All element lookups happen exactly once at DOMContentLoaded and are stored
// here. Every helper reads from these references rather than querying the DOM
// on every render cycle.
let els = {}; // { list, gameCount, tournamentCount }

/* ─── Data Import / Export ───────────────────────────────────────────────── */

async function exportJSON() {
  if (isEmpty(window.games)) {
    alert("No games were found in this database");
    return;
  }
  try {
    const exportData = window.games.flatMap((game) => {
      if (!game || !isValidObject(game)) return [];
      const { id, result, ...rest } = game;
      return [{ ...rest, result: normalizeResult(result) }];
    });

    if (exportData.length === 0) {
      alert("No valid games found to export");
      return;
    }

    download(
      toSoup(exportData),
      `chessrecord-${today}.chr`,
      "application/octet-stream",
    );
  } catch (error) {
    console.error("Export failed:", error);
    alert("Failed to export games. Please try again.");
  }
}

async function parseImport(files) {
  const results = await Promise.all(
    Array.from(files).map((file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ file, text: e.target.result });
        reader.onerror = reject;
        reader.readAsText(file);
      }).then(({ file, text }) => {
        const name = file.name.toLowerCase();
        if (name.endsWith(".pgn")) return pgnToJson(text);

        // Handle ChesSoup compressed format
        if (name.endsWith(".chr") && text.trim().startsWith("§")) {
          return normalizeGames(fromSoup(text));
        }

        // Fallback to JSON
        if (name.endsWith(".json")) {
          const rawData = JSON.parse(text);
          if (!Array.isArray(rawData)) throw new Error("Invalid JSON format");
          return normalizeGames(rawData);
        }
        throw new Error("Unsupported file format");
      }),
    ),
  );
  return results.flat();
}

async function resolveImport(importedData) {
  if (isEmpty(importedData)) {
    alert("No games were found in this database");
    return;
  }
  if (importedData.some((game) => !game.gameLink)) {
    alert(
      "Import failed: Some games are missing a game link (URL). Please ensure every game includes a valid link before importing.",
    );
    return;
  }

  const finalize = async (action) => {
    const label = isEmpty(window.games)
      ? "imported"
      : action === "replace"
        ? "replaced"
        : "merged";

    for (const game of importedData) game.id = generateUniqueID();

    // Normalise and sort synchronously so both saveGames and displayGames
    // start from a stable, clean window.games — no mid-flight mutations.
    if (action === "replace") {
      window.games = normalizeGames(importedData);
      sortGames(window.games);
    } else if (action === "merge") {
      window.games.push(...importedData);
      sortGames(window.games);
    } else {
      return;
    }

    // Run persist and render concurrently instead of sequentially.
    // displayGames() contains no awaits — it runs to completion before
    // saveGames() resumes from its first await (dbReady), so both operations
    // always see the same stable window.games.
    // Total blocking time: max(saveTime, renderTime) instead of save + render.
    await Promise.all([
      saveGames(action === "merge" ? importedData : undefined),
      displayGames(),
    ]);

    // Yield one full paint cycle before alerting. Without this, alert() fires
    // before the browser has painted the updated DOM — the user sees the old
    // page behind the dialog and perceives the games as "not yet loaded" when
    // they dismiss it.
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    alert(`Games ${label} successfully!`);
  };

  if (isEmpty(window.games)) {
    await finalize("replace");
  } else {
    const choice = await Modal.confirm({
      icon: "fa-solid fa-triangle-exclamation warning-big",
      title: "Do you want to replace or merge your games?",
      buttons: [
        { action: "replace", label: "Replace", classes: "btn outline" },
        { action: "merge", label: "Merge", classes: "btn" },
      ],
    });
    if (choice) await finalize(choice);
  }
}

async function importJSON(event) {
  const input = event.target;
  if (!input.files || input.files.length === 0) return;

  try {
    const games = await parseImport(input.files);
    await resolveImport(games);
  } catch (error) {
    alert(error.message || "Error parsing files!");
  } finally {
    input.value = "";
  }
}

/* ─── Rendering Logic ────────────────────────────────────────────────────── */

function countGames() {
  if (!els.gameCount || !els.tournamentCount) return;

  const gameCount = window.games.length;
  const tournamentSet = new Set();
  for (const { tournament } of window.games)
    tournamentSet.add(tournament || "Unknown");
  const tournamentCount = tournamentSet.size;

  els.gameCount.innerHTML =
    gameCount === 0
      ? "No Games"
      : `${gameCount} ${gameCount === 1 ? "Game" : "Games"}`;
  els.tournamentCount.innerHTML =
    tournamentCount === 0
      ? ""
      : `${tournamentCount} ${tournamentCount === 1 ? "Event" : "Events"}`;
}

// Returns an HTML string rather than a DOM element so that displayGames()
// can set section.innerHTML once per tournament group, collapsing N separate
// HTML-parse-and-build cycles into one.
function gameEntry(game, searchTerm = "") {
  const hl = (s) => (searchTerm ? highlightMatch(searchTerm, s) : s);

  const gameId   = game.id || "unknown";
  const category = getTimeControlCategory(game.time);
  const timeIcon = TIME_CONTROL_ICONS[category] || TIME_CONTROL_ICONS.Unknown;
  const timeDisplay = game.time
    ? category === "Unknown"
      ? game.time
      : `${game.time}<span class="timecontrol-category"> • ${category}</span>`
    : "";

  const roundLabel   = game.board != null ? `Board ${game.board}` : `Round ${game.round}`;
  const gameMetaLeft = `<span class="game-round">${game.round}</span><strong class="round-label">${roundLabel}</strong>`;
  const gameMetaRight = `${timeDisplay ? `<span class="game-time">${timeIcon} ${timeDisplay}</span>` : ""}${timeDisplay && game.date ? " | " : ""}${game.date ? `<strong class="game-date">${game.date}</strong>` : ""}`;

  const whiteTitle = game.whiteTitle ? `<span class="player-title">${game.whiteTitle}</span>` : "";
  const blackTitle = game.blackTitle ? `<span class="player-title">${game.blackTitle}</span>` : "";

  return `<a href="${game.gameLink || "#"}"${game.gameLink ? ' target="_blank"' : ""} class="game-entry-link">
      <div class="game-entry" data-game-id="${gameId}">
        <div class="game-meta">
          <div class="game-meta-left">${gameMetaLeft}</div>
          <div class="game-meta-right">${gameMetaRight}</div>
        </div>
        <div class="game-players">
          <div class="player-white">
            ${whiteTitle}
            <span class="player-name">${hl(game.white || "Unknown")}</span>
            <span class="player-rating">${game.whiteRating || 0}</span>
          </div>
          <div class="game-result"><strong>${formatResult(game.result)}</strong></div>
          <div class="player-black">
            ${blackTitle}
            <span class="player-name">${hl(game.black || "Unknown")}</span>
            <span class="player-rating">${game.blackRating || 0}</span>
          </div>
        </div>
        <button class="delete-game-btn">
          <i class="fa-solid fa-delete-left"></i>
        </button>
      </div>
    </a>`;
}

async function deleteGame(id) {
  const gameIndex = window.games.findIndex((game) => game.id === id);
  if (gameIndex === -1) return;
  const { whiteTitle, white, blackTitle, black } = window.games[gameIndex];
  if (
    confirm(
      `Are you sure you want to delete:\n ${formatPlayerLabel(whiteTitle, white)} vs ${formatPlayerLabel(blackTitle, black)} ?`,
    )
  ) {
    window.games.splice(gameIndex, 1);
    // saveGames(null, id) removes only this record from IDB and syncs the
    // localStorage mirror — no full clear/reinsert of the entire dataset.
    await saveGames(null, id);
    await displayGames();
  }
}

async function displayGames(searchTerm = window.searchTerm || "") {
  if (!els.list) return;

  countGames();

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredGames = normalizedSearchTerm
    ? window.games.filter(
        (game) =>
          (game.white      || "").toLowerCase().includes(normalizedSearchTerm) ||
          (game.black      || "").toLowerCase().includes(normalizedSearchTerm) ||
          (game.tournament || "").toLowerCase().includes(normalizedSearchTerm),
      )
    : window.games;

  const gamesByTournament = filteredGames.reduce((acc, game) => {
    const key = game.tournament || "Unknown";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(game);
    return acc;
  }, new Map());

  const fragment = document.createDocumentFragment();
  for (const [tournament, tournamentGames] of gamesByTournament) {
    const section = document.createElement("div");
    section.className = "tournament-section";

    // Build the entire section — header + all game entries — as one HTML string
    // and parse it in a single innerHTML call. This collapses what was N separate
    // parse-and-build cycles (one per gameEntry DOM element) into one, which is
    // substantially faster for large tournament groups.
    const tournamentLabel = normalizedSearchTerm
      ? highlightMatch(normalizedSearchTerm, tournament)
      : tournament;
    section.innerHTML =
      `<div class="tournament-header"><h3>${tournamentLabel}</h3><h3 class="dot">●</h3></div>` +
      tournamentGames.map((game) => gameEntry(game, normalizedSearchTerm)).join("");

    fragment.appendChild(section);
  }

  els.list.replaceChildren(fragment);
  refreshTitle();
}

/* ─── Initialization ─────────────────────────────────────────────────────── */

// loadGames() is async (Dexie/IndexedDB). We kick it off early so the DB
// is ready by the time DOMContentLoaded fires.
loadGames();

window.searchTerm = "";

document.addEventListener("DOMContentLoaded", async () => {
  // Resolve every element once and store in the module-level cache.
  // From this point forward, no function needs to call getElementById.
  els = {
    list: document.getElementById(UI.list),
    gameCount: document.getElementById(UI.counts.games),
    tournamentCount: document.getElementById(UI.counts.tournaments),
    search: document.getElementById(UI.search),
  };

  // Wait for the DB load that was started above before rendering anything —
  // this guarantees window.games is fully populated before the first paint.
  await loadGames();

  els.search?.addEventListener("input", (e) => {
    window.searchTerm = e.target.value;
    displayGames(e.target.value);
  });

  // Single delegated listener covers all delete buttons regardless of how many
  // times the list is re-rendered — no per-entry listeners to attach or leak.
  els.list?.addEventListener("click", (e) => {
    const btn = e.target.closest(".delete-game-btn");
    if (!btn) return;
    e.stopPropagation();
    e.preventDefault();
    deleteGame(btn.closest("[data-game-id]")?.dataset.gameId);
  });

  await displayGames();
});
