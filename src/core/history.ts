/**
 * History: the human scale of deep time, from now back 12,800 years to the
 * last cold snap of the ice age (the Younger Dryas). Stretched so the recent
 * centuries have room, and marked by broad human turnings rather than
 * figures. The years are in the words only.
 *
 * The civilisations drawn along it are the states historians have mapped
 * (Cliopatria, Seshat Global History Databank, CC BY 4.0). Many peoples never
 * appear as borders: Aboriginal and Torres Strait Islander nations have lived
 * on this continent continuously for more than sixty thousand years, and the
 * map's silence there is the map's limit, not an emptiness. Their histories
 * belong with their custodians.
 *
 * Further back (deep time, the moving continents) is parked until good
 * tectonic modelling data is to hand: see deep-time.ts and cycles.ts.
 */

export const HISTORY_REACH = 12_800;
/** The stretch: below this many years the scale is close to even; beyond it, compressed. */
const STRETCH = 500;

/** Years ago for a position on the scale, 0 (now) to 1 (the last cold snap). */
export function historyYears(position: number): number {
  const p = Math.max(0, Math.min(1, position));
  return STRETCH * ((1 + HISTORY_REACH / STRETCH) ** p - 1);
}

/** The position on the scale for a number of years ago. */
export function historyPosition(years: number): number {
  const y = Math.max(0, Math.min(HISTORY_REACH, years));
  return Math.log(1 + y / STRETCH) / Math.log(1 + HISTORY_REACH / STRETCH);
}

export type HistoryMoment = { id: string; label: string; name: string; yearsAgo: number; about: string; labelled?: boolean };

/** Broad turnings of the human story, the world over; labelled ones show their names on the scale. */
export const HISTORY_MOMENTS: HistoryMoment[] = [
  { id: "now", label: "Now", name: "now", yearsAgo: 0, about: "The world as it is.", labelled: true },
  { id: "industry", label: "Industry", name: "the industrial age", yearsAgo: 220, about: "Coal and steam: the industrial age begins, and human numbers start to climb steeply.", labelled: true },
  { id: "voyages", label: "Ocean crossings", name: "the ocean crossings", yearsAgo: 530, about: "Ocean voyages join the world's peoples; old worlds in the Americas are broken by new diseases and conquest." },
  { id: "plague", label: "The great plague", name: "the great plague", yearsAgo: 680, about: "Plague crosses Eurasia and North Africa, and whole regions lose a third of their people or more." },
  { id: "classical", label: "Classical empires", name: "the classical empires", yearsAgo: 2_000, about: "Rome and Han China at their height, joined by the Silk Roads; Teotihuacan rising in Mesoamerica.", labelled: true },
  { id: "bronze-collapse", label: "Bronze Age collapse", name: "the Bronze Age collapse", yearsAgo: 3_200, about: "Around the eastern Mediterranean, kingdoms fall together: drought, migration and broken trade." },
  { id: "first-states", label: "First states", name: "the first states", yearsAgo: 5_100, about: "The first states: Egypt united along the Nile, and the city-states of Sumer.", labelled: true },
  { id: "first-cities", label: "First cities", name: "the first cities", yearsAgo: 6_000, about: "The first cities grow on the plains of Mesopotamia." },
  { id: "first-farms", label: "First farms", name: "the first farms", yearsAgo: 11_500, about: "People begin to farm in the Fertile Crescent, and on their own soon after in China, New Guinea, Mesoamerica and the Andes.", labelled: true },
  { id: "cold-snap", label: "The last cold snap", name: "the last cold snap", yearsAgo: 12_800, about: "The Younger Dryas: a sudden return to near-glacial cold as the ice age ends." },
];

/** The named turning the scale is at, if within a tenth of it either way. */
export function historyMoment(years: number): HistoryMoment | null {
  if (years < 15) return HISTORY_MOMENTS[0];
  let best: HistoryMoment | null = null;
  let gap = Infinity;
  for (const m of HISTORY_MOMENTS) {
    if (!m.yearsAgo) continue;
    const d = Math.abs(Math.log(years / m.yearsAgo));
    if (d < gap) {
      gap = d;
      best = m;
    }
  }
  return gap < 0.1 ? best : null;
}

/** The calendar year (CE; negative for BCE) for a number of years ago. */
export const yearOf = (yearsAgo: number, now = new Date()) => Math.round(now.getUTCFullYear() - yearsAgo);

/** The life of a mapped state: when it first appears, when it is widest, when it is gone. */
export type PolityLife = { name: string; born: number; died: number; peak: number; area: number; wiki: string | null };

export type PolityStage = "rising" | "height" | "fading";

/** Where a state is in its life in a given year. */
export function polityStage(p: PolityLife, year: number): PolityStage {
  const span = Math.max(1, p.died - p.born);
  if (Math.abs(year - p.peak) <= Math.max(10, span * 0.08)) return "height";
  return year < p.peak ? "rising" : "fading";
}

export const STAGE_WORDS: Record<PolityStage, string> = {
  rising: "growing",
  height: "near its widest reach",
  fading: "in decline",
};

/** In a given year: the largest states flourishing and those fading, by name, for the words. */
export function civilisationsAt(polities: PolityLife[], year: number, count = 3): { flourishing: string[]; fading: string[] } {
  const alive = polities.filter((p) => p.born <= year && p.died >= year).sort((a, b) => b.area - a.area);
  // Some records name a state in brackets (a looser or contested form of it); the words use the plain name, once.
  const plain = (n: string) => n.replace(/^((.*))$/, "$1").trim();
  const names = (list: PolityLife[]) => [...new Set(list.map((p) => plain(p.name)))].slice(0, count);
  const flourishing = names(alive.filter((p) => polityStage(p, year) !== "fading"));
  const fading = names(alive.filter((p) => polityStage(p, year) === "fading" && p.died - year < (p.died - p.peak) * 0.6)).filter((n) => !flourishing.includes(n));
  return { flourishing, fading };
}

/** Plain words for a year: "about 2,000 years ago", "about 230 years ago". Two figures, never more. */
export function historyYearsWords(years: number): string {
  if (years < 15) return "now";
  const p = 10 ** (Math.floor(Math.log10(years)) - 1);
  return `about ${(Math.round(years / p) * p).toLocaleString("en-AU")} years ago`;
}
