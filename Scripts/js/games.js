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

function exportJSON() {
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

    if (isEmpty(exportData)) {
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

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function parseImport(files) {
  const allGames = [];
  // Sequential processing prevents peak memory spikes by not holding N large
  // intermediate arrays in memory before flattening. For typical browser
  // environments, this is significantly safer than Promise.all([...]).flat().
  for (const file of files) {
    const text = await readFileAsText(file);
    const name = file.name.toLowerCase();

    let games = [];
    if (name.endsWith(".pgn")) {
      games = pgnToJson(text);
    } else if (name.endsWith(".chr") && text.trim().startsWith("§")) {
      games = normalizeGames(fromSoup(text));
    } else if (name.endsWith(".json")) {
      const rawData = JSON.parse(text);
      if (!Array.isArray(rawData)) throw new Error("Invalid JSON format");
      games = normalizeGames(rawData);
    } else {
      throw new Error(`Unsupported file format: ${file.name}`);
    }

    if (!isEmpty(games)) allGames.push(...games);
  }
  return allGames;
}

async function resolveImport(importedData) {
  if (isEmpty(importedData))
    return alert("No games were found in this database");
  if (importedData.some((g) => !g.gameLink))
    return alert("Import failed: Some games are missing a game link (URL).");

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

    // saveGames starts first (gets a head start on await dbReady) while
    // displayGames runs synchronously to completion — identical outcome to
    // sequential execution but saveGames begins its async work immediately.
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
  if (isEmpty(input.files)) return;

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

  els.gameCount.innerHTML = isEmpty(window.games)
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

  const gameId = game.id || "unknown";
  const category = getTimeControlCategory(game.time);
  const timeIcon = TIME_CONTROL_ICONS[category] || TIME_CONTROL_ICONS.Unknown;
  const timeDisplay = game.time
    ? category === "Unknown"
      ? game.time
      : `${game.time}<span class="timecontrol-category"> • ${category}</span>`
    : "";

  const roundLabel =
    game.board != null ? `Board ${game.board}` : `Round ${game.round}`;
  const gameMetaLeft = `<span class="game-round">${game.round}</span><strong class="round-label">${roundLabel}</strong>`;
  const metaParts = [];
  if (timeDisplay)
    metaParts.push(`<span class="game-time">${timeIcon} ${timeDisplay}</span>`);
  if (game.date)
    metaParts.push(`<strong class="game-date">${game.date}</strong>`);
  const gameMetaRight = metaParts.join(" | ");

  const whiteTitle = game.whiteTitle
    ? `<span class="player-title">${game.whiteTitle}</span>`
    : "";
  const blackTitle = game.blackTitle
    ? `<span class="player-title">${game.blackTitle}</span>`
    : "";

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
    !confirm(
      `Are you sure you want to delete:\n ${formatPlayerLabel(whiteTitle, white)} vs ${formatPlayerLabel(blackTitle, black)} ?`,
    )
  )
    return;
  window.games.splice(gameIndex, 1);
  // saveGames(null, id) removes only this record from IDB and syncs the
  // localStorage mirror — no full clear/reinsert of the entire dataset.
  await saveGames(null, id);
  displayGames();
}

function displayGames(searchTerm = window.searchTerm || "") {
  if (!els.list) return;

  countGames();

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredGames = normalizedSearchTerm
    ? window.games.filter(
        (game) =>
          (game.white || "").toLowerCase().includes(normalizedSearchTerm) ||
          (game.black || "").toLowerCase().includes(normalizedSearchTerm) ||
          (game.tournament || "").toLowerCase().includes(normalizedSearchTerm),
      )
    : window.games;

  const gamesByTournament = filteredGames.reduce((acc, game) => {
    const key = game.tournament || "Unknown";
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(game);
    return acc;
  }, new Map());

  // Building one large HTML string is significantly faster than creating N
  // elements and setting innerHTML individually inside a loop. The browser
  // parses the entire list in one pass.
  els.list.innerHTML = Array.from(gamesByTournament)
    .map(([tournament, tournamentGames]) => {
      const tournamentLabel = normalizedSearchTerm
        ? highlightMatch(normalizedSearchTerm, tournament)
        : tournament;
      return `
      <div class="tournament-section">
        <div class="tournament-header">
          <h3>${tournamentLabel}</h3><h3 class="dot">●</h3>
        </div>
        ${tournamentGames.map((game) => gameEntry(game, normalizedSearchTerm)).join("")}
      </div>`;
    })
    .join("");

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

  displayGames();
});
