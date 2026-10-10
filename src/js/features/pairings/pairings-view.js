/**
 * Rendering of the player header and the pairings table.
 * Values are interpolated into HTML without escaping, exactly as before.
 */

import { formatSigned } from "../../lib/text.js";
import { hasValue } from "../../lib/values.js";
import { normalisePoints } from "./format.js";

/** A column shown only when its field has a value in at least one round. */
const simpleColumn = (header, key) => ({
  header,
  isPresent: (round) => hasValue(round[key]),
  render: (round) => `<td>${round[key]}</td>`,
});

const COLUMNS = [
  simpleColumn("Round", "round"),
  simpleColumn("Board", "boardNo"),
  simpleColumn("Start", "playerStartNo"),
  simpleColumn("Rank", "opponentRank"),
  {
    header: "Name",
    isPresent: (round) => hasValue(round.opponentName),
    render: (round) => `<td>
      <span class="player-title">${round.opponentTitle || ""}</span>
      ${
        round.opponentProfileUrl
          ? `<a href="${round.opponentProfileUrl}" target="_blank">${round.opponentName}</a>`
          : round.opponentName
      }
    </td>`,
  },
  {
    header: "Rating",
    isPresent: (round) => hasValue(round.opponentRating),
    render: (round) =>
      `<td>${
        round.opponentRating
          ? `<span class="tooltip" style="height:100%;width:100%;">${round.opponentRating}
               <span class="tooltiptext">Win: ${round.win}<br>Draw: ${round.draw}<br>Loss: ${round.loss}</span>
             </span>`
          : "0"
      }</td>`,
  },
  {
    header: "Federation",
    isPresent: (round) => !!round.opponentFederation?.trim(),
    render: (round) => `<td>${round.opponentFederation}</td>`,
  },
  simpleColumn("Club/City", "opponentClub"),
  simpleColumn("Points", "opponentPoints"),
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
      return `<td class="result-cell">${colorSpan}<span>${round.result}</span></td>`;
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
      ? `<span class="gap"></span><span class="player-points">${normalisePoints(points)}${totalRounds ? ` / ${totalRounds}` : ""}</span>`
      : "";

    profile.innerHTML = [
      rank ? `<span class="player-rank">#${rank}</span> ` : "",
      federation ? `<span class="player-federation">${federation}</span> ` : "",
      title ? `<span class="player-title">${title}</span> ` : "",
      url
        ? `<a href="${url}" id="player-profile-link" target="_blank"><strong>${name}</strong></a>`
        : `<strong>${name}</strong>`,
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
