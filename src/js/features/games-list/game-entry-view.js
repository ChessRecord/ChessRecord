/**
 * Markup for one game in the list.
 *
 * Values are interpolated into HTML without escaping, exactly as before: the list is
 * filled from the user's own data, and tournament names rely on this to carry
 * `<strong>` search highlights.
 */

import { getTimeControlCategory } from "../../domain/time-control.js";
import { formatResult } from "../../domain/result.js";

const TIME_CONTROL_ICONS = Object.freeze({
  Bullet: '<i class="fa-solid fa-bolt-lightning"></i> ',
  Blitz: '<i class="fa-solid fa-bolt-lightning"></i> ',
  Rapid: '<i class="fa-solid fa-clock"></i> ',
  Classical: '<i class="fa-solid fa-hourglass-half"></i> ',
  Unknown: "",
});

/** Titles the data marks as absent ("none", any case) are not shown. */
const isShownTitle = (title) => Boolean(title) && title.trim().toLowerCase() !== "none";

const renderTitle = (title) =>
  isShownTitle(title) ? `<span class="player-title">${title}</span>` : "";

/** "90+30 • Classical" with the matching icon, or just the date, or nothing. */
function renderMetaRight(game, category) {
  const timeDisplay = game.time
    ? category === "Unknown"
      ? game.time
      : `${game.time}<span class="timecontrol-category"> • ${category}</span>`
    : "";
  const timeIcon = TIME_CONTROL_ICONS[category] || TIME_CONTROL_ICONS.Unknown;
  const dateHtml = game.date ? `<strong class="game-date">${game.date}</strong>` : "";

  if (!timeDisplay) return dateHtml;
  const timeHtml = `<span class="game-time">${timeIcon} ${timeDisplay}</span>`;
  return game.date ? `${timeHtml} | ${dateHtml}` : timeHtml;
}

/**
 * @param {import("../../domain/game.js").Game} game
 * @returns {string} HTML for the game card
 */
export function renderGameEntry(game) {
  const gameId = game.id || "unknown";
  const category = getTimeControlCategory(game.time);

  const roundLabel = game.board != null ? `Board ${game.board}` : `Round ${game.round}`;
  const metaLeft = `<span class="game-round">${game.round}</span><strong class="round-label">${roundLabel}</strong>`;
  const metaRight = renderMetaRight(game, category);

  return `<a href="${game.gameLink || "#"}"${game.gameLink ? ' target="_blank"' : ""} class="game-entry-link">
      <div class="game-entry" data-game-id="${gameId}">
        <div class="game-meta">
          <div class="game-meta-left">${metaLeft}</div>
          <div class="game-meta-right">${metaRight}</div>
        </div>
        <div class="game-players">
          <div class="player-white">
            ${renderTitle(game.whiteTitle)}
            <span class="player-name">${game.white || "Unknown"}</span>
            <span class="player-rating">${game.whiteRating || 0}</span>
          </div>
          <div class="game-result"><strong>${formatResult(game.result)}</strong></div>
          <div class="player-black">
            ${renderTitle(game.blackTitle)}
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
