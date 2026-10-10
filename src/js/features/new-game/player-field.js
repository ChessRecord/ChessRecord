/**
 * One player's group of inputs on the New Game form (name, title, rating) plus the
 * suggestion list under the name.
 *
 * Typing behaves as follows:
 *   - a FIDE ID (5–10 digits)   → look the player up and fill name, title and rating
 *   - a name (2+ characters)    → show matching players to choose from
 *   - nothing                   → forget the resolved player
 *
 * Auto-filled values never overwrite what the user typed themselves:
 *   - a title the user edited is kept when the name is cleared
 *   - a rating the user typed is never replaced by an auto-filled one
 */

import { isFideId } from "../../domain/player.js";
import { createHighlighter } from "../../lib/text.js";
import { isEmpty } from "../../lib/values.js";
import { fetchFidePlayer, fetchPlayerSuggestions } from "./fide-api.js";
import { pickRating } from "./rating-picker.js";

/**
 * The ratings were once stashed in `data-*` attributes, which turned every value into a
 * string and back, so `null` became `NaN`. Keep that conversion: `pickRating` treats NaN
 * and null differently when it falls back from a missing rapid/blitz rating.
 */
const storedRating = (value) => Number(String(value));

/** Suggestion list markup. Each item carries its player in `data-*` attributes. */
function renderSuggestions(container, query, players) {
  if (isEmpty(players)) {
    container.replaceChildren();
    return;
  }
  const highlight = createHighlighter(query);
  container.innerHTML = players
    .map((p) => {
      const titleTag = p.title ? `<span class="player-title">${p.title}</span> ` : "";
      return `
      <div class="autocomplete-suggestion"
           data-name="${p.name}"
           data-title="${p.title || ""}"
           data-standard="${p.standard}"
           data-rapid="${p.rapid}"
           data-blitz="${p.blitz}">
        ${titleTag}${highlight(p.name)}
      </div>`;
    })
    .join("");
}

/**
 * @param {Object} options
 * @param {HTMLInputElement} options.nameInput
 * @param {HTMLInputElement} options.titleInput
 * @param {HTMLInputElement} options.ratingInput
 * @param {HTMLElement} options.suggestionsEl
 * @param {() => string} options.getTimeControl Current value of the form's time-control input
 */
export function createPlayerField({
  nameInput,
  titleInput,
  ratingInput,
  suggestionsEl,
  getTimeControl,
}) {
  /** Ratings of the player picked from the API; null until one is resolved. */
  let ratings = null;
  /** True while the title was filled in automatically (so clearing the name may clear it). */
  let titleAutoFilled = false;
  /** True once the user typed a rating themselves. */
  let ratingUserSet = false;
  /** Controller of the latest in-flight name search. */
  let searchRequest = null;

  function applyPlayer({ name, title, standard, rapid, blitz }) {
    nameInput.value = name;
    titleInput.value = title;
    titleAutoFilled = true;
    ratings = {
      standard: storedRating(standard),
      rapid: storedRating(rapid),
      blitz: storedRating(blitz),
    };
    suggestionsEl.replaceChildren();
    if (!ratingUserSet) {
      ratingInput.value = pickRating({ standard, rapid, blitz }, getTimeControl().trim()) || "";
    }
  }

  function clearPlayer() {
    ratings = null;
    // Only wipe a title that was filled in automatically.
    if (titleAutoFilled) {
      titleInput.value = "";
      titleAutoFilled = false;
    }
    if (!ratingUserSet) ratingInput.value = "";
  }

  async function resolveFideId(query) {
    try {
      // Explicit radix so zero-padded IDs are not read as octal.
      const player = await fetchFidePlayer(parseInt(query, 10));
      if (nameInput.value.trim() !== query) return; // the user kept typing: stale answer
      applyPlayer(player);
    } catch (error) {
      if (nameInput.value.trim() !== query) return;
      alert(error.message || "FIDE ID not found");
    }
  }

  async function searchByName(query) {
    // Only the newest query matters, so cancel the previous request.
    searchRequest?.abort();
    searchRequest = new AbortController();
    const players = await fetchPlayerSuggestions(query, searchRequest.signal);
    if (isEmpty(players)) return; // aborted (a newer search is running) or nothing found
    if (nameInput.value.trim() !== query) return; // stale
    renderSuggestions(suggestionsEl, query, players);
  }

  nameInput.addEventListener("input", ({ target }) => {
    const query = target.value.trim();
    searchRequest?.abort();
    searchRequest = null;
    suggestionsEl.replaceChildren();
    if (!query) {
      clearPlayer();
      return;
    }
    if (isFideId(query)) {
      resolveFideId(query);
      return;
    }
    if (query.length > 1) searchByName(query);
  });

  suggestionsEl.addEventListener("click", ({ target }) => {
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

  ratingInput.addEventListener("input", () => {
    ratingUserSet = Boolean(ratingInput.value.trim());
  });

  titleInput.addEventListener("input", () => {
    titleAutoFilled = false;
  });

  return {
    /** Recompute the rating for a changed time control (no-op without a resolved player). */
    applyTimeControl(time) {
      if (!ratings || ratingUserSet) return;
      ratingInput.value = pickRating(ratings, time) || "";
    },

    /** Forget everything auto-filled; called when the form is reset. */
    reset() {
      ratingUserSet = false;
      ratings = null;
      titleAutoFilled = false;
    },

    closeSuggestions() {
      suggestionsEl.replaceChildren();
    },

    /** Is `node` part of this field's name input or its suggestion list? */
    owns(node) {
      return nameInput.contains(node) || suggestionsEl.contains(node);
    },
  };
}
