// utils.js - General utility functions and Chess logic

console.log(`
  ██████╗██╗  ██╗███████╗███████╗███████╗██████╗ ███████╗ ██████╗ ██████╗ ██████╗ ██████╗
 ██╔════╝██║  ██║██╔════╝██╔════╝██╔════╝██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔══██╗
 ██║     ███████║█████╗  ███████╗███████╗██████╔╝█████╗  ██║     ██║   ██║██████╔╝██║  ██║
 ██║     ██╔══██║██╔══╝  ╚════██║╚════██║██╔══██╗██╔══╝  ██║     ██║   ██║██╔══██╗██║  ██║
 ╚██████╗██║  ██║███████╗███████║███████║██║  ██║███████╗╚██████╗╚██████╔╝██║  ██║██████╔╝
  ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝
`);

const today = new Date().toISOString().split("T")[0];

/* --- Validation & Basic Helpers --- */

const isValidString = (s) => typeof s === "string" && s.length > 0;
const isValidObject = (o) => o !== null && typeof o === "object";
/** True when a value is non-null, non-undefined, and non-empty-string. */
const hasValue = (value) =>
  value !== null && value !== undefined && value !== "";
const isEmpty = (array) => !array || array.length === 0;

const toNumberOr = (value, fallback = 0) => {
  if (!hasValue(value)) return fallback;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : fallback;
};

const signum = (v) => (
  (v = +v),
  isNaN(v) ? "NaN" : (v > 0 ? "+" : "") + (v || 0)
);

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

/* --- String Formatting --- */

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

/* --- Unicode Variant Helpers --- */

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

/* --- Browser Utilities --- */

/* ─── Storage ────────────────────────────────────────────────────────────── */

// Factory producing a uniform get/set/remove interface over any Web Storage
// backend. Defined once — no duplication between localStorage and
// sessionStorage. `name` is used solely for the console warning on set failure.
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

/* --- Download --- */

// Modern browsers click detached anchors without requiring a DOM insertion,
// so appendChild/removeChild are unnecessary.
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

/* --- Loader UI Helpers --- */
function showLoader(target) {
  const el = document.querySelector(target);
  if (!el) return;
  if (typeof el._oldLoaderValue === "undefined") {
    el._oldLoaderValue = el.innerHTML;
  }
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "inline";
  el.innerHTML = "Loading";
}

async function withLoader(target, fn) {
  showLoader(target);
  try {
    return await fn();
  } finally {
    hideLoader(target);
  }
}

/* --- Chess Specific Logic --- */

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

function parseTimeControl(tc) {
  const cleanTC = String(tc).toLowerCase().replace(/\s+/g, "");
  let initialTime, increment;
  if (cleanTC.includes("+")) {
    [initialTime, increment] = cleanTC.split("+").map(Number);
  } else if (cleanTC.includes("|")) {
    [initialTime, increment] = cleanTC.split("|").map(Number);
  } else if (cleanTC.includes("min")) {
    initialTime = Number(cleanTC.replace("min", ""));
    increment = 0;
  } else {
    initialTime = Number(cleanTC);
    increment = 0;
  }
  return { initialTime, increment };
}

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

function getTimeControlCategory(timeControl) {
  try {
    const { initialTime, increment } = parseTimeControl(timeControl);
    return classifyTimeControl(initialTime, increment);
  } catch {
    return "Unknown";
  }
}

const cleanResult = (result) =>
  result.trim().replace(/½/g, "1/2").replace(/\s+/g, "");

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
 */
const normalisePoints = (raw) =>
  isValidString(raw) ? raw.replace(/0?,5/g, "&#189;") : "";

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

function isFideId(query) {
  return /^\d{5,10}$/.test(query.trim());
}

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

const getTagRegex = (() => {
  const cache = new Map();
  return (tag) => {
    if (!cache.has(tag)) cache.set(tag, new RegExp(`\\[${tag}\\s"([^"]*)"\\]`));
    return cache.get(tag);
  };
})();

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
      date: getTag("Date")?.replace(/\./g, "-") || "",
      gameLink: getTag("ChapterURL") || getTag("Site") || "",
    };
  });
}

function expectedScore(myRating, oppRating) {
  return 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
}

function calcChange(myRating, oppRating, result, k = 40) {
  if (oppRating === 0) return "";
  const E = expectedScore(myRating, oppRating);
  return Math.round(k * (result - E) * 10) / 10;
}

/* --- Shared Chess Data Logic --- */

function sortGames(games) {
  if (!Array.isArray(games)) return;

  const tournamentMaxDates = {};
  games.forEach((g) => {
    const d = g.date ? new Date(g.date).getTime() : 0;
    tournamentMaxDates[g.tournament] = Math.max(
      tournamentMaxDates[g.tournament] || 0,
      isNaN(d) ? 0 : d,
    );
  });

  games.sort((a, b) => {
    const dateDiff =
      (tournamentMaxDates[b.tournament] || 0) -
      (tournamentMaxDates[a.tournament] || 0);
    if (dateDiff !== 0) return dateDiff;
    if (a.tournament !== b.tournament)
      return (a.tournament || "").localeCompare(b.tournament || "");
    const roundDiff = (a.round ?? 0) - (b.round ?? 0);
    if (roundDiff !== 0) return roundDiff;
    if (a.board == null && b.board == null) return 0;
    if (a.board == null) return -1;
    if (b.board == null) return 1;
    return a.board - b.board;
  });
}

function normalizeGames(games) {
  if (!Array.isArray(games)) return [];
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
const storageVersion = 1;
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
    dexie.version(storageVersion).stores({
      chessGames: "id, tournament, date",
    });

    await dexie.open();
    indexStorage = dexie;
    useIndexStorage = true;

    if ((await indexStorage.chessGames.count()) === 0) {
      const cachedLsGames = gamesLocalStorage.get([]);
      if (cachedLsGames.length > 0) {
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

let gamesReady = null;

async function loadGames(target = window.games ?? (window.games = [])) {
  if (gamesReady) return gamesReady;

  gamesReady = (async () => {
    await dbReady;

    let raw;
    if (useIndexStorage) {
      try {
        raw = await indexStorage.chessGames.toArray();
      } catch {
        raw = gamesLocalStorage.get([]);
      }
    } else {
      raw = gamesLocalStorage.get([]);
    }

    const normalized = normalizeGames(raw);
    sortGames(normalized);

    if (Array.isArray(target)) {
      target.length = 0;
      target.push(...normalized);
    }

    return target;
  })().catch((err) => {
    // Clear the cached promise so the next call retries rather than
    // returning the same rejected promise indefinitely.
    gamesReady = null;
    throw err;
  });

  return gamesReady;
}

async function saveGames() {
  await dbReady;

  window.games = normalizeGames(window.games);
  sortGames(window.games);

  if (useIndexStorage) {
    try {
      await indexStorage.chessGames.clear();
      await indexStorage.chessGames.bulkPut(window.games);
    } catch (err) {
      console.warn(
        "[ChessRecord] IndexedDB write failed — falling back to localStorage.",
        err,
      );
    }
  }

  // Always keep a localStorage mirror so data survives IndexedDB loss,
  // privacy-mode restrictions, or browser storage resets.
  gamesLocalStorage.set(window.games);
                                                         }
