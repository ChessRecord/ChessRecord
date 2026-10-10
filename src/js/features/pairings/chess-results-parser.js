/**
 * Parsing of chess-results.com player pages (HTML text in → plain objects out).
 *
 * The pages are deeply nested layout tables, so every lookup walks DIRECT children
 * (table → tbody → tr → td/th). That keeps outer layout tables, whose cells contain
 * all descendant text, and the nested tables inside result cells from being mistaken
 * for the table we are after.
 */

import { hasValue, isEmpty, isNonEmptyString } from "../../lib/values.js";

export const LAYOUT_MISMATCH =
  "Chess-Results mismatch. Please verify the URL or tournament status.";

/** The only rows of the player-info table the app keeps. */
const PLAYER_PROFILE_KEYS = new Set([
  "Name",
  "Title",
  "Starting rank",
  "Rating",
  "Rating national",
  "Rating international",
  "Performance rating",
  "FIDE rtg +/-",
  "Points",
  "Rank",
  "Federation",
  "Club/City",
  "Ident-Number",
  "Fide-ID",
  "Year of birth",
]);

/* ─── DOM helpers ────────────────────────────────────────────────────────── */

const childrenNamed = (element, ...names) =>
  Array.from(element.children).filter((child) => names.includes(child.localName));

/** Rows of a table's own <tbody>s (rows nested in cells are not included). */
const rowsOf = (table) =>
  childrenNamed(table, "tbody").flatMap((tbody) => childrenNamed(tbody, "tr"));

const textOf = (element) => element?.textContent.trim() ?? "";

/** The label cell's text without its trailing colon ("Name:" → "Name"). */
const labelOf = (cell) => textOf(cell).replace(/:$/, "");

/**
 * Parse fetched page HTML into an inert fragment root. The document it lives in has no
 * browsing context, so scripts do not run and images are not requested.
 *
 * @param {string} html
 * @returns {HTMLElement}
 */
export function parseHtml(html) {
  const root = document.implementation.createHTMLDocument("").createElement("div");
  root.innerHTML = html;
  return root;
}

/* ─── Player info ────────────────────────────────────────────────────────── */

/**
 * Read the player's profile (name, rank, rating, …) from the info table, which is the
 * table with a direct first-column cell labelled "Name".
 *
 * @param {HTMLElement} root Result of {@link parseHtml}
 * @returns {Record<string, string>} Only the keys in PLAYER_PROFILE_KEYS
 * @throws {Error} LAYOUT_MISMATCH when no such table exists
 */
export function parsePlayerInfo(root) {
  const table = Array.from(root.querySelectorAll("table")).find((candidate) =>
    rowsOf(candidate).some((row) => {
      const first = row.firstElementChild;
      return first?.localName === "td" && labelOf(first) === "Name";
    }),
  );
  if (!table) throw new Error(LAYOUT_MISMATCH);

  return Object.fromEntries(
    rowsOf(table)
      .map((row) => {
        const cells = childrenNamed(row, "td");
        return [labelOf(cells[0]), textOf(cells[1])];
      })
      .filter(([key]) => PLAYER_PROFILE_KEYS.has(key)),
  );
}

/* ─── Pairings ───────────────────────────────────────────────────────────── */

/**
 * Link to an opponent's profile: the source URL with its `snr` (start number) replaced.
 *
 * @param {string} baseUrl
 * @param {string | number} startNo
 * @returns {string} "" for an invalid start number
 */
export function buildOpponentProfileUrl(baseUrl, startNo) {
  const snr = Number(startNo);
  if (!isNonEmptyString(baseUrl) || !hasValue(startNo) || isNaN(snr) || snr <= 0) return "";
  const parsed = new URL(baseUrl);
  parsed.searchParams.set("snr", String(snr));
  return parsed.toString();
}

/**
 * Read all pairings from the results table: the table whose first row has <th> header
 * cells including "Rd" and "Res". Columns are located by header text, so extra or
 * reordered columns are handled.
 *
 * @param {HTMLElement} root Result of {@link parseHtml}
 * @param {string} url The page's own URL, used to build opponent profile links
 * @returns {Array<Record<string, string | number>>}
 * @throws {Error} LAYOUT_MISMATCH when the table or its Rd/Res columns are missing
 */
export function parsePairings(root, url) {
  const table = Array.from(root.querySelectorAll("table")).find((candidate) => {
    const headerRow = rowsOf(candidate)[0];
    if (!headerRow) return false;
    const headerCells = childrenNamed(headerRow, "th", "td");
    if (!headerCells.some((cell) => cell.localName === "th")) return false;
    const texts = headerCells.map(textOf);
    return texts.some((t) => t.includes("Rd")) && texts.some((t) => t.includes("Res"));
  });
  if (!table) throw new Error(LAYOUT_MISMATCH);

  const rows = rowsOf(table);
  // The (unnamed) title column has an empty header: call it "Title".
  const headers = childrenNamed(rows[0], "th").map((th) => textOf(th) || "Title");

  const columnIndex = (keyword) => headers.findIndex((h) => h.includes(keyword));
  const idx = {
    rd: columnIndex("Rd"),
    bo: columnIndex("Bo"),
    sno: columnIndex("SNo"),
    title: columnIndex("Title"),
    name: columnIndex("Name"),
    rtg: columnIndex("Rtg"),
    fed: columnIndex("FED"),
    club: columnIndex("Club"),
    pts: columnIndex("Pts"),
    res: columnIndex("Res"),
  };
  if (idx.rd < 0 || idx.res < 0) throw new Error(LAYOUT_MISMATCH);

  return rows
    .filter((row) => isEmpty(childrenNamed(row, "th")))
    .map((row) => {
      const cells = childrenNamed(row, "td");
      const cell = (i) => (i >= 0 ? textOf(cells[i]) : "");
      const resultCell = cells[idx.res];
      return {
        round: cell(idx.rd),
        boardNo: cell(idx.bo),
        playerStartNo: cell(idx.sno),
        opponentTitle: cell(idx.title),
        opponentName: cell(idx.name),
        opponentRating: parseInt(cell(idx.rtg), 10) || 0,
        opponentFederation: cell(idx.fed),
        opponentClub: cell(idx.club),
        opponentPoints: cell(idx.pts),
        result: cell(idx.res),
        playerColor: resultCell?.querySelector("div.FarbesT")
          ? "Black"
          : resultCell?.querySelector("div.FarbewT")
            ? "White"
            : "",
        opponentProfileUrl: buildOpponentProfileUrl(url, cell(idx.sno)),
      };
    })
    .filter((pairing) => pairing.round !== "");
}
