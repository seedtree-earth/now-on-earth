/**
 * PARKED: the clock's third scale is now History (history.ts). Deep time stays
 * here, unused by the site, until there is good tectonic modelling data to
 * show the moving continents.
 *
 * Deep time: a third depth for the clock, after the day and the year. It
 * scrubs back through thousands, then millions of years on a logarithmic
 * scale, so the last Ice Age and the age of the dinosaurs both have room.
 *
 * Numberless in spirit: the scale is marked with named moments ("the Last
 * Ice Age", "Pangaea"), and years appear only in words for the face and for
 * screen readers ("about 21,000 years ago"), never on the scale itself.
 *
 * The sun and the rings stay live: deep time moves only what the Earth was
 * like (coastlines, continents, the places people made), never the light.
 */

/** The scale runs from now to 10^DEEP_MAX years ago, logarithmic from 10^DEEP_MIN. */
export const DEEP_MIN = 2;
export const DEEP_MAX = 8.6;

/** Years before present for a position on the scale, 0 (now) to 1 (about 400 million years ago). */
export function deepYears(position: number): number {
  const p = Math.max(0, Math.min(1, position));
  return 10 ** (DEEP_MIN + p * (DEEP_MAX - DEEP_MIN)) - 10 ** DEEP_MIN;
}

/** The position on the scale for a number of years before present. */
export function deepPosition(years: number): number {
  const y = Math.max(0, years);
  return Math.max(0, Math.min(1, (Math.log10(y + 10 ** DEEP_MIN) - DEEP_MIN) / (DEEP_MAX - DEEP_MIN)));
}

export type DeepMoment = {
  id: string;
  /** Its name on the scale and in words ("the Last Ice Age"). */
  name: string;
  /** A short label for the scale ("Last Ice Age"). */
  label: string;
  yearsAgo: number;
  /** One plain sentence about it, for the face and the Guide. */
  about: string;
  /** Labelled on the scale; the others are quiet ticks, named on hover. */
  labelled?: boolean;
};

/**
 * The scale is marked by the sky's own cycles rather than by events: the
 * great year of the wobbling axis, the tilt's nod and the orbit's stretch
 * that pace the ice ages, and the galactic year. Lengths are from cycles.ts.
 */
export const DEEP_MOMENTS: DeepMoment[] = [
  { id: "now", name: "now", label: "Now", yearsAgo: 0, about: "The sky as it is: Polaris at the pole.", labelled: true },
  { id: "thuban", name: "Thuban's time at the pole", label: "Thuban", yearsAgo: 4_800, about: "Thuban in the Dragon is the pole star, as the pyramids rise." },
  { id: "half-great-year", name: "half a great year", label: "Half a great year", yearsAgo: 12_886, about: "The axis has wobbled half way round the sky: no bright star marks the pole, Vega is drawing near it, and today's summer stars shine in winter." },
  { id: "great-year", name: "one great year", label: "Great year", yearsAgo: 25_772, about: "One whole turn of the great year: the wobbling axis has carried the pole round the sky and back to Polaris.", labelled: true },
  { id: "tilt", name: "one nod of the tilt", label: "Tilt", yearsAgo: 41_000, about: "One full nod of the Earth's tilt, steeper, shallower and back: the seasons stronger, then gentler." },
  { id: "ice-age-rhythm", name: "one beat of the ice-age rhythm", label: "Ice-age rhythm", yearsAgo: 100_000, about: "The orbit stretches and rounds again, and the great ice sheets come and go with it.", labelled: true },
  { id: "long-orbit", name: "the long orbit rhythm", label: "Long rhythm", yearsAgo: 405_000, about: "The long, steady rhythm of the orbit's stretch, kept for hundreds of millions of years." },
  { id: "half-galactic", name: "half a galactic year", label: "Half a galactic year", yearsAgo: 115_000_000, about: "The sun is half way round the Milky Way from here; dinosaurs walk every continent." },
  { id: "galactic-year", name: "one galactic year", label: "Galactic year", yearsAgo: 230_000_000, about: "One galactic year: the sun's whole journey round the Milky Way. When it last stood here, the continents were gathered as Pangaea.", labelled: true },
];

/** The named moment the scale is at, if it is close to one (within about a tenth, either way). */
export function nearestMoment(years: number): DeepMoment | null {
  if (years < 50) return DEEP_MOMENTS[0];
  let best: DeepMoment | null = null;
  let gap = Infinity;
  for (const m of DEEP_MOMENTS) {
    if (!m.yearsAgo) continue;
    const d = Math.abs(Math.log10(years) - Math.log10(m.yearsAgo));
    if (d < gap) {
      gap = d;
      best = m;
    }
  }
  // Cycles repeat, so a moment holds only close to its own length (within about a tenth).
  return gap < 0.045 ? best : null;
}

const SCALES: Array<[number, string]> = [
  [1_000, "centuries ago"],
  [10_000, "thousands of years ago"],
  [100_000, "tens of thousands of years ago"],
  [1_000_000, "hundreds of thousands of years ago"],
  [10_000_000, "millions of years ago"],
  [100_000_000, "tens of millions of years ago"],
  [Infinity, "hundreds of millions of years ago"],
];

/** "about 21,000 years ago", "about 2.6 million years ago": two figures, never more. */
export function yearsWords(years: number): string {
  if (years < 50) return "now";
  const round = (x: number) => {
    const p = 10 ** (Math.floor(Math.log10(x)) - 1);
    return Math.round(x / p) * p;
  };
  if (years >= 1_000_000) {
    const m = round(years) / 1_000_000;
    return `about ${m.toLocaleString("en-AU", { maximumFractionDigits: 1 })} million years ago`;
  }
  return `about ${round(years).toLocaleString("en-AU")} years ago`;
}

export type DeepWords = {
  /** The moment's name if near one, otherwise the scale in words ("tens of thousands of years ago"). */
  when: string;
  /** The years, for the face and screen readers only. */
  years: string;
  /** The named moment, if near one. */
  moment: DeepMoment | null;
};

export function deepWords(years: number): DeepWords {
  const moment = nearestMoment(years);
  const scale = SCALES.find(([max]) => years < max)?.[1] ?? "long ago";
  return { when: moment ? moment.name : scale, years: yearsWords(years), moment };
}
