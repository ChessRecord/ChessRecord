// new.js — New Game page controller

/* ─── UI Selectors (Configurable) ────────────────────────────────────────── */

const UI = {
  form: {
    root: "gameForm",
    submit: "addGame",
    fields: {
      result: "result",
      time: "time",
      tournament: "tournament",
      round: "round",
      date: "date",
      gameLink: "gameLink",
    },
  },
  players: [
    {
      key: "white",
      player: "playerWhite",
      title: "whiteTitle",
      rating: "whiteRating",
      suggestions: "whiteSuggestions",
    },
    {
      key: "black",
      player: "playerBlack",
      title: "blackTitle",
      rating: "blackRating",
      suggestions: "blackSuggestions",
    },
  ],
};

/* ─── Constants ──────────────────────────────────────────────────────────── */

const FIDE_BASE = "https://lichess.org/api/fide/player";

/* ─── DOM Cache ──────────────────────────────────────────────────────────── */

// All element lookups happen exactly once at DOMContentLoaded and are stored
// here. Every listener and helper reads from these maps rather than touching
// the DOM on each keystroke or event.
const PLAYER_ELS = new Map(); // key → { player, title, rating, suggestions }
let formEls = {}; // { result, time, tournament, round, date, gameLink, submit, error }

/* ─── API ────────────────────────────────────────────────────────────────── */

async function fetchFidePlayer(id) {
  if (!id || isNaN(id)) throw new Error(`Invalid FIDE ID: ${id}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${FIDE_BASE}/${id}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    if (!data.name) throw new Error(`No player found for FIDE ID: ${id}`);
    return normalizePlayer(data);
  } finally {
    clearTimeout(timeout);
  }
}

// Accepts a signal so the caller can cancel in-flight requests when the query
// changes. Returns null on abort — callers must check for null before rendering.
async function fetchPlayerSuggestions(query, signal) {
  try {
    const res = await fetch(
      `${FIDE_BASE}?q=${encodeURIComponent(query.trim())}`,
      { signal },
    );
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return (await res.json()).map(normalizePlayer);
  } catch (err) {
    if (err.name === "AbortError") return null; // intentionally cancelled
    console.error("Error fetching player suggestions:", err);
    return [];
  }
}

/* ─── Rating Helpers ─────────────────────────────────────────────────────── */

function pickRating({ standard = 0, rapid = 0, blitz = 0 } = {}, time) {
  if (!time?.trim()) return standard;
  return (
    { Classical: standard, Rapid: rapid, Blitz: blitz, Bullet: blitz }[
      getTimeControlCategory(time)
    ] ?? standard
  );
}

/* ─── API ────────────────────────────────────────────────────────────────── */

function renderSuggestions(container, query, players) {
  if (isEmpty(players)) {
    container.replaceChildren();
    return;
  }
  // Building one large HTML string is significantly faster than creating N
  // elements and setting innerHTML individually inside a loop. The browser
  // parses the entire list in one pass.
  container.innerHTML = players
    .map((p) => {
      const titleTag = p.title
        ? `<span class="player-title">${p.title}</span> `
        : "";
      return `
      <div class="autocomplete-suggestion"
           data-name="${p.name}"
           data-title="${p.title || ""}"
           data-standard="${p.standard}"
           data-rapid="${p.rapid}"
           data-blitz="${p.blitz}">
        ${titleTag}${highlightMatch(query, p.name)}
      </div>`;
    })
    .join("");
}

function setupAutocomplete({ key }) {
  // All elements come from the pre-built cache — no getElementById call
  // inside this function or any of its inner helpers.
  const {
    player: input,
    title: titleInput,
    rating: ratingEl,
    suggestions: container,
  } = PLAYER_ELS.get(key);
  if (!input || !container || !titleInput) return;

  // Holds the AbortController for the most recent in-flight name suggestions
  // request. Replaced on every new name query; aborted when the query changes.
  let nameController = null;

  function applyPlayer({ name, title, standard, rapid, blitz }) {
    input.value = name;
    titleInput.value = title;
    // Mark title as auto-filled so clearPlayer knows it is safe to wipe.
    titleInput.dataset.autoFilled = "true";
    Object.assign(input.dataset, { standard, rapid, blitz });
    container.replaceChildren();
    // formEls.time is the cached module-level reference — no getElementById here.
    const time = formEls.time?.value.trim();
    if (!ratingEl.dataset.userSet) {
      ratingEl.value = pickRating({ standard, rapid, blitz }, time) || "";
    }
  }

  function clearPlayer() {
    delete input.dataset.standard;
    delete input.dataset.rapid;
    delete input.dataset.blitz;
    // Only wipe the title if it was auto-filled by autocomplete or FIDE
    // resolution. If the user typed it manually, leave it untouched.
    if (titleInput.dataset.autoFilled) {
      titleInput.value = "";
      delete titleInput.dataset.autoFilled;
    }
    if (!ratingEl.dataset.userSet) ratingEl.value = "";
  }

  async function onFideQuery(query) {
    try {
      // Explicit radix prevents misinterpretation of zero-padded strings.
      const player = await fetchFidePlayer(parseInt(query, 10));
      if (input.value.trim() !== query) return; // stale
      applyPlayer(player);
    } catch (err) {
      if (input.value.trim() !== query) return; // stale
      // Building the error suggestion atomically via innerHTML is faster than
      // multiple createElement/appendChild cycles.
      container.innerHTML = `
        <div class="autocomplete-suggestion" style="pointer-events: none;">
          <i>FIDE ID not found</i>
        </div>`;
      // Auto-clear after 1000 ms, but only if this exact bad ID is still typed.
      setTimeout(() => {
        if (input.value.trim() === query) container.replaceChildren();
      }, 1000);
    }
  }

  async function onNameQuery(query) {
    // Cancel any previous in-flight request for this player before firing a
    // new one — parallel calls across players are fine, but serial calls for
    // the same player are wasteful since only the latest result is ever rendered.
    nameController?.abort();
    nameController = new AbortController();
    const players = await fetchPlayerSuggestions(query, nameController.signal);
    if (isEmpty(players)) return; // aborted — a newer query is already in flight
    if (input.value.trim() !== query) return; // stale
    renderSuggestions(container, query, players);
  }

  input.addEventListener("input", ({ target }) => {
    const query = target.value.trim();
    nameController?.abort();
    nameController = null;
    container.replaceChildren();
    if (!query) {
      clearPlayer();
      return;
    }
    if (isFideId(query)) {
      onFideQuery(query);
      return;
    }
    if (query.length > 1) onNameQuery(query);
  });

  container.addEventListener("click", ({ target }) => {
    const item = target.closest(".autocomplete-suggestion");
    if (!item) return;
    applyPlayer({
      name: item.dataset.name,
      title: item.dataset.title,
      standard: Number(item.dataset.standard),
      rapid: Number(item.dataset.rapid),
      blitz: Number(item.dataset.blitz),
    });
  });
}

/* ─── Form State ─────────────────────────────────────────────────────────── */

// A single DOM pass over PLAYER_ELS and formEls collects all player and game
// fields at once. Raw (un-formatted) strings are returned so that
// validateState can do its cheap checks before any formatting runs.
function getFormState() {
  const players = Object.fromEntries(
    UI.players.map(({ key }) => {
      const { player, title, rating } = PLAYER_ELS.get(key);
      return [
        key,
        {
          rawName: player.value.trim(),
          rawTitle: title.value,
          rawRating: rating.value,
        },
      ];
    }),
  );
  return {
    result: formEls.result.value,
    time: formEls.time.value || "",
    tournament: formEls.tournament.value,
    round: Math.max(1, toNumberOr(formEls.round.value, 1)),
    date: formEls.date.value,
    gameLink: formEls.gameLink.value,
    players,
  };
}

// Validates cheap conditions (string checks) on raw state before any expensive
// formatting (formatName, capitalize, abbreviateTitle) is ever called.
// Returns an error string, or null if valid.
function validateState(state) {
  if (state.result === "0") return "Please select a result!";
  if (!state.players.white.rawName) return "White player name cannot be empty!";
  if (!state.players.black.rawName) return "Black player name cannot be empty!";
  return null;
}

// Runs only after validateState passes — formatting effort is never wasted on
// invalid submissions.
function formatPlayers({ white, black }) {
  const fmt = ({ rawName, rawTitle, rawRating }) => ({
    name: formatName(capitalize(rawName)),
    title: abbreviateTitle(rawTitle.toUpperCase()),
    rating: toNumberOr(rawRating, 0),
  });
  return { white: fmt(white), black: fmt(black) };
}

/* ─── Game Helpers ───────────────────────────────────────────────────────── */

function buildGame(
  players,
  { result, time, tournament, round, date, gameLink },
) {
  return {
    id: generateUniqueID(),
    white: players.white.name,
    whiteRating: players.white.rating,
    whiteTitle: players.white.title,
    black: players.black.name,
    blackRating: players.black.rating,
    blackTitle: players.black.title,
    result,
    tournament,
    round,
    time,
    date,
    gameLink,
  };
}

// Blocks submission if either player already appears in the same round,
// tournament, and date — not just when both players match together.
function isDuplicate({ white, black, date, tournament, round }) {
  return window.games.some(
    (g) =>
      (g.white === white || g.black === black) &&
      g.date === date &&
      g.tournament === tournament &&
      g.round === round,
  );
}

function gameAddedAlert({ whiteTitle, white, blackTitle, black }) {
  alert(
    `${formatPlayerLabel(whiteTitle, white)} vs ${formatPlayerLabel(blackTitle, black)} — Game Added!`,
  );
}

/* ─── Form Submission ────────────────────────────────────────────────────── */

// Pipeline: collect → validate (cheap) → format (expensive) → build → dedupe
//           → persist → reset UI.
async function addGame(event) {
  const form = event.target;
  event.preventDefault();
  clearFormError(form);

  // Disable the submit button for the duration of the async pipeline so a
  // double-click cannot enqueue a second submission while the first is in flight.
  formEls.submit.disabled = true;
  showLoader(`#${UI.form.submit} span`);

  try {
    // 1. Collect — one DOM pass, raw values
    const state = getFormState();

    // 2. Validate — cheap string checks before any formatting
    const error = validateState(state);
    if (error) return showFormError(form, error);

    // 3. Format — expensive normalization runs only for valid submissions
    const players = formatPlayers(state.players);

    // 4. Build  5. Dedupe  6. Persist  7. Reset UI
    const game = buildGame(players, state);
    if (isDuplicate(game))
      return showFormError(
        form,
        "Game already exists or player conflict in this round!",
      );
    window.games.push(game);

    // saveGames starts first (gets a head start on await dbReady) while
    // displayGames runs synchronously to completion — identical outcome to
    // sequential execution but saveGames begins its async work immediately.
    await Promise.all([saveGames(), form.reset()]);

    // Yield one full paint cycle before alerting. Without this, alert() fires
    // before the browser has painted the updated DOM — the user sees the old
    // page behind the dialog and perceives the games as "not yet loaded" when
    // they dismiss it.
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    gameAddedAlert(game);
  } finally {
    formEls.submit.disabled = false;
    hideLoader(`#${UI.form.submit} span`);
  }
}

/* ─── Initialization ─────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  const gameForm = document.getElementById(UI.form.root);

  // Resolve every element once and store in module-level caches.
  // From this point forward, no function needs to call getElementById.
  UI.players.forEach(({ key, player, title, rating, suggestions }) => {
    PLAYER_ELS.set(key, {
      player: document.getElementById(player),
      title: document.getElementById(title),
      rating: document.getElementById(rating),
      suggestions: document.getElementById(suggestions),
    });
  });

  formEls = {
    result: document.getElementById(UI.form.fields.result),
    time: document.getElementById(UI.form.fields.time),
    tournament: document.getElementById(UI.form.fields.tournament),
    round: document.getElementById(UI.form.fields.round),
    date: document.getElementById(UI.form.fields.date),
    gameLink: document.getElementById(UI.form.fields.gameLink),
    submit: document.getElementById(UI.form.submit),
  };

  // Wait for the DB load kicked off at module scope to complete before wiring
  // up the submit handler. This ensures window.games is populated so that
  // isDuplicate checks are accurate even if the user opens the page fresh.
  await loadGames();

  gameForm?.addEventListener("submit", addGame);

  gameForm?.addEventListener("reset", () => {
    UI.players.forEach(({ key }) => {
      const {
        player: playerEl,
        rating: ratingEl,
        title: titleEl,
      } = PLAYER_ELS.get(key);
      if (ratingEl) delete ratingEl.dataset.userSet;
      if (playerEl) {
        delete playerEl.dataset.standard;
        delete playerEl.dataset.rapid;
        delete playerEl.dataset.blitz;
      }
      if (titleEl) delete titleEl.dataset.autoFilled;
    });
    clearFormError(gameForm);
  });

  // Single initialization pass combines autocomplete setup, rating ownership
  // tracking, and title ownership tracking.
  UI.players.forEach((side) => {
    setupAutocomplete(side);

    const { rating: ratingEl, title: titleEl } = PLAYER_ELS.get(side.key);

    // Marks the rating field as user-owned on any manual edit so auto-fill
    // never clobbers intentional input.
    if (ratingEl) {
      ratingEl.addEventListener("input", () => {
        if (ratingEl.value.trim()) ratingEl.dataset.userSet = "true";
        else delete ratingEl.dataset.userSet;
      });
    }

    // Any manual edit to the title field removes the autoFilled marker so
    // clearPlayer knows not to wipe it.
    if (titleEl) {
      titleEl.addEventListener("input", () => {
        delete titleEl.dataset.autoFilled;
      });
    }
  });

  // On blur (not input) so ratings recalculate only once the user leaves the
  // time-control field, not on every character typed.
  formEls.time?.addEventListener("blur", ({ target }) => {
    UI.players.forEach(({ key }) => {
      const { player: playerEl, rating: ratingEl } = PLAYER_ELS.get(key);
      if (!playerEl?.dataset.standard || ratingEl?.dataset.userSet) return;
      const cached = {
        standard: Number(playerEl.dataset.standard),
        rapid: Number(playerEl.dataset.rapid),
        blitz: Number(playerEl.dataset.blitz),
      };
      ratingEl.value = pickRating(cached, target.value) || "";
    });
  });

  // Single passive listener handles outside-click/tap dismissal for all
  // suggestion containers — covers both mouse and touch (mobile).
  document.addEventListener(
    "pointerdown",
    (e) => {
      UI.players.forEach(({ key }) => {
        const { player, suggestions } = PLAYER_ELS.get(key);
        if (!player?.contains(e.target) && !suggestions?.contains(e.target)) {
          suggestions?.replaceChildren();
        }
      });
    },
    { passive: true },
  );

  // Kept inside DOMContentLoaded for structural consistency — all listeners
  // that reference PLAYER_ELS live here.
  document.addEventListener("keydown", ({ key }) => {
    if (key !== "Escape") return;
    UI.players.forEach(({ key: k }) =>
      PLAYER_ELS.get(k)?.suggestions?.replaceChildren(),
    );
  });
});
