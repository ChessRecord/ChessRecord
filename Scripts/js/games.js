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
    alert("Your game list is empty — there's nothing to export yet.");
    return;
  }
  try {
    const exportData = [];
    for (const game of window.games) {
      if (!game || !isValidObject(game)) continue;
      const { id, result, ...rest } = game;
      exportData.push({ ...rest, result: normalizeResult(result) });
    }

    if (isEmpty(exportData)) {
      alert("No valid games could be prepared for export.");
      return;
    }

    download(
      toSoup(exportData),
      `chessrecord-${today}.chr`,
      "application/octet-stream",
    );
  } catch (error) {
    console.error("Export failed:", error);
    alert("Export failed. Please try again.");
  }
}

// FileReader.readAsText() is event-driven: the browser fires onload/onerror
// asynchronously after reading on a background thread. FileReaderSync only
// exists in Web Workers, so a Promise wrapper is the only option on the main
// thread — this function cannot be made synchronous.
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function parseImport(files) {
  // Promise.all fires all file reads concurrently. For typical imports (1–10
  // files) the speed gain outweighs the modest peak-memory increase from
  // holding intermediate arrays in parallel; use sequential processing if
  // imports routinely exceed tens of large files.
  return (
    await Promise.all(
      Array.from(files).map(async (file) => {
        const content = await readFileAsText(file);
        const name = file.name.toLowerCase();
        if (name.endsWith(".pgn")) return pgnToJson(content);
        if (name.endsWith(".chr") && content.trim().startsWith("§"))
          return normalizeGames(fromSoup(content));
        if (name.endsWith(".json")) {
          const rawData = JSON.parse(content);
          if (!Array.isArray(rawData))
            throw new Error(
              `"${file.name}" doesn't contain a valid list of games.`,
            );
          return normalizeGames(rawData);
        }
        throw new Error(
          `"${file.name}" is not a supported format. Please use .pgn, .json, or .chr files.`,
        );
      }),
    )
  ).flat();
}

async function resolveImport(importedData) {
  if (isEmpty(importedData))
    return alert("The selected files didn't contain any recognisable games.");
  if (importedData.some((g) => !g.gameLink))
    return alert(
      "Some games are missing a required game link. Please check your files and try again.",
    );

  const finalize = async (action) => {
    const label = isEmpty(window.games)
      ? "imported"
      : action === "replace"
        ? "replaced"
        : "merged";

    for (const game of importedData) game.id = generateUniqueID();

    if (action === "replace") {
      window.games = normalizeGames(importedData);
    } else if (action === "merge") {
      window.games.push(...normalizeGames(importedData));
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
        {
          action: "replace",
          label: "Replace",
          classes: "btn outline",
          loading: true,
        },
        { action: "merge", label: "Merge", classes: "btn", loading: true },
      ],
    });
    if (choice) {
      try {
        await finalize(choice);
      } finally {
        Modal.hide();
      }
    }
  }
}

async function importJSON(event) {
  const input = event.target;
  if (isEmpty(input.files)) return;

  try {
    const games = await parseImport(input.files);
    await resolveImport(games);
  } catch (error) {
    alert(
      error.message ||
        "Something went wrong while reading your files. Please check that they're valid and try again.",
    );
  } finally {
    input.value = "";
  }
}

/* ─── Rendering Logic ────────────────────────────────────────────────────── */

function countGames() {
  if (!els.gameCount || !els.tournamentCount) return;
  const n = window.games.length;
  const tournaments = new Set();
  for (const { tournament } of window.games) tournaments.add(tournament || "Unknown");
  const t = tournaments.size;
  els.gameCount.innerHTML = n ? `${n} ${n === 1 ? "Game" : "Games"}` : "No Games";
  els.tournamentCount.innerHTML = t ? `${t} ${t === 1 ? "Event" : "Events"}` : "";
}

// Returns an HTML string rather than a DOM element so that displayGames()
// can set section.innerHTML once per tournament group, collapsing N separate
// HTML-parse-and-build cycles into one.
function gameEntry(game) {
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
  const gameMetaRight = timeDisplay
    ? game.date
      ? `<span class="game-time">${timeIcon} ${timeDisplay}</span> | <strong class="game-date">${game.date}</strong>`
      : `<span class="game-time">${timeIcon} ${timeDisplay}</span>`
    : game.date
      ? `<strong class="game-date">${game.date}</strong>`
      : "";

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
            <span class="player-name">${game.white || "Unknown"}</span>
            <span class="player-rating">${game.whiteRating || 0}</span>
          </div>
          <div class="game-result"><strong>${formatResult(game.result)}</strong></div>
          <div class="player-black">
            ${blackTitle}
            <span class="player-name">${game.black || "Unknown"}</span>
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
  const idx = window.games.findIndex((g) => g.id === id);
  if (idx === -1) return;
  const { whiteTitle, white, blackTitle, black } = window.games[idx];
  if (!confirm(`Delete ${formatPlayerLabel(whiteTitle, white)} vs ${formatPlayerLabel(blackTitle, black)}?\n\nThis cannot be undone.`)) return;
  window.games.splice(idx, 1);

  // saveGames starts first (gets a head start on await dbReady) while
  // displayGames runs synchronously to completion — identical outcome to
  // sequential execution but saveGames begins its async work immediately.
  await Promise.all([saveGames(null, id), displayGames()]);

  // Yield one full paint cycle before alerting. Without this, alert() fires
  // before the browser has painted the updated DOM — the user sees the old
  // page behind the dialog and perceives the games as "not yet loaded" when
  // they dismiss it.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}

function displayGames(searchTerm = els.search?.value || "") {
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

  // Single Map pass replaces reduce (no closure-per-iteration overhead).
  // get() result is cached in `group` — avoids a second Map lookup after set().
  const gamesByTournament = new Map();
  for (const game of filteredGames) {
    const key = game.tournament || "Unknown";
    let group = gamesByTournament.get(key);
    if (!group) gamesByTournament.set(key, group = []);
    group.push(game);
  }

  // Building one large HTML string is significantly faster than creating N
  // elements and setting innerHTML individually inside a loop. The browser
  // parses the entire list in one pass.
  // for...of over the Map avoids Array.from(), outer .map(), and outer .join()
  // — no intermediate arrays at any level.
  let html = "";
  for (const [tournament, tournamentGames] of gamesByTournament) {
    const tournamentLabel = normalizedSearchTerm
      ? highlightMatch(normalizedSearchTerm, tournament)
      : tournament;
    html += `<div class="tournament-section"><div class="tournament-header"><h3>${tournamentLabel}</h3><h3 class="dot">●</h3></div>`;
    for (const game of tournamentGames) html += gameEntry(game);
    html += `</div>`;
  }
  els.list.innerHTML = html;

  refreshTitle();
}

/* ─── Initialization ─────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  // Resolve every element once and store in the module-level cache.
  // From this point forward, no function needs to call getElementById.
  els = {
    list: document.getElementById(UI.list),
    gameCount: document.getElementById(UI.counts.games),
    tournamentCount: document.getElementById(UI.counts.tournaments),
    search: document.getElementById(UI.search),
  };

  // Fresh read from IDB — guarantees window.games is fully populated before
  // the first paint with no cached or stale intermediary.
  await loadGames();

  els.search?.addEventListener("input", (e) => {
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
