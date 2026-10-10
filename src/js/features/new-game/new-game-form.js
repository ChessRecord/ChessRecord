/**
 * New Game page feature: reads the form, validates it, adds the game to the store and
 * keeps the two player fields' auto-fill state in step with the rest of the form.
 */

import { isDuplicateGame, normalizeGames } from "../../domain/game.js";
import { formatPlayerLabel } from "../../domain/player.js";
import { afterNextPaint, requireElement } from "../../lib/dom.js";
import { toNumberOr } from "../../lib/values.js";
import { hideLoader, showLoader } from "../../ui/loader.js";
import { buildGame, formatPlayers, validateFormState } from "./game-submission.js";
import { createPlayerField } from "./player-field.js";

/** The ids of one side's inputs, e.g. `#white-player`, `#white-title`. */
const sideElements = (side) => ({
  nameInput: requireElement(`#${side}-player`),
  titleInput: requireElement(`#${side}-title`),
  ratingInput: requireElement(`#${side}-rating`),
  suggestionsEl: requireElement(`#${side}-suggestions`),
});

/**
 * @param {Object} deps
 * @param {ReturnType<typeof import("../../storage/game-store.js").createGameStore>} deps.store
 *        A store whose games are already loaded (needed for duplicate detection)
 */
export function initNewGameForm({ store }) {
  const form = requireElement("#game-form");
  const submitButton = requireElement("#add-game-btn");
  const inputs = {
    result: requireElement("#result"),
    time: requireElement("#time"),
    tournament: requireElement("#tournament"),
    round: requireElement("#round"),
    date: requireElement("#date"),
    gameLink: requireElement("#game-link"),
  };

  const sides = { white: sideElements("white"), black: sideElements("black") };
  const fields = Object.fromEntries(
    Object.entries(sides).map(([side, elements]) => [
      side,
      createPlayerField({ ...elements, getTimeControl: () => inputs.time.value }),
    ]),
  );

  /** One pass over the DOM: raw values only, no formatting. */
  function readFormState() {
    const player = ({ nameInput, titleInput, ratingInput }) => ({
      rawName: nameInput.value.trim(),
      rawTitle: titleInput.value,
      rawRating: ratingInput.value,
    });
    return {
      result: inputs.result.value,
      time: inputs.time.value || "",
      tournament: inputs.tournament.value,
      round: Math.max(1, toNumberOr(inputs.round.value, 1)),
      date: inputs.date.value,
      gameLink: inputs.gameLink.value,
      players: { white: player(sides.white), black: player(sides.black) },
    };
  }

  async function addGame(event) {
    event.preventDefault();

    // Cheap checks first: no UI changes for a form that is obviously incomplete.
    const state = readFormState();
    const error = validateFormState(state);
    if (error) return alert(error);

    // Lock the button while saving so a double click cannot submit twice.
    submitButton.disabled = true;
    showLoader(submitButton);

    try {
      const game = normalizeGames([buildGame(formatPlayers(state.players), state)])[0];
      if (isDuplicateGame(store.games, game)) {
        return alert("Game already exists or player conflict in this round!");
      }

      await store.add(game);
      form.reset();

      // Let the cleared form paint before alert() blocks the page.
      await afterNextPaint();
      const { whiteTitle, white, blackTitle, black } = game;
      alert(
        `${formatPlayerLabel(whiteTitle, white)} vs ${formatPlayerLabel(blackTitle, black)} — Game Added!`,
      );
    } finally {
      submitButton.disabled = false;
      hideLoader(submitButton);
    }
  }

  form.addEventListener("submit", addGame);

  form.addEventListener("reset", () => {
    for (const field of Object.values(fields)) field.reset();
  });

  // Recalculate auto-filled ratings when the user leaves the time-control field
  // (on blur, not on every keystroke).
  inputs.time.addEventListener("blur", ({ target }) => {
    for (const field of Object.values(fields)) field.applyTimeControl(target.value);
  });

  // Close the suggestion lists on a pointer press outside their own field (mouse and touch).
  document.addEventListener(
    "pointerdown",
    (event) => {
      for (const field of Object.values(fields)) {
        if (!field.owns(event.target)) field.closeSuggestions();
      }
    },
    { passive: true },
  );

  document.addEventListener("keydown", ({ key }) => {
    if (key !== "Escape") return;
    for (const field of Object.values(fields)) field.closeSuggestions();
  });
}
