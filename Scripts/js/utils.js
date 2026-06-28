/**
 * utils.js — General utility functions and Chess logic
 *
 * Depends on: None (utility library). Used by: games.js, new.js, pairings.js, soup.js
 *
 * Provides validation & formatting helpers, Unicode variant utilities, a small
 * storage wrapper for local/session storage, a download helper, chess-specific
 * utilities (title abbreviations, time control parsing), PGN parsing, and
 * persistence (Dexie + localStorage mirror).
 *
 * Exposed globals:
 *   Storage                                  localStorage/sessionStorage wrapper
 *   toUnicodeVariant(str, variant, flags)    → string   convert ASCII to Unicode variant
 *   normalizeGames(games)                    → Object[]  coerce raw games to canonical shape
 *   loadGames(target)                       → Promise<Array>  read from IDB/localStorage
 *   saveGames(newGames, deleteId)           → Promise<void>   write to IDB/localStorage
 */

"use strict";

console.log(`
  ██████╗██╗  ██╗███████╗███████╗███████╗██████╗ ███████╗ ██████╗ ██████╗ ██████╗ ██████╗
 ██╔════╝██║  ██║██╔════╝██╔════╝██╔════╝██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗
 ██║     ███████║█████╗  ███████╗███████╗██████╔╝█████╗  ██║     ██║   ██║██████╔╝██║  ██║
 ██║     ██╔══██║██╔══╝  ╚════██║╚════██║██╔══██╗██╔══╝  ██║     ██║   ██║██╔══██╗██║  ██║
 ╚██████╗██║  ██║███████╗███████║███████║██║  ██║███████╗╚██████╗╚██████╔╝██║  ██║██████╔╝
  ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝
`);

const today = new Date().toISOString().split("T")[0];

/* ─── Validation & Basic Helpers ──────────────────────────────────────── */

const isValidString = (s) => typeof s === "string" && !isEmpty(s);

const isValidObject = (o) => o !== null && typeof o === "object";

const isValidArray = (a) => Array.isArray(a) && a.length > 0;

const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";

const isEmpty = (value) => !value || value.length === 0;

const toNumberOr = (value, fallback = 0) => {
  if (!hasValue(value)) return fallback;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : fallback;
};

const signum = (v) => {
  const n = +v;
  return isNaN(n) ? "NaN" : (n > 0 ? "+" : "") + (n || 0);
};

const generateUniqueID = () => {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for non-secure contexts (http) or older browsers
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
};

/* ─── String Formatting ─────────────────────────────────────────────────── */

function capitalize(str) {
  if (!isValidString(str)) return "";
  return str.replace(
    /\S+/g,
    (w) => w[0].toUpperCase() + w.slice(1).toLowerCase(),
  );
}

function formatName(name) {
  if (!isValidString(name)) return "";
  const parts = name.split(", ");
  if (parts.length !== 2) return name.trim();
  const [last, first] = parts;
  return `${first.trim()} ${last.trim()}`.trim();
}

function highlightMatch(query, result) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return result.replace(
    new RegExp(`(${escaped})`, "gi"),
    "<strong>$1</strong>",
  );
}

/* ─── Unicode Variant Helpers ───────────────────────────────────────────── */

const buildSpecialMap = (startCode, rangeStart = 97, rangeEnd = 122) => {
  const map = {};
  for (let i = rangeStart; i <= rangeEnd; i++) {
    map[String.fromCharCode(i)] = startCode + (i - rangeStart);
  }
  return map;
};

const SPECIAL_P = Object.freeze(buildSpecialMap(0x249c));
const SPECIAL_W = Object.freeze(buildSpecialMap(0xff41));

const UNICODE_OFFSETS = Object.freeze({
  m: [0x1d670, 0x1d7f6],
  b: [0x1d400, 0x1d7ce],
  i: [0x1d434, 0x00030],
  bi: [0x1d468, 0x00030],
  c: [0x1d49c, 0x00030],
  bc: [0x1d4d0, 0x00030],
  g: [0x1d504, 0x00030],
  d: [0x1d538, 0x1d7d8],
  bg: [0x1d56c, 0x00030],
  s: [0x1d5a0, 0x1d7e2],
  bs: [0x1d5d4, 0x1d7ec],
  is: [0x1d608, 0x00030],
  bis: [0x1d63c, 0x00030],
  o: [0x24b6, 0x2460],
  p: [0x249c, 0x2474],
  w: [0xff21, 0xff10],
  u: [0x2090, 0xff10],
});

const VARIANT_ALIASES = Object.freeze({
  monospace: "m",
  bold: "b",
  italic: "i",
  "bold italic": "bi",
  script: "c",
  "bold script": "bc",
  gothic: "g",
  "gothic bold": "bg",
  doublestruck: "d",
  sans: "s",
  "bold sans": "bs",
  "italic sans": "is",
  "bold italic sans": "bis",
  parenthesis: "p",
  circled: "o",
  fullwidth: "w",
});

const UNICODE_SPECIAL = Object.freeze({
  m: { " ": 0x2000, "-": 0x2013 },
  i: { h: 0x210e },
  g: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
  o: {
    0: 0x24ea,
    1: 0x2460,
    2: 0x2461,
    3: 0x2462,
    4: 0x2463,
    5: 0x2464,
    6: 0x2465,
    7: 0x2466,
    8: 0x2467,
    9: 0x2468,
  },
  p: SPECIAL_P,
  w: SPECIAL_W,
});

/**
 * Convert ASCII characters to a Unicode variant based on variant alias or code offsets.
 * Flags may include 'underline' and 'strike' to add combining characters.
 *
 * @param {string} str
 * @param {string} variant
 * @param {string} flags
 * @returns {string}
 */
function toUnicodeVariant(str, variant, flags) {
  if (!isValidString(str)) return "";
  const getType = (v) => VARIANT_ALIASES[v] || (UNICODE_OFFSETS[v] ? v : "m");
  const type = getType(variant);
  const flagArr = isValidString(flags)
    ? flags.split(",").map((f) => f.trim())
    : [];
  const underline = flagArr.includes("underline");
  const strike = flagArr.includes("strike");
  let result = "";

  for (const k of str) {
    const specialCode = UNICODE_SPECIAL[type]?.[k];
    if (specialCode) {
      result += String.fromCodePoint(specialCode);
    } else {
      const code = k.charCodeAt(0);
      const ci =
        code >= 65 && code <= 90
          ? code - 65
          : code >= 97 && code <= 122
            ? code - 71
            : -1;
      if (ci > -1) {
        result += String.fromCodePoint(ci + UNICODE_OFFSETS[type][0]);
      } else {
        const ni = code >= 48 && code <= 57 ? code - 48 : -1;
        result +=
          ni > -1 ? String.fromCodePoint(ni + UNICODE_OFFSETS[type][1]) : k;
      }
    }
    if (underline) result += "\u0332";
    if (strike) result += "\u0336";
  }
  return result;
}

const formatPlayerLabel = (title, name) => {
  const t = title?.trim();
  return t ? `${toUnicodeVariant(t, "bold sans", "sans")} ${name}` : name;
};

/* ─── Browser Utilities ─────────────────────────────────────────────────── */

/* ─── Storage ────────────────────────────────────────────────────────────── */

// Factory producing a uniform get/set/remove interface over any Web Storage
// backend. Defined once — no duplication between localStorage and
// sessionStorage. `name` is used solely for the console warning on set failure.
/**
 * Factory producing a uniform get/set/remove interface over any Web Storage
 * backend. Defined once — no duplication between localStorage and
 * sessionStorage. `name` is used solely for the console warning on set failure.
 *
 * @param {Storage} store
 * @param {string} name
 * @returns {{get:Function,set:Function,remove:Function,proxy:Function}}
 */
const makeStorage = (store, name) => ({
  get(key, fallback = null) {
    try {
      const val = store.getItem(key);
      if (val === null) return fallback;
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    } catch {
      return fallback;
    }
  },
  set(key, val) {
    try {
      store.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.warn(`${name} set failed:`, e.name);
      return false;
    }
  },
  remove(key) {
    try {
      store.removeItem(key);
    } catch {}
  },
  // Creates a scoped object for a specific key
  proxy(key) {
    return {
      get: (fallback) => this.get(key, fallback),
      set: (val) => this.set(key, val),
      remove: () => this.remove(key),
      clear: () => this.remove(key),
    };
  },
});

const Storage = {
  ...makeStorage(localStorage, "localStorage"),
  session: makeStorage(sessionStorage, "sessionStorage"),
};

/* ─── Download ──────────────────────────────────────────────────────────── */

// Modern browsers click detached anchors without requiring a DOM insertion,
// so appendChild/removeChild are unnecessary.
/**
 * Trigger a browser download of the supplied content under the given filename.
 * Uses a Blob + object URL to avoid DOM insertion. Returns true on success.
 *
 * @param {string|Blob|ArrayBuffer|string[]} content
 * @param {string} filename
 * @param {string} [contentType="application/json"]
 * @returns {boolean}
 */
function download(content, filename, contentType = "application/json") {
  try {
    const url = URL.createObjectURL(new Blob([content], { type: contentType }));
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: filename,
    });
    link.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error("Download failed:", e);
    return false;
  }
}

/* ─── Chess Specific Logic ──────────────────────────────────────────────── */

const TITLE_MAP = Object.freeze({
  grandmaster: "GM",
  internationalmaster: "IM",
  fidemaster: "FM",
  candidatemaster: "CM",
  womangrandmaster: "WGM",
  womaninternationalmaster: "WIM",
  womanfidemaster: "WFM",
  womancandidatemaster: "WCM",
  nationalmaster: "NM",
});

const TIME_CONTROL_ICONS = Object.freeze({
  Bullet: '<i class="fa-solid fa-bolt-lightning"></i> ',
  Blitz: '<i class="fa-solid fa-bolt-lightning"></i> ',
  Rapid: '<i class="fa-solid fa-clock"></i> ',
  Classical: '<i class="fa-solid fa-hourglass-half"></i> ',
  Unknown: "",
});

function abbreviateTitle(title) {
  if (!isValidString(title)) return "";
  const normalized = title.toLowerCase().replace(/\s+/g, "");
  return TITLE_MAP[normalized] || title;
}

/**
 * Parse a time control string into initialTime (minutes) and increment (seconds).
 * Accepts formats like "90+30", "90|min", "90", etc.
 *
 * @param {string|number} tc
 * @returns {{initialTime:number, increment:number}}
 */
function parseTimeControl(tc) {
  const cleanTC = String(tc).toLowerCase().replace(/\s+/g, "");
  const sep = cleanTC.includes("+") ? "+" : cleanTC.includes("|") ? "|" : null;
  if (sep) {
    const [initialTime, increment] = cleanTC.split(sep).map(Number);
    return { initialTime, increment };
  }
  // Handles both "90min" and plain numeric strings ("90").
  return { initialTime: Number(cleanTC.replace("min", "")), increment: 0 };
}

/**
 * Classify a time control into the category Bullet/Blitz/Rapid/Classical/Unknown.
 *
 * @param {number} initial - initial time in minutes
 * @param {number} increment - increment in seconds
 * @returns {string}
 */
function classifyTimeControl(initial, increment) {
  if (![initial, increment].every((n) => Number.isFinite(n) && n >= 0))
    return "Unknown";
  const initialSeconds = initial * 60;
  const estimatedMinutes = (initialSeconds + increment * 40) / 60;
  if (initial < 3 && estimatedMinutes < 7) return "Bullet";
  if (initial < 10 && estimatedMinutes < 25) return "Blitz";
  if (initial < 30 && estimatedMinutes < 60) return "Rapid";
  return "Classical";
}

/**
 * Determine the time control category given a time control string.
 *
 * @param {string|number} timeControl
 * @returns {string}
 */
function getTimeControlCategory(timeControl) {
  try {
    const { initialTime, increment } = parseTimeControl(timeControl);
    return classifyTimeControl(initialTime, increment);
  } catch {
    return "Unknown";
  }
}

/**
 * Normalize a result token for internal processing: convert unicode half symbol
 * to "1/2" and remove whitespace.
 *
 * @param {string} result
 * @returns {string}
 */
const cleanResult = (result) =>
  result.trim().replace(/½/g, "1/2").replace(/\s+/g, "");

/**
 * Format a result string into a display-friendly form.
 * Known canonical outputs: "1 - 0", "0 - 1", "½ - ½". Falls back to the
 * trimmed input for any unknown value and returns "*" when the input is invalid.
 *
 * @param {string} result
 * @returns {string}
 */
function formatResult(result) {
  if (!isValidString(result)) return "*";
  switch (cleanResult(result)) {
    case "1-0":
      return "1 - 0";
    case "0-1":
      return "0 - 1";
    case "1/2-1/2":
      return "½ - ½";
    default:
      return result.trim();
  }
}

/**
 * Normalises fractional-point notation from the server format
 * (e.g. "1,5" → "1½", "0,5" → "½").
 *
 * @param {string} raw
 * @returns {string}
 */
const normalisePoints = (raw) =>
  isValidString(raw) ? raw.replace(/0?,5/g, "&#189;") : "";

/**
 * Normalise a result into one of the canonical JSON results used by the app
 * ("1-0", "0-1", "1/2-1/2"). Returns "*" when the input cannot be mapped.
 *
 * @param {string} result
 * @returns {string}
 */
function normalizeResult(result) {
  if (!isValidString(result)) return "*";
  const cleaned = cleanResult(result);
  switch (cleaned) {
    case "1-0":
    case "0-1":
    case "1/2-1/2":
      return cleaned;
    default:
      return "*";
  }
}

/**
 * Quick heuristic: is the query a numeric FIDE ID (5–10 digits)?
 *
 * @param {string} query
 * @returns {boolean}
 */
function isFideId(query) {
  return /^\d{5,10}$/.test(query.trim());
}

/**
 * Normalize a player payload (from remote API) into the compact local shape.
 *
 * @param {{name:string,title?:string,standard?:number,rapid?:number,blitz?:number}} param0
 * @returns {{name:string,title:string,standard:number,rapid:number,blitz:number}}
 */
function normalizePlayer({
  name,
  title = "",
  standard = 0,
  rapid = 0,
  blitz = 0,
}) {
  return {
    name: formatName(capitalize(name)),
    title: abbreviateTitle(title),
    standard,
    rapid,
    blitz,
  };
}

/**
 * Return a cached RegExp for extracting a PGN tag value like [Event "..."]
 * Caches compiled expressions to avoid repeated RegExp allocation.
 *
 * @returns {(tag:string) => RegExp}
 */
const getTagRegex = (() => {
  const cache = new Map();
  return (tag) => {
    if (!cache.has(tag)) cache.set(tag, new RegExp(`\\[${tag}\\s"([^"]*)"\\]`));
    return cache.get(tag);
  };
})();

/**
 * Parse a PGN string into an array of canonical game objects.
 * Supports multiple games separated by PGN headers. Returns an empty
 * array when input is empty or invalid.
 *
 * @param {string} pgn
 * @returns {Object[]}
 */
function pgnToJson(pgn) {
  if (!isValidString(pgn)) return [];
  const games = pgn.split(/\n\n(?=\[Event)/).filter(Boolean);
  return games.map((game, idx) => {
    const getTag = (tag) => game.match(getTagRegex(tag))?.[1] ?? "";
    const resultStr = getTag("Result").trim();
    const normalizedResult = resultStr === "1/2-1/2" ? "½-½" : resultStr;
    const roundParts = getTag("Round").split(".");
    return {
      white: getTag("White").trim() || "Unknown",
      whiteRating: Math.max(0, toNumberOr(getTag("WhiteElo"), 0)),
      whiteTitle: getTag("WhiteTitle").trim() || "",
      black: getTag("Black").trim() || "Unknown",
      blackRating: Math.max(0, toNumberOr(getTag("BlackElo"), 0)),
      blackTitle: getTag("BlackTitle").trim() || "",
      result: normalizedResult,
      tournament:
        (getTag("StudyName") || getTag("Event")).trim().split(":").pop() ||
        "Unknown",
      round: Math.max(1, toNumberOr(roundParts[0] || NaN, idx + 1)),
      board:
        toNumberOr(getTag("Board"), 0) || toNumberOr(roundParts[1], 0) || null,
      time: getTag("TimeControl").trim() || "",
      date: getTag("Date").replace(/\./g, "-") || "",
      gameLink: getTag("ChapterURL") || getTag("Site") || "",
    };
  });
}

/**
 * Compute expected score (Elo) given ratings.
 *
 * @param {number} myRating
 * @param {number} oppRating
 * @returns {number}
 */
function expectedScore(myRating, oppRating) {
  return 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
}

/**
 * Calculate an Elo rating change projection for a single game.
 * Returns a numeric delta rounded to one decimal, or an empty string when
 * the opponent rating is zero (indeterminate).
 *
 * @param {number} myRating
 * @param {number} oppRating
 * @param {number} result - 1 = win, 0.5 = draw, 0 = loss
 * @param {number} [k=40]
 * @returns {number|string}
 */
function calcChange(myRating, oppRating, result, k = 40) {
  if (oppRating === 0) return "";
  const E = expectedScore(myRating, oppRating);
  return Math.round(k * (result - E) * 10) / 10;
}

/* ─── Shared Chess Data Logic ───────────────────────────────────────────── */

/**
 * In-place sort of a games array.
 * Ordering:
 *   1) Tournament date (newest first)
 *   2) Tournament name (alphabetical)
 *   3) Round (ascending)
 *   4) Board (ascending, nulls first)
 *
 * @param {Array<Object>} games
 * @returns {void}
 */
function sortGames(games) {
  if (isEmpty(games)) return;

  // Calculate tournamentMaxDates once per sort. Using a numeric timestamp
  // directly avoids repeated New Date() / getTime() calls during the sort loop.
  const tournamentMaxDates = new Map();
  for (const g of games) {
    const d = g.date ? Date.parse(g.date) : 0;
    const currentMax = tournamentMaxDates.get(g.tournament) || 0;
    if (!isNaN(d) && d > currentMax) {
      tournamentMaxDates.set(g.tournament || "Unknown", d);
    }
  }

  games.sort((a, b) => {
    // 1. Sort by Tournament Date (Newest first)
    const dateA = tournamentMaxDates.get(a.tournament || "Unknown") || 0;
    const dateB = tournamentMaxDates.get(b.tournament || "Unknown") || 0;
    if (dateB !== dateA) return dateB - dateA;

    // 2. Sort by Tournament Name (Alphabetical)
    if (a.tournament !== b.tournament)
      return (a.tournament || "").localeCompare(b.tournament || "");

    // 3. Sort by Round (Ascending)
    const roundDiff = (a.round ?? 0) - (b.round ?? 0);
    if (roundDiff !== 0) return roundDiff;

    // 4. Sort by Board (Ascending, Nulls first to match original logic)
    if (a.board === b.board) return 0;
    if (a.board == null) return -1;
    if (b.board == null) return 1;
    return a.board - b.board;
  });
}

/**
 * Normalize a raw games array into the canonical internal shape expected by
 * the application (ids, numeric ratings, trimmed strings, default values).
 *
 * @param {Object[]} games
 * @returns {Object[]} normalizedGames
 */
function normalizeGames(games) {
  if (!isValidArray(games)) return [];
  return games.map((game) => ({
    id: game.id || generateUniqueID(),
    white: (game.white || "Unknown").trim(),
    whiteRating: toNumberOr(game.whiteRating, 0),
    whiteTitle: (game.whiteTitle || "").trim(),
    black: (game.black || "Unknown").trim(),
    blackRating: toNumberOr(game.blackRating, 0),
    blackTitle: (game.blackTitle || "").trim(),
    result: (game.result || "*").trim(),
    tournament: (game.tournament || "Unknown").trim(),
    round: Math.max(1, toNumberOr(game.round, 1)),
    board: toNumberOr(game.board, null) || null,
    time: (game.time || "").trim(),
    date: (game.date || "").replace(/\./g, "-").trim(),
    gameLink: (game.gameLink || "").trim(),
  }));
}

/* ─── IndexedDB / Dexie Setup ────────────────────────────────────────────── */

const indexStorageKey = "ChessRecord";
const storageVersion = 2;
const localStorageKey = "chessGames";

let indexStorage = null;
let useIndexStorage = false;

const gamesLocalStorage = Storage.proxy(localStorageKey);

// Guard: fires synchronously at parse time so a script-ordering mistake
// (e.g. async/defer on the Dexie <script> tag) is immediately visible in the
// console rather than silently degrading to localStorage.
if (typeof window.Dexie === "undefined") {
  console.error(
    "[ChessRecord] Dexie.js is not loaded. " +
      "Ensure the Dexie <script> tag appears before utils.js and carries no async/defer attribute.",
  );
}

const dbReady = (async () => {
  try {
    const Dexie = window.Dexie;
    if (typeof Dexie === "undefined") throw new Error("Dexie.js is not loaded");

    const dexie = new Dexie(indexStorageKey);

    // ── Schema versioning ────────────────────────────────────────────────────
    // Always declare every past version so Dexie can run the correct upgrade
    // path when a user opens a database created by an older release. Never
    // mutate an existing .version() entry — add a new block with an .upgrade()
    // callback instead.
    //
    // v1 → v2: dropped the `tournament` and `date` indexes. Neither is queried
    // by index (reads use toArray(), deletes use the primary key), so both were
    // pure write overhead — Dexie maintains a B-tree per index on every bulkPut.
    // Removing them cuts IDB write cost proportionally to the number of records.
    dexie.version(1).stores({
      chessGames: "id, tournament, date",
    });
    dexie.version(storageVersion).stores({
      chessGames: "id",
      // To re-add indexes for future query patterns, bump to version 3:
      // chessGames: "id, tournament, date, white, black"
    });

    await dexie.open();
    indexStorage = dexie;
    useIndexStorage = true;

    // ── One-time migration from localStorage ─────────────────────────────────
    // Runs only when the store is empty (fresh install or first upgrade).
    // Clears the localStorage key afterward so the two stores don't diverge.
    if ((await indexStorage.chessGames.count()) === 0) {
      const cachedLsGames = gamesLocalStorage.get([]);
      if (!isEmpty(cachedLsGames)) {
        await indexStorage.chessGames.bulkPut(normalizeGames(cachedLsGames));
        gamesLocalStorage.clear();
        console.info(
          `[ChessRecord] Migration complete: Moved ${cachedLsGames.length} games to IndexedDB.`,
        );
      }
    }
  } catch (err) {
    console.warn(
      "[ChessRecord] IndexedDB unavailable — falling back to localStorage.",
      err,
    );
    useIndexStorage = false;
  }
})();

/* ─── Persistence API ────────────────────────────────────────────────────── */

/**
 * Load games from the active storage backend (IndexedDB or localStorage mirror)
 * and return them normalized and sorted. If `target` is an array, it will be
 * populated in-place to avoid unnecessary allocations.
 *
 * @param {Array} [target=window.games]
 * @returns {Promise<Array>} The normalized games array
 */
async function loadGames(target = window.games ?? (window.games = [])) {
  await dbReady;

  let raw;
  let alreadyNormalized = false;

  if (useIndexStorage) {
    try {
      raw = await indexStorage.chessGames.toArray();
      // saveGames always normalizes before writing to IDB, so records read back
      // here are already valid — skip the full normalizeGames pass and its
      // ~31 K object re-allocations.
      alreadyNormalized = true;
    } catch {
      // IDB read failed mid-session; fall back to the localStorage mirror.
      raw = gamesLocalStorage.get([]);
    }
  } else {
    raw = gamesLocalStorage.get([]);
  }

  const normalized = alreadyNormalized ? raw : normalizeGames(raw);
  sortGames(normalized);

  if (Array.isArray(target)) {
    // Indexed assignment avoids push(...largeArray), which copies all items
    // as function arguments and wastes stack space for nothing.
    target.length = normalized.length;
    for (let i = 0; i < normalized.length; i++) target[i] = normalized[i];
  }

  return target;
}

/**
 * Persists games to both IndexedDB and the localStorage mirror.
 *
 * Behavior:
 *   - saveGames() (no args): full replace — normalises and re-sorts window.games
 *     then atomically clears the IndexedDB store and reinserts every record.
 *   - saveGames(newGames: Array): incremental merge — bulkPut only the supplied
 *     delta records, then sync the localStorage mirror.
 *   - saveGames(null, id: string): delete by id — removes a single record.
 *
 * @param {Object[]|undefined|null} newGames
 *   When an array, treated as a merge delta. When undefined, performs a full replace.
 *   When null and deleteId provided, performs a targeted delete.
 * @param {string} [deleteId] ID of a single record to delete when performing a delete
 * @returns {Promise<void>}
 */
async function saveGames(newGames, deleteId) {
  const isMerge = Array.isArray(newGames);
  const isDelete = !isMerge && deleteId != null;

  // Always stabilize the global state synchronously before any async suspension.
  // This ensures window.games is always clean and ordered for concurrent UI
  // updates, regardless of whether we are replacing, merging, or deleting.
  // window.games is guaranteed to be normalized already.

  // Sorting must be the final synchronous step so it operates on fully
  // normalised data before any UI updates or async operations begin.
  sortGames(window.games);

  await dbReady;

  if (useIndexStorage) {
    try {
      if (isDelete) {
        // Single targeted delete — no clear/reinsert of the full store.
        await indexStorage.chessGames.delete(deleteId);
      } else if (isMerge) {
        // Incremental put of only the new delta records.
        await indexStorage.chessGames.bulkPut(newGames);
      } else {
        // Wrapping clear() + bulkPut() in a single read-write transaction is
        // critical for data safety. Without it, a crash, quota error, or forced
        // browser close between the two awaits would silently empty the store.
        // Dexie commits the transaction only when the callback resolves without
        // throwing; any error rolls back both operations atomically.
        await indexStorage.transaction(
          "rw",
          indexStorage.chessGames,
          async () => {
            await indexStorage.chessGames.clear();
            await indexStorage.chessGames.bulkPut(window.games);
          },
        );
      }
    } catch (err) {
      if (isMerge) {
        // Incremental merge failed (e.g. key conflict after a partial write) —
        // retry as a full replace, which will also disable IDB if it fails again.
        console.warn(
          "[ChessRecord] IndexedDB merge failed — falling back to full save.",
          err,
        );
        return saveGames();
      }
      if (isDelete) {
        // Targeted delete failed — IDB is out of sync with window.games for
        // this session. A full replace re-syncs IDB with the already-spliced
        // window.games, or disables IDB entirely if the store is truly broken.
        console.warn(
          "[ChessRecord] IndexedDB delete failed — falling back to full save.",
          err,
        );
        return saveGames();
      }
      console.warn(
        "[ChessRecord] IndexedDB write failed — falling back to localStorage.",
        err,
      );
      // Disable IDB writes for this session; avoids flooding the console with
      // repeated failures if the store is in a broken state (e.g. quota exceeded).
      useIndexStorage = false;
    }
  }

  // Always write a localStorage mirror so data survives IDB loss,
  // private-browsing quota restrictions, or browser storage resets.
  try {
    gamesLocalStorage.set(window.games);
  } catch (e) {
    console.warn("[ChessRecord] localStorage mirror write failed:", e.name);
  }
}
