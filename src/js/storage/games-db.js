/**
 * IndexedDB access for the games table, via Dexie.
 *
 * This file owns the database schema history. Every past version must stay declared
 * so Dexie can upgrade databases created by older releases. Never edit an existing
 * `.version()` block: add a new one (with an `.upgrade()` callback if data must change).
 *
 *   v1  chessGames: "id, tournament, date"
 *   v2  chessGames: "id"   the tournament/date indexes were dropped. Nothing queries by
 *                          them (reads use toArray(), deletes use the key), so they only
 *                          cost write time.
 */

export const DB_NAME = "ChessRecord";
const TABLE_NAME = "chessGames";

/**
 * Open (creating or upgrading as needed) the games database.
 *
 * Dexie is imported on demand, so when it cannot be loaded (for example the CDN is
 * unreachable) this rejects and the caller falls back to localStorage.
 *
 * @returns {Promise<GamesDb>}
 */
export async function openGamesDb() {
  const { default: Dexie } = await import("dexie");

  const dexie = new Dexie(DB_NAME);
  dexie.version(1).stores({ [TABLE_NAME]: "id, tournament, date" });
  dexie.version(2).stores({ [TABLE_NAME]: "id" });
  await dexie.open();

  const table = dexie.table(TABLE_NAME);
  return {
    count: () => table.count(),
    getAll: () => table.toArray(),
    putMany: (games) => table.bulkPut(games),
    remove: (id) => table.delete(id),
    /**
     * Clear + reinsert in ONE transaction. Without it, a crash, quota error or closed
     * browser between the two steps would leave the table empty; with it, any failure
     * rolls both back.
     */
    replaceAll: (games) =>
      dexie.transaction("rw", table, async () => {
        await table.clear();
        await table.bulkPut(games);
      }),
  };
}

/**
 * @typedef {Object} GamesDb
 * @property {() => Promise<number>} count
 * @property {() => Promise<import("../domain/game.js").Game[]>} getAll
 * @property {(games: import("../domain/game.js").Game[]) => Promise<unknown>} putMany  Insert or overwrite
 * @property {(id: string) => Promise<void>} remove
 * @property {(games: import("../domain/game.js").Game[]) => Promise<unknown>} replaceAll
 */
