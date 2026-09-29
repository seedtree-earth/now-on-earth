/**
 * Major earthquakes, wildfires and eruptions, placed in time.
 *
 * The feeds are live (see api/hazards.ts): USGS's significant earthquakes of
 * the past month, and GDACS's orange and red alerts for wildfires (past two
 * months) and eruptions (past year). The clock shows each one relative to
 * the moment being viewed: nothing before it happened, then fading with age.
 * These are real events, some with real losses, so the words stay plain and
 * calm, and every one links to its official report.
 */

import type { LngLat } from "./sun.js";

export type Quake = { id: string; lng: number; lat: number; mag: number; depth: number; time: string; place: string; url: string; tsunami: boolean };
export type HazardAlert = { id: string; lng: number; lat: number; level: "Orange" | "Red"; from: string; to: string; name: string; country: string; url: string };
export type Hazards = { quakes: Quake[]; fires: HazardAlert[]; volcanoes: HazardAlert[] };

const DAY = 86400000;

/** How long each kind lingers on the globe after it happens (or ends). */
export const LINGER = { quake: 30 * DAY, fire: 7 * DAY, volcano: 365 * DAY };

/** 1 when fresh, falling to a faint trace at the end of its lingering. */
const fade = (age: number, span: number) => (age < 0 ? 0 : age > span ? 0 : Math.max(0.18, 1 - age / span));

export type Placed<T> = T & { strength: number; ageDays: number };

/** Earthquakes that had happened by `date`, each with a strength fading over a month. */
export function quakesAt(quakes: Quake[], date: Date): Placed<Quake>[] {
  return quakes
    .map((q) => {
      const age = date.getTime() - Date.parse(q.time);
      return { ...q, strength: fade(age, LINGER.quake), ageDays: age / DAY };
    })
    .filter((q) => q.strength > 0);
}

/** Fires burning at `date` (full strength), or fading for a week after they end. */
export function firesAt(fires: HazardAlert[], date: Date): Placed<HazardAlert>[] {
  const t = date.getTime();
  return fires
    .map((f) => {
      const from = Date.parse(f.from);
      const to = Date.parse(f.to);
      const strength = t < from ? 0 : t <= to + DAY ? 1 : fade(t - to - DAY, LINGER.fire);
      return { ...f, strength, ageDays: (t - from) / DAY };
    })
    .filter((f) => f.strength > 0);
}

/** Eruptions that had begun by `date`, fading over a year. */
export function volcanoesAt(volcanoes: HazardAlert[], date: Date): Placed<HazardAlert>[] {
  const t = date.getTime();
  return volcanoes
    .map((v) => {
      const age = t - Date.parse(v.from);
      return { ...v, strength: fade(age, LINGER.volcano), ageDays: age / DAY };
    })
    .filter((v) => v.strength > 0);
}

/** How long ago, in plain words. */
export function agoWords(days: number): string {
  if (days < 1) return "in the last day";
  if (days < 3) return "a day or two ago";
  if (days < 8) return "a few days ago";
  if (days < 21) return "a couple of weeks ago";
  if (days < 60) return "some weeks ago";
  if (days < 180) return "some months ago";
  return "within the last year";
}

/** Magnitude in words, after the USGS classes. */
export function magnitudeWords(mag: number): string {
  if (mag >= 8) return "a great earthquake";
  if (mag >= 7) return "a major earthquake";
  if (mag >= 6) return "a strong earthquake";
  if (mag >= 5) return "a moderate earthquake";
  return "an earthquake";
}

/** USGS places read "49 km NNE of Kainantu, Papua New Guinea"; keep the place, drop the distance. */
export function placeWords(place: string): string {
  const m = place.match(/ of (.+)$/);
  return (m ? m[1] : place).trim();
}

export const quakeWords = (q: Placed<Quake>) =>
  `${magnitudeWords(q.mag)}, magnitude ${q.mag.toFixed(1)}, near ${placeWords(q.place)}, ${agoWords(q.ageDays)}${q.tsunami ? ", with a tsunami alert issued" : ""}`;

export const fireWords = (f: Placed<HazardAlert>) =>
  `${f.name.replace(/^Forest fires/i, "forest fires")}, a GDACS ${f.level.toLowerCase()} alert${f.strength >= 1 ? ", burning at this time" : ", now out"}`;

export const volcanoWords = (v: Placed<HazardAlert>) =>
  `${v.name.replace(/\s+/g, " ").replace(/^Eruption/i, "an eruption of")}, a GDACS ${v.level.toLowerCase()} alert, ${agoWords(v.ageDays)}`;

/** The nearest of a list to a place, within `degrees`. */
export function nearest<T extends LngLat>(list: T[], at: LngLat, degrees: number): T | undefined {
  let best: T | undefined;
  let bestD = degrees;
  for (const x of list) {
    const d = Math.hypot(((x.lng - at.lng + 540) % 360) - 180, x.lat - at.lat);
    if (d < bestD) {
      best = x;
      bestD = d;
    }
  }
  return best;
}
