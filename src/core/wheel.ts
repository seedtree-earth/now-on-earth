/**
 * The wheel of the year: eight turning points, worked out from the sun.
 *
 * The solstices and equinoxes are the moments the sun's ecliptic longitude
 * crosses 0°, 90°, 180° and 270°. The cross-quarter days are the true
 * midpoints between them, at 45°, 135°, 225° and 315° (so Beltane falls near
 * 5 May, not on the calendar's 1 May).
 *
 * The names are those of the Celtic/European wheel tradition: one tradition
 * among many, labelled as such, never offered as universal. The wheel turns
 * opposite in each hemisphere: when the north is at Beltane, the south is at
 * Samhain, so every turning carries both names. Local and Indigenous
 * seasonal knowledge belongs beside it only from its custodians, in
 * partnership (see PartneredKnowledge in events.ts); it is never scraped.
 *
 * Numberless: proximity comes in words ("approaching the longest night",
 * "just past the equinox"), never as counts or dates.
 */

import { sunState } from "./sun.js";

export const WHEEL_TRADITION = "the Celtic/European wheel";

export type Hemisphere = "north" | "south";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type TurningKind = "equinox" | "solstice" | "cross-quarter";

export type TurningName = {
  /** The tradition's name ("Beltane"). */
  name: string;
  /** What it marks, in plain words ("the height of spring"). */
  meaning: string;
  /** The season it opens, crowns or closes. */
  season: Season;
};

export type Turning = {
  id: string;
  /** The sun's ecliptic longitude at this turning, 0 at the March equinox. */
  longitude: number;
  kind: TurningKind;
  /** Its name and meaning where the year turns this way, north and south. */
  north: TurningName;
  south: TurningName;
};

const n = (name: string, meaning: string, season: Season): TurningName => ({ name, meaning, season });

/** The eight, in order of the sun's longitude from the March equinox. */
export const TURNINGS: Turning[] = [
  { id: "march-equinox", longitude: 0, kind: "equinox", north: n("Ostara", "the spring equinox, day and night even", "spring"), south: n("Mabon", "the autumn equinox, day and night even", "autumn") },
  { id: "may-cross", longitude: 45, kind: "cross-quarter", north: n("Beltane", "the height of spring, summer near", "summer"), south: n("Samhain", "the turn into the dark half of the year", "winter") },
  { id: "june-solstice", longitude: 90, kind: "solstice", north: n("Litha", "the longest day", "summer"), south: n("Yule", "the longest night", "winter") },
  { id: "august-cross", longitude: 135, kind: "cross-quarter", north: n("Lughnasadh", "the first harvest, summer turning", "autumn"), south: n("Imbolc", "the first stirring of spring", "spring") },
  { id: "september-equinox", longitude: 180, kind: "equinox", north: n("Mabon", "the autumn equinox, day and night even", "autumn"), south: n("Ostara", "the spring equinox, day and night even", "spring") },
  { id: "november-cross", longitude: 225, kind: "cross-quarter", north: n("Samhain", "the turn into the dark half of the year", "winter"), south: n("Beltane", "the height of spring, summer near", "summer") },
  { id: "december-solstice", longitude: 270, kind: "solstice", north: n("Yule", "the longest night", "winter"), south: n("Litha", "the longest day", "summer") },
  { id: "february-cross", longitude: 315, kind: "cross-quarter", north: n("Imbolc", "the first stirring of spring", "spring"), south: n("Lughnasadh", "the first harvest, summer turning", "autumn") },
];

export const hemisphereOf = (lat: number): Hemisphere => (lat < 0 ? "south" : "north");

/** A turning's name for a hemisphere. */
export const turningName = (t: Turning, h: Hemisphere): TurningName => (h === "south" ? t.south : t.north);

/** Signed gap, -180..180, from the sun's ecliptic longitude to a target. */
const gap = (date: Date, target: number) => ((sunState(date).eclipticLongitude - target + 540) % 360) - 180;

/** The eight turnings between two dates, each found to within a minute. */
export function turningsBetween(from: Date, to: Date): Array<{ turning: Turning; date: Date }> {
  const DAY = 86400000;
  const out: Array<{ turning: Turning; date: Date }> = [];
  for (const turning of TURNINGS) {
    for (let t = from.getTime(); t < to.getTime(); t += DAY) {
      const a = gap(new Date(t), turning.longitude);
      const b = gap(new Date(t + DAY), turning.longitude);
      if (a < 0 && b >= 0 && b - a < 10) {
        let lo = t;
        let hi = t + DAY;
        while (hi - lo > 60000) {
          const mid = (lo + hi) / 2;
          if (gap(new Date(mid), turning.longitude) < 0) lo = mid;
          else hi = mid;
        }
        const date = new Date(Math.round((lo + hi) / 2));
        if (date >= from && date <= to) out.push({ turning, date });
      }
    }
  }
  return out.sort((x, y) => x.date.getTime() - y.date.getTime());
}

export type WheelPlace = {
  hemisphere: Hemisphere;
  /** The sun's ecliptic longitude now. */
  longitude: number;
  /** The turning just behind, and the one ahead. */
  last: Turning;
  next: Turning;
  /** 0 at the last turning, 1 at the next. */
  between: number;
  /** The season on this wheel, for this hemisphere (each season is centred on its solstice or equinox). */
  season: Season;
  /** Proximity in words: "approaching Samhain, the turn into the dark half of the year". */
  words: string;
  /** The turning nearest now, and how near ("at", "approaching", "just past"), or null when midway. */
  near: { turning: Turning; how: "at" | "approaching" | "just past" } | null;
};

/** Where a moment sits on the wheel, for someone at `lat`. */
export function wheelAt(date: Date, lat: number): WheelPlace {
  const h = hemisphereOf(lat);
  const longitude = sunState(date).eclipticLongitude;
  const i = Math.floor(longitude / 45) % 8;
  const last = TURNINGS[i];
  const next = TURNINGS[(i + 1) % 8];
  const between = (longitude - last.longitude) / 45;
  // Seasons are centred on the solstices and equinoxes, bounded by the cross-quarters.
  const centre = TURNINGS[(Math.round(longitude / 90) * 2) % 8];
  const season = turningName(centre, h).season;

  // The sun moves about a degree a day: within a degree is "at", within eight "approaching" or "just past".
  const ahead = (next.longitude - longitude + 360) % 360;
  const behind = (longitude - last.longitude + 360) % 360;
  let near: WheelPlace["near"] = null;
  if (behind < 1) near = { turning: last, how: "at" };
  else if (ahead < 1) near = { turning: next, how: "at" };
  else if (ahead <= 8) near = { turning: next, how: "approaching" };
  else if (behind <= 8) near = { turning: last, how: "just past" };

  const say = (t: Turning) => {
    const nm = turningName(t, h);
    return `${nm.name}, ${nm.meaning}`;
  };
  const words = near
    ? `${near.how} ${say(near.turning)}`
    : between < 0.5
      ? `on from ${turningName(last, h).name}, toward ${turningName(next, h).name}`
      : `nearing ${turningName(next, h).name}, ${turningName(next, h).meaning}`;
  return { hemisphere: h, longitude, last, next, between, season, words, near };
}

/** The sun's declination at a turning: where the wheel's marker sits on the sun's lane. */
export function turningDeclination(longitude: number, obliquity = 23.44): number {
  return (Math.asin(Math.sin((obliquity * Math.PI) / 180) * Math.sin((longitude * Math.PI) / 180)) * 180) / Math.PI;
}
