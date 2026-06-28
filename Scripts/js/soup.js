/**
 * soup.js — ChesSoup compressor / decompressor
 * Depends on: utils.js (isEmpty, isValidString, toNumberOr, normalizeResult)
 *
 * ChesSoup is a compact, human-readable encoding for chess game records.
 * Compression: ~3.7x over JSON | ~72% size reduction
 *
 * Exposed globals:
 *   toSoup(games)  → string     compress JSON array → ChesSoup
 *   fromSoup(soup) → Object[]   decompress ChesSoup → JSON array
 */

"use strict";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

/**
 * Canonical JSON result → ChesSoup operator.
 * Input is always pre-normalised through normalizeResult() (from utils.js),
 * so only the four canonical values are needed here.
 */
const RESULT_TO_OP = Object.freeze({
  "1-0": ">",
  "0-1": "<",
  "1/2-1/2": "=",
  "*": "*",
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
 * Group 1: round  Group 2: board (opt)  Group 3: TC  Group 4: raw date token
 */
const RE_ROUND_HEADER = /^#(\d+)(?:\.(\d+))?\s+"([^"]*)"\s*(.*)$/;

/**
 * Game line: [Title]ID[(Rating)] OP [Title]ID[(Rating)] [~"link"]
 * Groups: wTitle, wId, wRating, op, bTitle, bId, bRating, link
 */
const RE_GAME_LINE =
  /^(?:\[([A-Z]+)\])?(\d+)(?:\((\d+)\))?([><=*])(?:\[([A-Z]+)\])?(\d+)(?:\((\d+)\))?(?:~"([^"]*)")?$/;

/** Registry entry: ID:"Name" */
const RE_REGISTRY_ENTRY = /^(\d+):"(.*)"$/;

/** Full ISO date — YYYY-MM-DD, digits only (no wildcards) */
const RE_FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 8-digit compact date — YYYYMMDD */
const RE_COMPACT_DATE = /^\d{8}$/;

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

/**
 * Encodes a JSON date for a round header.
 *   "YYYY-MM-DD"  →  "YYYYMMDD"    (hyphens stripped)
 *   "YYYY-??-??"  →  "YYYY-??-??"  (kept as-is)
 *   ""            →  ""
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
 * @param {Object[]} games
 * @returns {string}
 */
function compress(games) {
  // isEmpty() from utils.js — handles null, undefined, and empty arrays
  if (isEmpty(games)) return "§\n";

  // ── Pass 1: Build global player registry (order of first appearance) ──
  const idOf = new Map(); // name → id
  const nameOf = []; // id   → name

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
  const byTournament = new Map();
  for (const g of games) {
    const t = g.tournament || "Unknown";
    if (!byTournament.has(t)) byTournament.set(t, []);
    byTournament.get(t).push(g);
  }

  // ── Pass 3: Emit ChesSoup ──
  const out = [];

  // Registry block
  out.push("§");
  for (let i = 0; i < nameOf.length; i++) out.push(`${i}:"${nameOf[i]}"`);

  // Tournament blocks
  for (const [tournament, tGames] of byTournament) {
    out.push("");
    out.push(`@"${tournament}"`);

    let prevRoundKey = null;

    for (const g of tGames) {
      const board = g.board != null ? g.board : null;
      // NUL delimiter — safe because none of these fields can contain it
      const roundKey = `${g.round ?? 1}\0${board}\0${g.time ?? ""}\0${g.date ?? ""}`;

      if (roundKey !== prevRoundKey) {
        out.push("");
        out.push(_roundHeader(g));
        prevRoundKey = roundKey;
      }

      out.push(_gameLine(g, idOf));
    }
  }

  return out.join("\n") + "\n";
}

/** @returns {string}  e.g. '#3.2 "90+30" 20250426' */
function _roundHeader(g) {
  const round = g.round ?? 1;
  const board = g.board != null ? g.board : null;
  const tc = g.time ?? "";
  const date = encodeDate(g.date ?? "");

  const roundPart = board !== null ? `#${round}.${board}` : `#${round}`;
  return date ? `${roundPart} "${tc}" ${date}` : `${roundPart} "${tc}"`;
}

/** @returns {string}  e.g. '[AIM]2(1750)<0(1515)~"https://..."' */
function _gameLine(g, idOf) {
  const wId = idOf.get(g.white || "Unknown");
  const bId = idOf.get(g.black || "Unknown");

  const wTitle = g.whiteTitle ? `[${g.whiteTitle}]` : "";
  const bTitle = g.blackTitle ? `[${g.blackTitle}]` : "";
  const wRating = g.whiteRating > 0 ? `(${g.whiteRating})` : "";
  const bRating = g.blackRating > 0 ? `(${g.blackRating})` : "";
  const link = g.gameLink ? `~"${g.gameLink}"` : "";

  // normalizeResult() from utils.js handles ½-½, 1/2-1/2, "", * uniformly
  const op = RESULT_TO_OP[normalizeResult(g.result)] ?? "*";

  return `${wTitle}${wId}${wRating}${op}${bTitle}${bId}${bRating}${link}`;
}

// ─── DECOMPRESS ───────────────────────────────────────────────────────────────

/**
 * Decompresses a ChesSoup string into an array of canonical JSON game records.
 * `board` is included only when non-null (matching the source JSON convention).
 * @param {string} soup
 * @returns {Object[]}
 */
function decompress(soup) {
  // isValidString() from utils.js — rejects null, undefined, and ""
  if (!isValidString(soup)) return [];

  const lines = soup.split(/\r?\n/);
  const players = []; // id → name
  const games = [];

  let inRegistry = false;
  let tournament = "Unknown";
  let round = 1;
  let board = null;
  let tc = "";
  let date = "";

  for (let i = 0, len = lines.length; i < len; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Registry sentinel
    if (line === "§") {
      inRegistry = true;
      continue;
    }

    // Registry entries
    if (inRegistry) {
      const m = line.match(RE_REGISTRY_ENTRY);
      if (m) {
        players[+m[1]] = m[2];
        continue;
      }
      inRegistry = false; // end of registry — fall through
    }

    // Tournament header
    if (line.charCodeAt(0) === 64 /* '@' */) {
      const m = line.match(/^@"(.*)"$/);
      if (m) tournament = m[1];
      continue;
    }

    // Round header
    if (line.charCodeAt(0) === 35 /* '#' */) {
      const m = line.match(RE_ROUND_HEADER);
      if (m) {
        // toNumberOr() from utils.js — safe string-to-number with explicit fallback
        round = toNumberOr(m[1], 1);
        board = toNumberOr(m[2], null); // undefined capture → null
        tc = m[3];
        date = decodeDate(m[4].trim());
      }
      continue;
    }

    // Game line
    const m = line.match(RE_GAME_LINE);
    if (!m) continue;

    const [, wTitle, wIdStr, wRatStr, op, bTitle, bIdStr, bRatStr, link] = m;

    const record = {
      white: players[+wIdStr] ?? "Unknown",
      whiteRating: toNumberOr(wRatStr, 0), // undefined when unrated → 0
      whiteTitle: wTitle || "",
      black: players[+bIdStr] ?? "Unknown",
      blackRating: toNumberOr(bRatStr, 0), // undefined when unrated → 0
      blackTitle: bTitle || "",
      result: OP_TO_RESULT[op] ?? "*",
      tournament,
      round,
      ...(board !== null && { board }), // omit when null (matches source JSON)
      time: tc,
      date,
      gameLink: link || "",
    };

    games.push(record);
  }

  return games;
}

// ─── BROWSER GLOBALS ──────────────────────────────────────────────────────────

window.toSoup = compress;
window.fromSoup = decompress;
