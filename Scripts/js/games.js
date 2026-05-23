// games.js - Index page controller

/* --- Data Import / Export --- */
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

    if (exportData.length === 0) {
      alert("No valid games found to export");
      return;
    }
    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `chessrecord-${today}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
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

  const finalize = (resolve) => {
    importedData.forEach((game) => (game.id = generateUniqueID()));
    if (resolve === "replace") {
      window.games = importedData;
    } else {
      window.games.push(...importedData);
    }
    saveGames();
    displayGames();
    alert(
      `Games ${resolve === "replace" ? "replaced" : "appended"} successfully!`,
    );
  };

  if (isEmpty(window.games)) {
    finalize("replace");
  } else {
    const choice = await Modal.confirm({
      icon: "fa-solid fa-triangle-exclamation warning-big",
      title: "Do you want to replace or append your games?",
      buttons: [
        { action: "replace", label: "Replace", classes: "btn outline" },
        { action: "append", label: "Append", classes: "btn" },
      ],
    });
    if (choice) finalize(choice);
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

/* --- Rendering Logic --- */
function countGames() {
  const gameCountElement = document.getElementById("game-count");
  const tournamentCountElement = document.getElementById("tournament-count");
  if (!gameCountElement || !tournamentCountElement) return;

  const gameCount = window.games.length;
  const tournamentSet = new Set();
  for (const { tournament } of window.games) tournamentSet.add(tournament);
  const tournamentCount = tournamentSet.size;

  gameCountElement.innerHTML =
    gameCount === 0
      ? "No Games"
      : `${gameCount} ${gameCount === 1 ? "Game" : "Games"}`;
  tournamentCountElement.innerHTML =
    tournamentCount === 0
      ? ""
      : `${tournamentCount} ${tournamentCount === 1 ? "Event" : "Events"}`;
}

function gameEntry(game) {
  const a = document.createElement("a");
  a.href = game.gameLink || "#";
  if (game.gameLink) a.target = "_blank";
  a.className = "game-entry-link";

  const gameId = game.id || "unknown";
  const category = getTimeControlCategory(game.time);
  const timeIcon = TIME_CONTROL_ICONS[category] || TIME_CONTROL_ICONS.Unknown;
  const timeDisplay = game.time
    ? category === "Unknown"
      ? game.time
      : `${game.time}<span class="timecontrol-category"> • ${category}</span>`
    : "";
  const dateString = game.date ? ` | <strong>${game.date}</strong>` : "";
  const roundLabel =
    game.board != null ? `Board ${game.board}` : `Round ${game.round}`;

  a.innerHTML = `
    <div class="game-entry" data-game-id="${gameId}">
      <div class="game-details" style="align-items: center;">
        <div class="game-tournament"><span class="game-round">${game.round}</span><strong>${roundLabel}</strong></div>
        <span class="entry-meta">
          <span class="game-time">
            ${timeIcon}
            ${timeDisplay}
          </span>${dateString}
        </span>
      </div>
      <div class="player-details">
        <div class="player-left">
          <span>
            <span class="title">${game.whiteTitle || ""}</span> ${game.white || "Unknown"} <span class="player-rating">${game.whiteRating || 0}</span>
          </span>
        </div>
        <div class="game-result">
          <strong>${formatResult(game.result)}</strong>
        </div>
        <div class="player-right">
          <span>
            <span class="title">${game.blackTitle || ""}</span> ${game.black || "Unknown"} <span class="player-rating">${game.blackRating || 0}</span>
          </span>
        </div>
      </div>
      <button class="delete-game-btn" onclick="event.stopPropagation(); event.preventDefault(); deleteGame('${gameId}')">
        <i class="fa-solid fa-delete-left"></i>
      </button>
    </div>
  `;
  return a;
}

function deleteGame(id) {
  const gameIndex = window.games.findIndex((game) => game.id === id);
  if (gameIndex === -1) return;
  const gameToDelete = window.games[gameIndex];
  const deleteConfirmation = `Are you sure you want to delete:\n ${toUnicodeVariant(
    gameToDelete.whiteTitle,
    "bold sans",
    "sans",
  )} ${gameToDelete.white} vs ${toUnicodeVariant(
    gameToDelete.blackTitle,
    "bold sans",
    "sans",
  )} ${gameToDelete.black} ?`;
  if (confirm(deleteConfirmation)) {
    window.games.splice(gameIndex, 1);
    saveGames();
    displayGames();
  }
}

function displayGames(searchTerm = window.searchTerm || "") {
  const gamesList = document.getElementById("gamesList");
  if (!gamesList) return;

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
    if (!acc.has(game.tournament)) acc.set(game.tournament, []);
    acc.get(game.tournament).push(game);
    return acc;
  }, new Map());

  const fragment = document.createDocumentFragment();
  gamesByTournament.forEach((tournamentGames, tournament) => {
    const section = document.createElement("div");
    section.className = "tournament-section";
    section.innerHTML = `
      <div class="tournament-header">
        <h3>${tournament}</h3>
        <h3 class="dot">●</h3>
      </div>
    `;
    tournamentGames.forEach((game) => {
      section.appendChild(gameEntry(game));
    });
    fragment.appendChild(section);
  });

  gamesList.innerHTML = "";
  gamesList.appendChild(fragment);
  refreshTitle();
}

/* --- Initialization --- */
loadGames();
window.searchTerm = "";

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      window.searchTerm = e.target.value;
      displayGames(e.target.value);
    });
  }
  displayGames();
});
