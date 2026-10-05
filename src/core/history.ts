/**
 * History: the human scale of deep time, from now back about 65,000 years,
 * to the earliest dated evidence of people in Sahul (the land that joined
 * Australia, New Guinea and Tasmania). Stretched so the recent centuries have
 * room, and marked by broad human turnings rather than figures. The years are
 * in the words only.
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

export const HISTORY_REACH = 65_000;
/** The stretch: below this many years the scale is close to even; beyond it, compressed. */
const STRETCH = 400;

/** Years ago for a position on the scale, 0 (now) to 1 (people in Sahul). */
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
  { id: "industry", label: "Industry", name: "the industrial age", yearsAgo: 220, about: "Coal and steam: the industrial age begins, and human numbers start to climb steeply." },
  { id: "voyages", label: "Ocean crossings", name: "the ocean crossings", yearsAgo: 530, about: "Ocean voyages join the world's peoples; old worlds in the Americas are broken by new diseases and conquest." },
  { id: "plague", label: "The great plague", name: "the great plague", yearsAgo: 680, about: "Plague crosses Eurasia and North Africa, and whole regions lose a third of their people or more." },
  { id: "classical", label: "Classical empires", name: "the classical empires", yearsAgo: 2_000, about: "Rome and Han China at their height, joined by the Silk Roads; Teotihuacan rising in Mesoamerica.", labelled: true },
  { id: "bronze-collapse", label: "Bronze Age collapse", name: "the Bronze Age collapse", yearsAgo: 3_200, about: "Around the eastern Mediterranean, kingdoms fall together: drought, migration and broken trade." },
  { id: "first-states", label: "First states", name: "the first states", yearsAgo: 5_100, about: "The first states: Egypt united along the Nile, and the city-states of Sumer.", labelled: true },
  { id: "first-cities", label: "First cities", name: "the first cities", yearsAgo: 6_000, about: "The first cities grow on the plains of Mesopotamia." },
  { id: "first-farms", label: "First farms", name: "the first farms", yearsAgo: 11_500, about: "People begin to farm in the Fertile Crescent, and on their own soon after in China, New Guinea, Mesoamerica and the Andes." },
  { id: "cold-snap", label: "The last cold snap", name: "the last cold snap", yearsAgo: 12_800, about: "The Younger Dryas: a sudden return to near-glacial cold as the ice age ends." },
  { id: "ice-age", label: "Last Ice Age", name: "the Last Ice Age", yearsAgo: 21_000, about: "Ice sheets at their greatest and the seas far lower: Sahul is one land, and Asia and America are joined. People may already be walking in the Americas; the earliest dates there are still debated.", labelled: true },
  { id: "europe", label: "People reach Europe", name: "people reaching Europe", yearsAgo: 45_000, about: "People of our own species are spreading into Europe and across northern Asia." },
  { id: "sahul", label: "People in Sahul", name: "people in Sahul", yearsAgo: 65_000, about: "The earliest dated evidence of people in Sahul, the land that joined Australia, New Guinea and Tasmania: the ancestors of Aboriginal and Torres Strait Islander peoples, who have lived here continuously ever since. The earliest dates are still debated; the continuity is not.", labelled: true },
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
  const plain = (n: string) => n.replace(/^\((.*)\)$/, "$1").trim();
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

// ------------------------------------------------------------ first arrivals

/**
 * Roughly when people of our own species first lived in each broad region,
 * in years ago, from widely published archaeological dates. Coarse on
 * purpose: regions, not sites, and the earliest dates are debated (Sahul's
 * at about sixty-five thousand years, the Americas' at about twenty-one
 * thousand). Used only to light the presence glow before HYDE begins.
 */
export type ArrivalRegion = { id: string; name: string; yearsAgo: number };

export const ARRIVALS: ArrivalRegion[] = [
  { id: "africa", name: "Africa", yearsAgo: 300_000 },
  { id: "west-asia", name: "West Asia", yearsAgo: 60_000 },
  { id: "south-asia", name: "South Asia", yearsAgo: 60_000 },
  { id: "sahul", name: "Sahul", yearsAgo: 65_000 },
  { id: "east-asia", name: "East and Southeast Asia", yearsAgo: 50_000 },
  { id: "europe", name: "Europe", yearsAgo: 45_000 },
  { id: "north-asia", name: "northern Asia", yearsAgo: 45_000 },
  { id: "americas", name: "the Americas", yearsAgo: 21_000 },
  { id: "far", name: "the far islands", yearsAgo: 3_500 },
];

/** Which broad region a place belongs to, for first arrivals. */
export function arrivalRegion(lng: number, lat: number): ArrivalRegion {
  const r = (id: string) => ARRIVALS.find((a) => a.id === id)!;
  if (lng < -25 || lng > 170) return lat > -60 && lng < -25 ? r("americas") : r("far");
  if (lat < 0 && lng >= 110 && lng <= 160) return r("sahul");
  if (lat < -11 && lng > 160) return r("far");
  if (lng >= -20 && lng <= 52 && lat < 35 && !(lng > 34 && lat > 12)) return r("africa");
  if (lat >= 35 && lng < 45) return r("europe");
  if (lat >= 50) return r("north-asia");
  if (lng < 60) return r("west-asia");
  if (lng < 95) return r("south-asia");
  return r("east-asia");
}

/** Who lived where, in words, at a time before HYDE's first step. */
export function presenceWords(yearsAgo: number): string {
  const here = ARRIVALS.filter((a) => a.id !== "far" && a.yearsAgo >= yearsAgo).map((a) => a.name);
  const notYet = ARRIVALS.filter((a) => a.id !== "far" && a.yearsAgo < yearsAgo).map((a) => a.name);
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "");
  const lived = `People live across ${list(here)}.`;
  return notYet.length ? `${lived} Not yet reached: ${list(notYet)}.` : lived;
}
