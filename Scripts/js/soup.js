/**
 * soup.js — ChesSoup compressor / decompressor
 *
 * ChesSoup is a compact, human-readable encoding for chess game records.
 * Compression: ~3.7x over JSON | ~72% size reduction
 *
 * API
 *   compress(games: Object[]) → string
 *   decompress(soup: string)  → Object[]
 */

"use strict";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

/** JSON result value → ChesSoup operator */
const RESULT_TO_OP = Object.freeze({
  "1-0": ">",
  "0-1": "<",
  "½-½": "=",
  "1/2-1/2": "=",
  "*": "*",
  "": "*",
});

/** ChesSoup operator → canonical JSON result */
const OP_TO_RESULT = Object.freeze({
  ">": "1-0",
  "<": "0-1",
  "=": "1/2-1/2",
  "*": "*",
});

/**
 * Round header: #N[.B] "TC" [Date]
 *
 * Group 1: round number
 * Group 2: board number (optional)
 * Group 3: time control (always quoted, may be empty)
 * Group 4: remainder — raw date token (may be empty or whitespace)
 */
const RE_ROUND_HEADER = /^#(\d+)(?:\.(\d+))?\s+"([^"]*)"\s*(.*)$/;

/**
 * Game line: [Title]ID[(Rating)] OP [Title]ID[(Rating)] [~"link"]
 *
 * Groups: wTitle, wId, wRating, op, bTitle, bId, bRating, link
 */
const RE_GAME_LINE =
  /^(?:\[([A-Z]+)\])?(\d+)(?:\((\d+)\))?([><=*])(?:\[([A-Z]+)\])?(\d+)(?:\((\d+)\))?(?:~"([^"]*)")?$/;

/** Registry entry: ID:"Name" */
const RE_REGISTRY_ENTRY = /^(\d+):"(.*)"$/;

/** Full ISO date (YYYY-MM-DD, no wildcards) */
const RE_FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 8-digit compact date (YYYYMMDD) */
const RE_COMPACT_DATE = /^\d{8}$/;

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

/**
 * Encodes a JSON date value for inclusion in a round header.
 *   "YYYY-MM-DD"  →  "YYYYMMDD"    (hyphens removed)
 *   "YYYY-??-??"  →  "YYYY-??-??"  (kept as-is)
 *   ""            →  ""            (absent)
 */
function encodeDate(date) {
  if (!date) return "";
  return RE_FULL_DATE.test(date) ? date.replace(/-/g, "") : date;
}

/**
 * Decodes a raw date token from a round header back to JSON form.
 *   "YYYYMMDD"    →  "YYYY-MM-DD"
 *   "YYYY-??-??"  →  "YYYY-??-??"  (kept as-is)
 *   ""            →  ""
 */
function decodeDate(token) {
  if (!token) return "";
  if (RE_COMPACT_DATE.test(token)) {
    return `${token.slice(0, 4)}-${token.slice(4, 6)}-${token.slice(6, 8)}`;
  }
  return token;
}

// ─── COMPRESS ─────────────────────────────────────────────────────────────────

/**
 * Compresses an array of JSON game records into a ChesSoup string.
 *
 * @param {Array<{
 *   white:       string,
 *   whiteRating: number,
 *   whiteTitle:  string,
 *   black:       string,
 *   blackRating: number,
 *   blackTitle:  string,
 *   result:      string,
 *   tournament:  string,
 *   round:       number,
 *   board:       number|null|undefined,
 *   time:        string,
 *   date:        string,
 *   gameLink:    string
 * }>} games
 * @returns {string} ChesSoup-encoded text
 */
function compress(games) {
  if (!Array.isArray(games) || games.length === 0) return "§\n";

  // ── Pass 1: Build global player registry in order of first appearance ──
  /** @type {Map<string, number>} */
  const idOf = new Map();
  /** @type {string[]} */
  const nameOf = [];

  const getOrAdd = (raw) => {
    const name = raw || "Unknown";
    if (!idOf.has(name)) {
      idOf.set(name, nameOf.length);
      nameOf.push(name);
    }
    return idOf.get(name);
  };

  for (const g of games) {
    getOrAdd(g.white);
    getOrAdd(g.black);
  }

  // ── Pass 2: Group games by tournament (order of first appearance) ──
  /** @type {Map<string, Array>} */
  const byTournament = new Map();
  for (const g of games) {
    const t = g.tournament || "Unknown";
    if (!byTournament.has(t)) byTournament.set(t, []);
    byTournament.get(t).push(g);
  }

  // ── Pass 3: Emit ChesSoup ──
  const out = [];

  // Player registry block
  out.push("§");
  for (let i = 0; i < nameOf.length; i++) {
    out.push(`${i}:"${nameOf[i]}"`);
  }

  // Tournament blocks
  for (const [tournament, tGames] of byTournament) {
    out.push("");
    out.push(`@"${tournament}"`);

    // Emit a new round header whenever the (round, board, TC, date) tuple
    // changes from the previous game within this tournament.
    let prevRoundKey = null;

    for (const g of tGames) {
      const board = g.board != null ? g.board : null;
      // Use NUL as a safe delimiter — none of these fields can contain it
      const roundKey = `${g.round ?? 1}\0${board}\0${g.time ?? ""}\0${g.date ?? ""}`;

      if (roundKey !== prevRoundKey) {
        out.push("");
        out.push(buildRoundHeader(g));
        prevRoundKey = roundKey;
      }

      out.push(buildGameLine(g, idOf));
    }
  }

  return out.join("\n") + "\n";
}

/**
 * @param {Object} g  game record
 * @returns {string}  round header line  e.g. '#3.2 "90+30" 20250426'
 */
function buildRoundHeader(g) {
  const round = g.round ?? 1;
  const board = g.board != null ? g.board : null;
  const tc = g.time ?? "";
  const date = encodeDate(g.date ?? "");

  const roundPart = board !== null ? `#${round}.${board}` : `#${round}`;

  // Date is appended only when non-empty; TC is always quoted (even when empty)
  return date ? `${roundPart} "${tc}" ${date}` : `${roundPart} "${tc}"`;
}

/**
 * @param {Object}          g      game record
 * @param {Map<string,number>} idOf  player-name → id map
 * @returns {string}  game line  e.g. '[AIM]2(1750)<0(1515)~"https://..."'
 */
function buildGameLine(g, idOf) {
  const wId = idOf.get(g.white || "Unknown");
  const bId = idOf.get(g.black || "Unknown");

  const wTitle = g.whiteTitle ? `[${g.whiteTitle}]` : "";
  const bTitle = g.blackTitle ? `[${g.blackTitle}]` : "";
  const wRating = g.whiteRating > 0 ? `(${g.whiteRating})` : "";
  const bRating = g.blackRating > 0 ? `(${g.blackRating})` : "";
  const op = RESULT_TO_OP[g.result] ?? "*";
  const link = g.gameLink ? `~"${g.gameLink}"` : "";

  return `${wTitle}${wId}${wRating}${op}${bTitle}${bId}${bRating}${link}`;
}

// ─── DECOMPRESS ───────────────────────────────────────────────────────────────

/**
 * Decompresses a ChesSoup string into an array of canonical JSON game records.
 *
 * The output schema exactly mirrors the source JSON format:
 *   white, whiteRating, whiteTitle, black, blackRating, blackTitle,
 *   result, tournament, round[, board], time, date, gameLink
 *
 * `board` is included only when non-null (matching the source JSON convention).
 *
 * @param {string} soup  ChesSoup-encoded text
 * @returns {Array<Object>} game records
 */
function decompress(soup) {
  if (typeof soup !== "string" || !soup.trim()) return [];

  const lines = soup.split(/\r?\n/);

  /** @type {string[]} id → name */
  const players = [];
  /** @type {Array<Object>} */
  const games = [];

  // Context state
  let inRegistry = false;
  let tournament = "Unknown";
  let round = 1;
  let board = null;
  let tc = "";
  let date = "";

  for (let i = 0, len = lines.length; i < len; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // ── Registry start sentinel ──
    if (line === "§") {
      inRegistry = true;
      continue;
    }

    // ── Registry entries ──
    if (inRegistry) {
      const m = line.match(RE_REGISTRY_ENTRY);
      if (m) {
        players[+m[1]] = m[2];
        continue;
      }
      // Non-registry line encountered: registry section has ended.
      // Fall through so the current line is processed normally.
      inRegistry = false;
    }

    // ── Tournament block header ──
    if (line.charCodeAt(0) === 64 /* '@' */) {
      const m = line.match(/^@"(.*)"$/);
      if (m) tournament = m[1];
      continue;
    }

    // ── Round header ──
    if (line.charCodeAt(0) === 35 /* '#' */) {
      const m = line.match(RE_ROUND_HEADER);
      if (m) {
        round = +m[1];
        board = m[2] != null ? +m[2] : null;
        tc = m[3];
        date = decodeDate(m[4].trim());
      }
      continue;
    }

    // ── Game line ──
    const m = line.match(RE_GAME_LINE);
    if (!m) continue;

    const [, wTitle, wIdStr, wRatStr, op, bTitle, bIdStr, bRatStr, link] = m;

    const wId = +wIdStr;
    const bId = +bIdStr;

    // Build the record with fields in canonical order.
    // `board` is inserted only when non-null to preserve source JSON shape.
    const record = {
      white: players[wId] ?? "Unknown",
      whiteRating: wRatStr ? +wRatStr : 0,
      whiteTitle: wTitle || "",
      black: players[bId] ?? "Unknown",
      blackRating: bRatStr ? +bRatStr : 0,
      blackTitle: bTitle || "",
      result: OP_TO_RESULT[op] ?? "*",
      tournament,
      round,
      ...(board !== null && { board }),
      time: tc,
      date,
      gameLink: link || "",
    };

    games.push(record);
  }

  return games;
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

/** Global aliases for app integration */
window.toSoup = compress;
window.fromSoup = decompress;

if (typeof module !== "undefined" && module.exports) {
  module.exports = { compress, decompress, toSoup, fromSoup };
}
