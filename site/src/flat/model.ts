/**
 * The flat model: the common flat Earth depiction, run with the same clock.
 *
 * The Earth is a disc: an azimuthal equidistant map centred on the North Pole,
 * where a place's distance from the centre is its distance from the pole
 * (90° minus its latitude), and Antarctica is the outer rim. Distances here
 * are in degrees of arc, one degree being 111.195 km, so the disc is 360°
 * across.
 *
 * The sun is a spotlight at a fixed height above the disc. Once a day it
 * circles the centre, over the Tropic of Cancer in June and the Tropic of
 * Capricorn in December: seen from above it stands over the same point the
 * real sun is overhead. It lights the disc out to a fixed reach.
 *
 * Every parameter lives here, stated once.
 */

import { type LngLat, type SunState, compassWord, seasonWords, sunState } from "now-on-earth/core";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Kilometres per degree of arc, at the scale of the disc. */
export const KM_PER_DEGREE = 111.195;

/** The sun's height above the disc: the commonly quoted 3,000 miles. */
export const SUN_HEIGHT_KM = 3000 * 1.609344;
export const SUN_HEIGHT = SUN_HEIGHT_KM / KM_PER_DEGREE; // in degrees of arc

/**
 * How far the spotlight reaches, calibrated so the equator gets exactly twelve
 * hours of light at the equinox: the sun then circles on the equator itself
 * (radius 90°), and a point on that circle is lit for a quarter turn either
 * side of it when the chord 2·90·sin(45°) equals the reach.
 */
export const SPOTLIGHT_REACH = 2 * 90 * Math.sin(45 * RAD); // ≈ 127.3°

export type Plan = { x: number; y: number };

/**
 * A place on the disc, in degrees of arc from the centre. Longitude turns
 * about the centre; x points east at longitude 0, y points away from the
 * centre at longitude 0.
 */
export function toPlan(p: LngLat): Plan {
  const r = 90 - p.lat;
  return { x: r * Math.sin(p.lng * RAD), y: -r * Math.cos(p.lng * RAD) };
}

/** The spotlight's point on the disc: over the real subsolar point. */
export const sunPlan = (sun: SunState): Plan => toPlan(sun.subsolar);

const dist = (a: Plan, b: Plan) => Math.hypot(a.x - b.x, a.y - b.y);

export type FlatSky = {
  /** Is the spotlight's light reaching here? */
  lit: boolean;
  /** Ground distance to the point under the sun, degrees of arc. */
  distance: number;
  /** The sun's angle above the flat horizon, degrees: atan(height / distance). */
  elevation: number;
  /** Compass bearing to the sun, clockwise from north (north is toward the centre). */
  azimuth: number;
  /** Degrees of the sun's daily turn from the viewer's meridian: 0 at its nearest, ±180 at its farthest. */
  hourAngle: number;
};

export function flatSky(at: LngLat, sun: SunState): FlatSky {
  const me = toPlan(at);
  const s = sunPlan(sun);
  const d = dist(me, s);
  const dx = s.x - me.x;
  const dy = s.y - me.y;
  // Local north points to the centre; east is the direction of growing longitude.
  const nx = -Math.sin(at.lng * RAD);
  const ny = Math.cos(at.lng * RAD);
  const ex = Math.cos(at.lng * RAD);
  const ey = Math.sin(at.lng * RAD);
  const azimuth = at.lat >= 89.999 ? 180 : (((Math.atan2(dx * ex + dy * ey, dx * nx + dy * ny) * DEG) % 360) + 360) % 360;
  const ha = ((((at.lng - sun.subsolar.lng) % 360) + 540) % 360) - 180;
  return {
    lit: d <= SPOTLIGHT_REACH,
    distance: d,
    elevation: Math.atan2(SUN_HEIGHT, d) * DEG,
    azimuth,
    hourAngle: ha,
  };
}

/**
 * The share of a day the spotlight reaches a latitude, 0 to 1: the viewer
 * circles at radius a, the sun at radius b, lit while their chord is within
 * the reach.
 */
export function flatDayShare(lat: number, declination: number): number {
  const a = 90 - lat;
  const b = 90 - declination;
  if (a < 1e-9 || b < 1e-9) return Math.hypot(a, b) <= SPOTLIGHT_REACH ? 1 : 0;
  const c = (a * a + b * b - SPOTLIGHT_REACH * SPOTLIGHT_REACH) / (2 * a * b);
  if (c <= -1) return 1;
  if (c >= 1) return 0;
  return Math.acos(c) / Math.PI;
}

// ------------------------------------------------------------ words

export type FlatWords = { phase: string; sky: string; season: string; days: string; sentence: string };

function phaseWord(sky: FlatSky, share: number): string {
  const morning = sky.hourAngle < 0;
  const half = share * 180; // hour angle at the edge of the light
  if (!sky.lit) {
    if (Math.abs(sky.hourAngle) >= 165) return "the middle of the night";
    return morning ? "the small hours before the light" : "night";
  }
  const f = half > 0 ? sky.hourAngle / half : 0;
  if (f < -0.93) return "first light";
  if (f > 0.93) return "last light";
  if (f < -0.55) return "early morning";
  if (f < -0.18) return "mid morning";
  if (f <= 0.18) return "around midday";
  if (f <= 0.55) return "early afternoon";
  return "late afternoon";
}

function skyWords(sky: FlatSky): string {
  const dir = compassWord(sky.azimuth);
  const where =
    sky.elevation > 75
      ? "almost straight overhead"
      : sky.elevation < 15
        ? `low to the ${dir}`
        : sky.elevation < 45
          ? `partway up the sky to the ${dir}`
          : `high to the ${dir}`;
  const sun = `the sun is ${where}`;
  return sky.lit ? sun : `${sun}, its light not reaching here`;
}

function dayWords(date: Date, at: LngLat, sun: SunState): string {
  const share = flatDayShare(at.lat, sun.declination);
  if (share >= 0.999) return "the light reaches here all day";
  if (share <= 0.001) return "the light does not reach here today";
  const around = (days: number) => flatDayShare(at.lat, sunState(new Date(date.getTime() + days * 86400000)).declination);
  const prev = around(-1);
  const next = around(1);
  // The model's own turning points, wherever they fall in its year.
  if (prev > share && next > share) return "the shortest day of the year";
  if (prev < share && next < share) return "the longest day of the year";
  if (Math.abs(next - prev) < 1e-7) return "the days stay the same length";
  return next > prev ? "the days are growing longer" : "the days are growing shorter";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The light at a place, in words, as the flat model has it. */
export function describeFlat(date: Date, at: LngLat, sun: SunState = sunState(date)): FlatWords {
  const sky = flatSky(at, sun);
  const share = flatDayShare(at.lat, sun.declination);
  const phase = phaseWord(sky, share);
  const skyText = skyWords(sky);
  const season = seasonWords(date, at);
  const days = dayWords(date, at, sun);
  return {
    phase,
    sky: skyText,
    season,
    days,
    sentence: `${cap(phase)}. ${cap(skyText)}. ${cap(season)}, and ${days}.`,
  };
}
