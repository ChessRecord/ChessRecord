/**
 * Typed access to a single localStorage / sessionStorage key.
 * Values are stored as JSON. Reads never throw: a missing or unreadable key yields the
 * fallback, and a value that is not valid JSON is returned as the raw string.
 */

/**
 * @param {Storage} backend
 * @param {string} backendName Used only in the console warning when a write fails
 * @param {string} key
 */
function createEntry(backend, backendName, key) {
  return {
    /** @param {any} [fallback=null] */
    get(fallback = null) {
      try {
        const raw = backend.getItem(key);
        if (raw === null) return fallback;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      } catch {
        return fallback;
      }
    },

    /** @returns {boolean} false when the write failed (for example the quota is exceeded) */
    set(value) {
      try {
        backend.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.warn(`${backendName} set failed:`, error.name);
        return false;
      }
    },

    remove() {
      try {
        backend.removeItem(key);
      } catch {
        // Storage may be unavailable (private mode, blocked cookies); removal is best-effort.
      }
    },
  };
}

/** Entry in `localStorage` (persists across sessions). */
export const localEntry = (key) => createEntry(localStorage, "localStorage", key);

/** Entry in `sessionStorage` (cleared when the tab closes). */
export const sessionEntry = (key) => createEntry(sessionStorage, "sessionStorage", key);
