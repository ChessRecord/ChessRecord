/** Player names, titles and FIDE payloads. */

import { capitalize, toBoldSans } from "../lib/text.js";
import { isNonEmptyString } from "../lib/values.js";

const TITLE_ABBREVIATIONS = Object.freeze({
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

/** "Grandmaster" → "GM". Unknown titles are returned as given; invalid input gives "". */
export function abbreviateTitle(title) {
  if (!isNonEmptyString(title)) return "";
  const key = title.toLowerCase().replace(/\s+/g, "");
  return TITLE_ABBREVIATIONS[key] || title;
}

/** "Carlsen, Magnus" → "Magnus Carlsen". Names without a single ", " are only trimmed. */
export function formatName(name) {
  if (!isNonEmptyString(name)) return "";
  const parts = name.split(", ");
  if (parts.length !== 2) return name.trim();
  const [last, first] = parts;
  return `${first.trim()} ${last.trim()}`.trim();
}

/** Free-text player name → display name ("carlsen, MAGNUS" → "Magnus Carlsen"). */
export const toDisplayName = (rawName) => formatName(capitalize(rawName));

/** FIDE IDs are 5–10 digits. */
export const isFideId = (query) => /^\d{5,10}$/.test(query.trim());

/**
 * Reduce a player record from the FIDE API to the shape the form uses.
 *
 * @param {{ name: string, title?: string, standard?: number, rapid?: number, blitz?: number }} player
 * @returns {{ name: string, title: string, standard: number, rapid: number, blitz: number }}
 */
export function normalizeFidePlayer({ name, title = "", standard = 0, rapid = 0, blitz = 0 }) {
  return { name: toDisplayName(name), title: abbreviateTitle(title), standard, rapid, blitz };
}

/** "𝗚𝗠 Magnus Carlsen": the title in bold sans-serif followed by the name. */
export function formatPlayerLabel(title, name) {
  const trimmedTitle = title?.trim();
  return trimmedTitle ? `${toBoldSans(trimmedTitle)} ${name}` : name;
}
