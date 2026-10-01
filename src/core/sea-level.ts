/**
 * The sea through deep time: how high it stood, and which lands it joined.
 *
 * The curve is Spratt & Lisiecki's (2016) sea level stack, one value per
 * thousand years back to 798,000 years ago (src/core/data/sea-level.ts,
 * built by scripts/earth/coastlines.mjs). It is a global average: it does not
 * know how each coast has since risen or sunk, and near the present it runs a
 * few metres low (the stack smooths the last rise). Beyond its reach this
 * returns null: further back, the continents themselves have moved.
 */

import { SEA_LEVEL } from "./data/sea-level.js";

/** The oldest age the curve reaches, in years. */
export const SEA_LEVEL_REACH = SEA_LEVEL[SEA_LEVEL.length - 1][0] * 1000;

/** Sea level in metres relative to today (negative: lower), or null beyond the curve. */
export function seaLevelAt(yearsAgo: number): number | null {
  const ka = Math.max(0, yearsAgo) / 1000;
  if (ka > SEA_LEVEL[SEA_LEVEL.length - 1][0]) return null;
  let i = 1;
  while (i < SEA_LEVEL.length - 1 && SEA_LEVEL[i][0] < ka) i++;
  const [a0, s0] = SEA_LEVEL[i - 1];
  const [a1, s1] = SEA_LEVEL[i];
  const t = a1 === a0 ? 0 : (ka - a0) / (a1 - a0);
  return s0 + (s1 - s0) * Math.max(0, Math.min(1, t));
}

/**
 * Lands the low sea joined, each with the depth of the shallow crossing that
 * parts them today (approximate, in metres, as the seabed data shows it).
 */
export const LAND_BRIDGES: Array<{ id: string; depth: number; words: string }> = [
  { id: "sahul", depth: 15, words: "New Guinea joined to Australia" },
  { id: "sundaland", depth: 40, words: "Sumatra, Java and Borneo joined to Asia" },
  { id: "doggerland", depth: 40, words: "Britain joined to Europe" },
  { id: "bass", depth: 50, words: "Tasmania joined to the mainland" },
  { id: "beringia", depth: 50, words: "Asia and America joined across Beringia" },
];

/** The sea and its bridges in words, for a depth in deep time, or null beyond the curve or near now. */
export function seaWords(yearsAgo: number): string | null {
  const level = seaLevelAt(yearsAgo);
  if (level === null) return null;
  const m = Math.round(Math.abs(level) / 5) * 5;
  if (m < 5) return "The sea about as high as today.";
  const sea = level < 0 ? `The sea about ${m} metres lower than today` : `The sea about ${m} metres higher than today`;
  const joined = LAND_BRIDGES.filter((b) => level < -b.depth).map((b) => b.words);
  return joined.length ? `${sea}: ${joined.join("; ")}.` : `${sea}.`;
}
