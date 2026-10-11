/**
 * Rendering of the player header and the pairings table.
 *
 * Everything shown here was scraped from a web page, so every value is HTML-escaped on its
 * way into the markup, and links are only emitted for http(s) URLs.
 */

import { escapeHtml, isSafeUrl } from "../../lib/html.js";
import { formatSigned } from "../../lib/text.js";
import { hasValue } from "../../lib/values.js";
import { normalisePoints } from "./format.js";

/**
 * Chess-Results points as HTML ("1,5" → "1½"). `normalisePoints` produces an HTML entity,
 * so the raw text is escaped first and converted second.
 */
const pointsHtml = (raw) => normalisePoints(escapeHtml(raw));

/** A column shown only when its field has a value in at least one round. */
const simpleColumn = (header, key) => ({
  header,
  isPresent: (round) => hasValue(round[key]),
  render: (round) => `<td>${escapeHtml(round[key])}</td>`,
});

const COLUMNS = [
  simpleColumn("Round", "round"),
  simpleColumn("Board", "boardNo"),
  simpleColumn("Start", "playerStartNo"),
  simpleColumn("Rank", "opponentRank"),
  {
    header: "Name",
    isPresent: (round) => hasValue(round.opponentName),
    render: (round) => {
      const name = escapeHtml(round.opponentName);
      const hasLink = round.opponentProfileUrl && isSafeUrl(round.opponentProfileUrl);
      return `<td>
      <span class="player-title">${escapeHtml(round.opponentTitle || "")}</span>
      ${hasLink ? `<a href="${escapeHtml(round.opponentProfileUrl)}" target="_blank">${name}</a>` : name}
    </td>`;
    },
  },
  {
    header: "Rating",
    isPresent: (round) => hasValue(round.opponentRating),
    render: (round) =>
      `<td>${
        round.opponentRating
          ? `<span class="tooltip" style="height:100%;width:100%;">${escapeHtml(round.opponentRating)}
               <span class="tooltiptext">Win: ${escapeHtml(round.win)}<br>Draw: ${escapeHtml(round.draw)}<br>Loss: ${escapeHtml(round.loss)}</span>
             </span>`
          : "0"
      }</td>`,
  },
  {
    header: "Federation",
    isPresent: (round) => !!round.opponentFederation?.trim(),
    render: (round) => `<td>${escapeHtml(round.opponentFederation)}</td>`,
  },
  simpleColumn("Club/City", "opponentClub"),
  {
    header: "Points",
    isPresent: (round) => hasValue(round.opponentPoints),
    render: (round) => `<td>${pointsHtml(round.opponentPoints)}</td>`,
  },
  {
    header: "Result",
    isPresent: () => true,
    render: (round) => {
      if (!round.result) return `<td class="result-cell hidden"></td>`;

      const colorSpan =
        round.playerColor === "Black"
          ? '<span class="box-black"></span>'
          : round.playerColor === "White"
            ? '<span class="box-white"></span>'
            : "";
      return `<td class="result-cell">${colorSpan}<span>${escapeHtml(round.result)}</span></td>`;
    },
  },
];

/**
 * @param {Object} elements
 * @param {HTMLElement} elements.profile Receives the player header
 * @param {HTMLElement} elements.table   Receives the results table
 * @param {HTMLElement} elements.note    Receives the rating-difference footnote
 */
export function createPairingsView({ profile, table, note }) {
  /** "#4 IND GM Name 2105 (+5) · 3½ / 9": nothing is shown without a player name. */
  function renderPlayerHeader(playerData, url, totalRounds) {
    const { name, title, rank, rating, rtgchg, federation, points } = playerData;
    if (!name) return;

    const rtgchgFinite = Number.isFinite(rtgchg);
    const newRating = Math.round(rating + (rtgchgFinite ? rtgchg : 0));
    const changeStr =
      rtgchgFinite && rtgchg !== 0
        ? `<span class="player-rtgchg">(${formatSigned(rtgchg)})</span>`
        : "";
    const pointsStr = points
      ? `<span class="gap"></span><span class="player-points">${pointsHtml(points)}${totalRounds ? ` / ${escapeHtml(totalRounds)}` : ""}</span>`
      : "";
    const strongName = `<strong>${escapeHtml(name)}</strong>`;

    profile.innerHTML = [
      rank ? `<span class="player-rank">#${escapeHtml(rank)}</span> ` : "",
      federation ? `<span class="player-federation">${escapeHtml(federation)}</span> ` : "",
      title ? `<span class="player-title">${escapeHtml(title)}</span> ` : "",
      url && isSafeUrl(url)
        ? `<a href="${escapeHtml(url)}" id="player-profile-link" target="_blank">${strongName}</a>`
        : strongName,
      Number.isFinite(rating)
        ? ` <span class="player-rating">${newRating} ${changeStr}</span>`
        : "",
      pointsStr,
    ].join("");
  }

  /**
   * Draw the player header and the table. A column whose field is empty in every round
   * is left out.
   *
   * @param {Object[]} rounds
   * @param {Object} playerData
   * @param {string} url
   */
  function render(rounds, playerData, url) {
    const totalRounds = rounds[rounds.length - 1]?.round ?? "";
    renderPlayerHeader(playerData, url, totalRounds);

    const visible = COLUMNS.filter((col) => rounds.some((round) => col.isPresent(round)));
    const headerCells = visible.map((col) => `<th>${col.header}</th>`).join("");
    const bodyRows = rounds
      .map((round) => `<tr>${visible.map((col) => col.render(round)).join("")}</tr>`)
      .join("");

    const showNote =
      playerData.rating > 0 &&
      rounds.some(
        (round) =>
          round.opponentRating > 0 && Math.abs(playerData.rating - round.opponentRating) > 400,
      );

    table.innerHTML = `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
    note.innerHTML = showNote
      ? "*) Rating difference of more than 400. It was limited to 400."
      : "";
  }

  return { render };
}
