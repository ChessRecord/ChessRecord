/** Time-control parsing and classification ("90+30", "3|2", "15", "90min"). */

/**
 * Parse a time control into initial time (minutes) and increment (seconds).
 *
 * @param {string | number} timeControl
 * @returns {{ initialTime: number, increment: number }}
 */
export function parseTimeControl(timeControl) {
  const cleaned = String(timeControl).toLowerCase().replace(/\s+/g, "");
  const separator = cleaned.includes("+") ? "+" : cleaned.includes("|") ? "|" : null;
  if (separator) {
    const [initialTime, increment] = cleaned.split(separator).map(Number);
    return { initialTime, increment };
  }
  // Handles both "90min" and plain numeric strings ("90").
  return { initialTime: Number(cleaned.replace("min", "")), increment: 0 };
}

/**
 * Classify by FIDE-style estimated duration (initial time + 40 moves of increment).
 *
 * @param {number} initial Initial time in minutes
 * @param {number} increment Increment in seconds
 * @returns {"Bullet" | "Blitz" | "Rapid" | "Classical" | "Unknown"}
 */
export function classifyTimeControl(initial, increment) {
  if (![initial, increment].every((n) => Number.isFinite(n) && n >= 0)) return "Unknown";
  const initialSeconds = initial * 60;
  const estimatedMinutes = (initialSeconds + increment * 40) / 60;
  if (initial < 3 && estimatedMinutes < 7) return "Bullet";
  if (initial < 10 && estimatedMinutes < 25) return "Blitz";
  if (initial < 30 && estimatedMinutes < 60) return "Rapid";
  return "Classical";
}

/**
 * @param {string | number} timeControl
 * @returns {"Bullet" | "Blitz" | "Rapid" | "Classical" | "Unknown"}
 */
export function getTimeControlCategory(timeControl) {
  const { initialTime, increment } = parseTimeControl(timeControl);
  return classifyTimeControl(initialTime, increment);
}
