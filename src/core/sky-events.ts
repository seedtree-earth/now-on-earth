/**
 * Look up: gentle invitations to the sky's own events, near the moment and
 * for the place. Seasonal cadence, not daily noise: only what is near, and
 * only what can be seen from here.
 *
 * - Meteor showers: the major annual showers, each peaking when the sun
 *   reaches a set place on its path (a fact of the meteor stream's orbit, as
 *   the IAU Meteor Data Center and observers record it). Shown where the
 *   radiant rises well above the horizon.
 * - Eclipses: NASA's predictions (Fred Espenak, NASA's GSFC), 2021 to 2040.
 *   A lunar eclipse is offered where the moon is up at its height; a solar
 *   eclipse names the regions that see it.
 * - Meetings of the planets: two bright planets close together in the sky,
 *   computed from JPL's approximate planetary positions (valid 1800 to 2050),
 *   offered when they are clear of the sun's glare.
 *
 * All in words: "in a night or two", "this week", never dates or counts.
 * Watching an eclipse of the sun needs proper eye protection; the words say so.
 */

import { ECLIPSES, type Eclipse, PLANET_ELEMENTS } from "./data/sky.js";
import { moonState } from "./moon.js";
import { type LngLat, skyOf, sunState } from "./sun.js";

const RAD = Math.PI / 180;
const DAY = 86_400_000;

// ------------------------------------------------------------ the planets

type Vec = [number, number, number];

/** Heliocentric ecliptic position (J2000), au, from JPL's approximate elements. */
export function heliocentric(planet: string, date: Date): Vec {
  const el = PLANET_ELEMENTS[planet];
  const T = (date.getTime() / DAY + 2440587.5 - 2451545.0) / 36525;
  const [a, e, I, L, peri, node] = el.base.map((b, i) => b + el.rate[i] * T);
  const omega = peri - node;
  let M = (((L - peri) % 360) + 540) % 360 - 180;
  M *= RAD;
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const w = omega * RAD;
  const O = node * RAD;
  const i = I * RAD;
  const x = (Math.cos(w) * Math.cos(O) - Math.sin(w) * Math.sin(O) * Math.cos(i)) * xp + (-Math.sin(w) * Math.cos(O) - Math.cos(w) * Math.sin(O) * Math.cos(i)) * yp;
  const y = (Math.cos(w) * Math.sin(O) + Math.sin(w) * Math.cos(O) * Math.cos(i)) * xp + (-Math.sin(w) * Math.sin(O) + Math.cos(w) * Math.cos(O) * Math.cos(i)) * yp;
  const z = Math.sin(w) * Math.sin(i) * xp + Math.cos(w) * Math.sin(i) * yp;
  return [x, y, z];
}

const sub = (p: Vec, q: Vec): Vec => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const angle = (p: Vec, q: Vec) => {
  const d = (p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / (Math.hypot(...p) * Math.hypot(...q));
  return Math.acos(Math.max(-1, Math.min(1, d))) / RAD;
};

/** Seen from Earth: a planet's direction (ecliptic J2000), and its angle from the sun. */
export function geocentric(planet: string, date: Date): { v: Vec; elongation: number; east: boolean } {
  const earth = heliocentric("Earth", date);
  const v = sub(heliocentric(planet, date), earth);
  const sun: Vec = [-earth[0], -earth[1], -earth[2]];
  // East of the sun (an evening sky) when the planet's longitude runs ahead of the sun's.
  const lon = (p: Vec) => Math.atan2(p[1], p[0]);
  const east = ((lon(v) - lon(sun) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI > 0;
  return { v, elongation: angle(v, sun), east };
}

const BRIGHT = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

export type Meeting = { a: string; b: string; at: Date; separation: number; evening: boolean };

/** Two bright planets within two degrees of each other, clear of the sun's glare, between two dates. */
export function planetMeetings(from: Date, to: Date): Meeting[] {
  const out: Meeting[] = [];
  for (let i = 0; i < BRIGHT.length; i++) {
    for (let j = i + 1; j < BRIGHT.length; j++) {
      const sep = (t: number) => angle(geocentric(BRIGHT[i], new Date(t)).v, geocentric(BRIGHT[j], new Date(t)).v);
      let prev = sep(from.getTime() - DAY);
      let cur = sep(from.getTime());
      for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
        const next = sep(t + DAY);
        if (cur <= prev && cur <= next && cur < 2) {
          const ga = geocentric(BRIGHT[i], new Date(t));
          const gb = geocentric(BRIGHT[j], new Date(t));
          if (Math.min(ga.elongation, gb.elongation) > 18) out.push({ a: BRIGHT[i], b: BRIGHT[j], at: new Date(t), separation: cur, evening: ga.east });
        }
        prev = cur;
        cur = next;
      }
    }
  }
  return out.sort((x, y) => x.at.getTime() - y.at.getTime());
}

// ------------------------------------------------------------ meteor showers

export type Shower = {
  name: string;
  /** The sun's ecliptic longitude at the peak (J2000), degrees. */
  peak: number;
  /** The radiant's declination, degrees: who can see it. */
  radiantDec: number;
  /** "rich" for the year's best showers, "steady" otherwise. */
  strength: "rich" | "steady";
  /** When to look, in words. */
  when: string;
};

/**
 * The major annual showers: names, the sun's longitude at their peaks and
 * their radiants, as observers and the IAU Meteor Data Center record them.
 * Facts of the meteor streams, given here in our own words.
 */
export const MAJOR_SHOWERS: Shower[] = [
  { name: "the Quadrantids", peak: 283.15, radiantDec: 49, strength: "rich", when: "in the hours before dawn" },
  { name: "the Lyrids", peak: 32.32, radiantDec: 33, strength: "steady", when: "after midnight" },
  { name: "the Eta Aquariids", peak: 45.5, radiantDec: -1, strength: "steady", when: "in the hour or two before dawn" },
  { name: "the Southern Delta Aquariids", peak: 127, radiantDec: -16, strength: "steady", when: "after midnight" },
  { name: "the Perseids", peak: 140.0, radiantDec: 58, strength: "rich", when: "after midnight" },
  { name: "the Orionids", peak: 208, radiantDec: 16, strength: "steady", when: "after midnight" },
  { name: "the Leonids", peak: 235.27, radiantDec: 22, strength: "steady", when: "in the hours before dawn" },
  { name: "the Geminids", peak: 262.2, radiantDec: 33, strength: "rich", when: "from late evening" },
];

/** The moment the sun reaches a longitude, at or after `from`, to within an hour. */
export function sunAt(longitude: number, from: Date): Date {
  const gap = (t: number) => (((sunState(new Date(t)).eclipticLongitude - longitude) % 360) + 360) % 360;
  // Step forward until the sun passes the longitude, then narrow.
  let t = from.getTime();
  while (gap(t) < 359 && gap(t) > 1 && t < from.getTime() + 370 * DAY) t += DAY;
  let lo = t - 2 * DAY;
  let hi = t + 2 * DAY;
  for (let k = 0; k < 20; k++) {
    const mid = (lo + hi) / 2;
    const g = gap(mid);
    if (g > 180) lo = mid;
    else hi = mid;
  }
  return new Date((lo + hi) / 2);
}

/** Can the radiant climb well above the horizon here (at least 20°)? */
const radiantRises = (dec: number, lat: number) => 90 - Math.abs(lat - dec) >= 20;

// ------------------------------------------------------------ invitations

export type LookUp = { kind: "meteors" | "lunar-eclipse" | "solar-eclipse" | "planets"; at: Date; words: string };

/** "tonight", "in a night or two", "this week", "in a week or two", "just past": numberless nearness. */
export function soonWords(at: Date, now: Date): string {
  const d = (at.getTime() - now.getTime()) / DAY;
  if (d < -0.75) return "just past";
  if (d < 0.75) return "tonight";
  if (d < 2.5) return "in a night or two";
  if (d < 7) return "this week";
  return "in a week or two";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What is worth looking up for, near this moment and from this place: at most a few, nearest first. */
export function lookUp(now: Date, at: LngLat, opts: { ahead?: number; eclipses?: Eclipse[] } = {}): LookUp[] {
  const ahead = (opts.ahead ?? 14) * DAY;
  const from = new Date(now.getTime() - 1.5 * DAY);
  const to = new Date(now.getTime() + ahead);
  const out: LookUp[] = [];

  for (const s of MAJOR_SHOWERS) {
    const peak = sunAt(s.peak, new Date(from.getTime() - DAY));
    if (peak < from || peak > to || !radiantRises(s.radiantDec, at.lat)) continue;
    const when = soonWords(peak, now);
    const moon = moonState(peak);
    const moonNote = moon.illumination > 0.6 ? " A bright moon will wash out the fainter ones." : "";
    out.push({
      kind: "meteors",
      at: peak,
      words: `${cap(s.name)} ${when === "just past" ? "have just peaked" : `peak ${when}`}: ${s.strength === "rich" ? "one of the year's richest showers" : "a steady shower"}. Look up ${s.when}, somewhere dark.${moonNote}`,
    });
  }

  for (const e of opts.eclipses ?? ECLIPSES) {
    const t = new Date(e.at);
    if (t < from || t > to) continue;
    const when = soonWords(t, now);
    if (e.kind === "lunar") {
      const moonUp = skyOf(at, moonState(t).sublunar).altitude > 0;
      if (!moonUp) continue;
      const type = e.type === "Total" ? "a total eclipse of the moon, the moon turning a deep red" : e.type === "Partial" ? "a partial eclipse of the moon" : "a faint, penumbral eclipse of the moon";
      out.push({ kind: "lunar-eclipse", at: t, words: `${cap(type)}, ${when}, and the moon will be up here to see it.` });
    } else {
      const type = e.type === "Total" ? "a total eclipse of the sun" : e.type === "Annular" ? "an annular eclipse of the sun, a ring of fire" : e.type === "Hybrid" ? "a hybrid eclipse of the sun" : "a partial eclipse of the sun";
      const path = e.path ? ` (${e.path.replace(/^\w+:\s*/, "the full eclipse over ")})` : "";
      out.push({ kind: "solar-eclipse", at: t, words: `${cap(type)} ${when}, seen from ${e.region}${path}. Never look at the sun without proper eclipse glasses.` });
    }
  }

  for (const m of planetMeetings(from, to)) {
    const when = soonWords(m.at, now);
    out.push({
      kind: "planets",
      at: m.at,
      words: `${m.a} and ${m.b} meet in the sky ${when}, close together ${m.evening ? "in the west after sunset" : "in the east before dawn"}.`,
    });
  }

  return out.sort((x, y) => Math.abs(x.at.getTime() - now.getTime()) - Math.abs(y.at.getTime() - now.getTime())).slice(0, 3);
}

export { ECLIPSES };
export type { Eclipse };
