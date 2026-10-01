/**
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

export const DEEP_MOMENTS: DeepMoment[] = [
  { id: "now", name: "now", label: "Now", yearsAgo: 0, about: "The Earth as it is.", labelled: true },
  { id: "pyramids", name: "the age of the pyramids", label: "The pyramids", yearsAgo: 4_500, about: "The Great Pyramid rises at Giza; Stonehenge's great stones go up." },
  { id: "first-farms", name: "the first farms", label: "First farms", yearsAgo: 11_000, about: "People begin to farm, as the ice melts and the seas rise." },
  { id: "ice-age", name: "the Last Ice Age", label: "Last Ice Age", yearsAgo: 21_000, about: "Ice sheets at their greatest; the seas far lower, joining lands now apart.", labelled: true },
  { id: "our-species", name: "the first of our species", label: "Our species", yearsAgo: 300_000, about: "The oldest known people of our own species, in Africa.", labelled: true },
  { id: "ice-ages", name: "the start of the ice ages", label: "Ice ages begin", yearsAgo: 2_600_000, about: "The ice ages begin, the ice coming and going ever since." },
  { id: "asteroid", name: "the asteroid", label: "The asteroid", yearsAgo: 66_000_000, about: "An asteroid strikes, and the age of the dinosaurs ends." },
  { id: "dinosaurs", name: "the age of the dinosaurs", label: "Dinosaurs", yearsAgo: 100_000_000, about: "Dinosaurs walk every continent; flowering plants are new.", labelled: true },
  { id: "pangaea", name: "Pangaea", label: "Pangaea", yearsAgo: 250_000_000, about: "The continents are one, Pangaea, and the first dinosaurs are near.", labelled: true },
];

/** The named moment the scale is at, if it is close to one (within about a third, either way). */
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
  return gap < 0.13 ? best : null;
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
