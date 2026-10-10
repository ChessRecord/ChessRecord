/**
 * The single owner of the user's games.
 *
 * It keeps the sorted list in memory for the UI and persists changes to IndexedDB, with
 * a full copy in localStorage as a safety net. If IndexedDB is unavailable, or fails
 * mid-session, everything keeps working from localStorage alone.
 *
 * Every mutating method updates and sorts the in-memory list SYNCHRONOUSLY, then
 * returns a promise for the write. A caller can therefore re-render straight away
 * and await the promise separately.
 */

import { normalizeGames, sortGames } from "../domain/game.js";
import { isEmpty } from "../lib/values.js";
import { openGamesDb } from "./games-db.js";
import { localEntry } from "./web-storage.js";

/** localStorage key holding the mirror (and the pre-IndexedDB legacy data). */
const MIRROR_KEY = "chessGames";

/**
 * @param {Object} [deps] Injectable for tests
 * @param {() => Promise<import("./games-db.js").GamesDb>} [deps.openDb]
 * @param {{ get: Function, set: Function, remove: Function }} [deps.mirror]
 */
export function createGameStore({ openDb = openGamesDb, mirror = localEntry(MIRROR_KEY) } = {}) {
  /** @type {import("../domain/game.js").Game[]} */
  let games = [];
  /** The open database, or null while unavailable (then localStorage is the only copy). */
  let db = null;

  // Starts opening immediately; `load()` and every write wait for it.
  const ready = (async () => {
    try {
      const opened = await openDb();

      // One-time migration of pre-IndexedDB data. Only when the table is empty (fresh
      // install or first upgrade); the key is cleared afterwards so the copies don't diverge.
      if ((await opened.count()) === 0) {
        const legacy = mirror.get([]);
        if (!isEmpty(legacy)) {
          await opened.putMany(normalizeGames(legacy));
          mirror.remove();
          console.info(
            `[ChessRecord] Migration complete: Moved ${legacy.length} games to IndexedDB.`,
          );
        }
      }
      db = opened;
    } catch (error) {
      console.warn("[ChessRecord] IndexedDB unavailable — falling back to localStorage.", error);
      db = null;
    }
  })();

  /**
   * Write the current state out. Modes:
   *   persist()                 full replace of the table
   *   persist({ delta })        incremental put of just the new records
   *   persist({ deleteId })     delete one record
   * An incremental write that fails is retried once as a full replace.
   */
  async function persist({ delta, deleteId } = {}) {
    const isMerge = Array.isArray(delta);
    const isDelete = !isMerge && deleteId != null;

    // Stabilise the order before any await so concurrent renders see a sorted list.
    sortGames(games);
    await ready;

    if (db) {
      try {
        if (isDelete) await db.remove(deleteId);
        else if (isMerge) await db.putMany(delta);
        else await db.replaceAll(games);
      } catch (error) {
        if (isMerge) {
          console.warn("[ChessRecord] IndexedDB merge failed — falling back to full save.", error);
          return persist();
        }
        if (isDelete) {
          console.warn("[ChessRecord] IndexedDB delete failed — falling back to full save.", error);
          return persist();
        }
        console.warn("[ChessRecord] IndexedDB write failed — falling back to localStorage.", error);
        // Stop using IndexedDB for this session instead of failing on every write.
        db = null;
      }
    }

    // Always keep the localStorage mirror current.
    mirror.set(games);
  }

  return {
    /** The live, sorted list. Treat as read-only: change it through the methods below. */
    get games() {
      return games;
    },

    /** Read everything from storage into memory (sorted). Resolves to the list. */
    async load() {
      await ready;

      let raw;
      let alreadyNormalized = false;
      if (db) {
        try {
          raw = await db.getAll();
          // Records are normalised before they are written, so skip re-normalising them.
          alreadyNormalized = true;
        } catch {
          raw = mirror.get([]); // IndexedDB read failed mid-session
        }
      } else {
        raw = mirror.get([]);
      }

      games = alreadyNormalized ? raw : normalizeGames(raw);
      sortGames(games);
      return games;
    },

    findById: (id) => games.find((game) => game.id === id),

    /** Append one game and rewrite storage. */
    add(game) {
      games.push(game);
      return persist();
    },

    /** Append many games, writing only the new records. */
    merge(newGames) {
      games.push(...newGames);
      return persist({ delta: newGames });
    },

    /** Discard the current list and use `newGames` instead. */
    replaceAll(newGames) {
      games = newGames;
      return persist();
    },

    /** Delete one game by id (no-op when it is unknown). */
    remove(id) {
      const index = games.findIndex((game) => game.id === id);
      if (index === -1) return Promise.resolve();
      games.splice(index, 1);
      return persist({ deleteId: id });
    },
  };
}
