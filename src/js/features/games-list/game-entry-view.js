/**
 * Markup for one game in the list.
 *
 * Every game field is HTML-escaped: games come from imported files as well as the form, so
 * a name like `<img onerror=…>` must show up as text. The link is only used as `href` when
 * it is an http(s) URL (escaping cannot defuse `javascript:`).
 */

import { getTimeControlCategory } from "../../domain/time-control.js";
import { formatResult } from "../../domain/result.js";
import { escapeHtml, isSafeUrl } from "../../lib/html.js";

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
  isShownTitle(title) ? `<span class="player-title">${escapeHtml(title)}</span>` : "";

/** "90+30 • Classical" with the matching icon, or just the date, or nothing. */
function renderMetaRight(game, category) {
  const time = escapeHtml(game.time);
  const timeDisplay = game.time
    ? category === "Unknown"
      ? time
      : `${time}<span class="timecontrol-category"> • ${category}</span>`
    : "";
  const timeIcon = TIME_CONTROL_ICONS[category] || TIME_CONTROL_ICONS.Unknown;
  const dateHtml = game.date ? `<strong class="game-date">${escapeHtml(game.date)}</strong>` : "";

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
  const metaLeft = `<span class="game-round">${escapeHtml(game.round)}</span><strong class="round-label">${escapeHtml(roundLabel)}</strong>`;
  const metaRight = renderMetaRight(game, category);

  const hasLink = Boolean(game.gameLink) && isSafeUrl(game.gameLink);
  const href = hasLink ? escapeHtml(game.gameLink) : "#";

  return `<a href="${href}"${hasLink ? ' target="_blank"' : ""} class="game-entry-link">
      <div class="game-entry" data-game-id="${escapeHtml(gameId)}">
        <div class="game-meta">
          <div class="game-meta-left">${metaLeft}</div>
          <div class="game-meta-right">${metaRight}</div>
        </div>
        <div class="game-players">
          <div class="player-white">
            ${renderTitle(game.whiteTitle)}
            <span class="player-name">${escapeHtml(game.white || "Unknown")}</span>
            <span class="player-rating">${escapeHtml(game.whiteRating || 0)}</span>
          </div>
          <div class="game-result"><strong>${escapeHtml(formatResult(game.result))}</strong></div>
          <div class="player-black">
            ${renderTitle(game.blackTitle)}
            <span class="player-name">${escapeHtml(game.black || "Unknown")}</span>
            <span class="player-rating">${escapeHtml(game.blackRating || 0)}</span>
          </div>
        </div>
        <button class="delete-game-btn">
          <i class="fa-solid fa-delete-left"></i>
        </button>
      </div>
    </a>`;
}
