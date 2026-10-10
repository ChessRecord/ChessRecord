/**
 * Small value predicates and coercions with no dependencies.
 * Everything here is deliberately forgiving: it is used on user-supplied files
 * and third-party API payloads, so it never throws on unexpected types.
 */

/** True for any falsy value and for anything whose `length` is 0 ("", [], FileList, …). */
export const isEmpty = (value) => !value || value.length === 0;

export const isNonEmptyString = (value) => typeof value === "string" && !isEmpty(value);

export const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;

/** True unless the value is `null`, `undefined` or an empty string (so `0` and `false` count). */
export const hasValue = (value) => value !== null && value !== undefined && value !== "";

/**
 * Coerce to a finite number, or return `fallback` for blank / non-numeric input.
 * @param {unknown} value
 * @param {number | null} [fallback=0]
 */
export const toNumberOr = (value, fallback = 0) => {
  if (!hasValue(value)) return fallback;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : fallback;
};
