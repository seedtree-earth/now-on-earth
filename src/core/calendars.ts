/**
 * Calendars of the world, computed from the sun and moon: each labelled as
 * the tradition it belongs to, none offered as universal.
 *
 * - The Western (tropical) zodiac: the sun's sign, twelve 30° steps of its
 *   ecliptic longitude from the March equinox. A tradition of astrology; it
 *   names where the sun stands, it forecasts nothing.
 * - The Chinese calendar: the year's animal and element (the sexagenary
 *   cycle), turning at Chinese New Year, and the twenty-four solar terms
 *   (jiéqì), 15° steps of the sun's longitude. The solar terms are China's
 *   seasons, of the northern temperate year; elsewhere they are China's, not
 *   the place's.
 *
 * Local and Indigenous seasonal calendars are not here: they come only from
 * their custodians, in partnership, on their terms (see PartneredKnowledge).
 */

import { moonState } from "./moon.js";
import { sunState } from "./sun.js";

// ------------------------------------------------------------ the Western zodiac

export const ZODIAC = [
  { name: "Aries", glyph: "♈" },
  { name: "Taurus", glyph: "♉" },
  { name: "Gemini", glyph: "♊" },
  { name: "Cancer", glyph: "♋" },
  { name: "Leo", glyph: "♌" },
  { name: "Virgo", glyph: "♍" },
  { name: "Libra", glyph: "♎" },
  { name: "Scorpio", glyph: "♏" },
  { name: "Sagittarius", glyph: "♐" },
  { name: "Capricorn", glyph: "♑" },
  { name: "Aquarius", glyph: "♒" },
  { name: "Pisces", glyph: "♓" },
] as const;

export const ZODIAC_TRADITION = "the Western (tropical) zodiac";

/** The sun's sign, and how far through it, in words. */
export function zodiacAt(date: Date): { name: string; glyph: string; words: string } {
  const lambda = sunState(date).eclipticLongitude;
  const sign = ZODIAC[Math.floor(lambda / 30) % 12];
  const through = (lambda % 30) / 30;
  const when = through < 0.15 ? "newly in" : through > 0.85 ? "late in" : "in";
  return { ...sign, words: `the sun ${when} ${sign.name}` };
}

// ------------------------------------------------------------ the Chinese calendar

export const ANIMALS = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"] as const;
const ELEMENTS = ["Wood", "Fire", "Earth", "Metal", "Water"] as const;

/** China's civil day: the calendar is reckoned in UTC+8. */
const CHINA_MS = 8 * 3600_000;
const chinaDay = (d: Date) => {
  const c = new Date(d.getTime() + CHINA_MS);
  return Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate());
};

/** The moments of new moon between two dates, each to within a few minutes. */
export function newMoonsBetween(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const step = 6 * 3600_000;
  const age = (t: number) => moonState(new Date(t)).age;
  for (let t = from.getTime(); t < to.getTime(); t += step) {
    // The age wraps from near 1 to near 0 at each new moon.
    if (age(t) > 0.9 && age(t + step) < 0.1) {
      let lo = t;
      let hi = t + step;
      while (hi - lo > 60_000) {
        const mid = (lo + hi) / 2;
        if (age(mid) > 0.5) lo = mid;
        else hi = mid;
      }
      out.push(new Date((lo + hi) / 2));
    }
  }
  return out;
}

/** The December solstice of a year, to within a minute. */
function decemberSolstice(year: number): Date {
  let lo = Date.UTC(year, 11, 18);
  let hi = Date.UTC(year, 11, 25);
  const gap = (t: number) => ((sunState(new Date(t)).eclipticLongitude - 270 + 540) % 360) - 180;
  while (hi - lo > 60_000) {
    const mid = (lo + hi) / 2;
    if (gap(mid) < 0) lo = mid;
    else hi = mid;
  }
  return new Date((lo + hi) / 2);
}

/**
 * Chinese New Year for a Gregorian year: the day (in China) of the second new
 * moon after the December solstice. This simple rule matches the calendar in
 * almost every year; in the rare years with a leap eleventh or twelfth month
 * it can fall a month early.
 */
export function chineseNewYear(year: number): Date {
  const ws = decemberSolstice(year - 1);
  const moons = newMoonsBetween(ws, new Date(ws.getTime() + 70 * 86400_000)).filter((m) => chinaDay(m) > chinaDay(ws));
  return new Date(chinaDay(moons[1]) - CHINA_MS);
}

/** The year's animal and element for a moment, turning at Chinese New Year. */
export function chineseYear(date: Date): { animal: string; element: string; yin: boolean; words: string } {
  const c = new Date(date.getTime() + CHINA_MS);
  let y = c.getUTCFullYear();
  if (date < chineseNewYear(y)) y -= 1;
  const animal = ANIMALS[(((y - 4) % 12) + 12) % 12];
  const stem = (((y - 4) % 10) + 10) % 10;
  const element = ELEMENTS[Math.floor(stem / 2)];
  return { animal, element, yin: stem % 2 === 1, words: `the Year of the ${element} ${animal}` };
}

/** The twenty-four solar terms, from the spring equinox: [pinyin, English]. */
export const SOLAR_TERMS: ReadonlyArray<readonly [string, string]> = [
  ["Chūnfēn", "the Spring Equinox"],
  ["Qīngmíng", "Pure Brightness"],
  ["Gǔyǔ", "Grain Rain"],
  ["Lìxià", "the Start of Summer"],
  ["Xiǎomǎn", "Grain Buds"],
  ["Mángzhòng", "Grain in Ear"],
  ["Xiàzhì", "the Summer Solstice"],
  ["Xiǎoshǔ", "Minor Heat"],
  ["Dàshǔ", "Major Heat"],
  ["Lìqiū", "the Start of Autumn"],
  ["Chǔshǔ", "the End of Heat"],
  ["Báilù", "White Dew"],
  ["Qiūfēn", "the Autumn Equinox"],
  ["Hánlù", "Cold Dew"],
  ["Shuāngjiàng", "Frost's Descent"],
  ["Lìdōng", "the Start of Winter"],
  ["Xiǎoxuě", "Minor Snow"],
  ["Dàxuě", "Major Snow"],
  ["Dōngzhì", "the Winter Solstice"],
  ["Xiǎohán", "Minor Cold"],
  ["Dàhán", "Major Cold"],
  ["Lìchūn", "the Start of Spring"],
  ["Yǔshuǐ", "Rain Water"],
  ["Jīngzhé", "the Awakening of Insects"],
];

/** The solar term now: its names, in China's calendar. */
export function solarTerm(date: Date): { pinyin: string; english: string; words: string } {
  const lambda = sunState(date).eclipticLongitude;
  const [pinyin, english] = SOLAR_TERMS[Math.floor(lambda / 15) % 24];
  return { pinyin, english, words: `${english} (${pinyin})` };
}

export const CHINESE_TRADITION = "the Chinese calendar";
