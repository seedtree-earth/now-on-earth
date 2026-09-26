/**
 * The face has no numbers, so it has to be speakable. This turns the light at
 * a place into words: the part of the day, where the sun sits in the sky, and
 * the season. It is what a screen reader hears, and what the caption shows.
 *
 * Seasons are the four meteorological seasons, flipped by hemisphere. They are
 * a coarse settler frame and are deliberately the only seasonal language here:
 * local and Indigenous seasonal knowledge belongs to its holders and will come
 * in through the partnered layer, with permission, not be inferred by code.
 */

import { type LngLat, type SunState, dayLengthShare, sunSky, sunState } from "./sun.js";

export type LightWords = {
  /** "late afternoon", "dawn", "the middle of the night" */
  phase: string;
  /** "the sun is low to the west" */
  sky: string;
  /** "early spring" */
  season: string;
  /** "the days are growing longer" / "the sun does not set today" */
  days: string;
  /** Everything as sentences, for screen readers. */
  sentence: string;
  /** A short caption for the face, joined with mid dots. */
  caption: string;
};

const WINDS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

export function compassWord(azimuth: number): string {
  return WINDS[Math.round((((azimuth % 360) + 360) % 360) / 45) % 8];
}

/** Sunrise and sunset are defined by the top of the disc with refraction. */
const HORIZON = -0.833;

export function phaseWord(altitude: number, hourAngle: number, halfDayArc: number): string {
  const morning = hourAngle < 0;
  if (altitude < -18) {
    if (Math.abs(hourAngle) >= 165) return "the middle of the night";
    return morning ? "the small hours before dawn" : "night";
  }
  if (altitude < -6) return morning ? "first light" : "late dusk";
  if (altitude < HORIZON) return morning ? "dawn" : "dusk";
  if (altitude < 2) return morning ? "sunrise" : "sunset";
  if (altitude < 8) return morning ? "early morning, in golden light" : "golden hour";
  const f = halfDayArc > 0 ? hourAngle / halfDayArc : 0;
  if (f < -0.55) return "early morning";
  if (f < -0.18) return "mid morning";
  if (f <= 0.18) return "around midday";
  if (f <= 0.55) return "early afternoon";
  return "late afternoon";
}

export function skyWords(altitude: number, azimuth: number, hourAngle: number): string {
  const dir = compassWord(azimuth);
  if (altitude < -18) return "the sun is far below, on the other side of the Earth";
  if (altitude < HORIZON) {
    return hourAngle < 0
      ? `the sun is just below the horizon, rising in the ${dir}`
      : `the sun has gone down in the ${dir}`;
  }
  if (altitude > 80) return "the sun is almost straight overhead";
  const height = altitude < 15 ? "low" : altitude < 45 ? "partway up the sky" : "high";
  return `the sun is ${height} to the ${dir}`;
}

const SEASONS = ["winter", "spring", "summer", "autumn"] as const;

/**
 * Meteorological season and its third for a place. The month is taken from
 * the place's own solar day, so the season turns at local midnight, not UTC.
 */
export function seasonWords(date: Date, at: LngLat): string {
  const local = new Date(date.getTime() + (at.lng / 15) * 3600000);
  let m = local.getUTCMonth(); // 0 = January
  if (at.lat < 0) m = (m + 6) % 12;
  // Dec, Jan, Feb = winter (north). Shift so December is index 0.
  const idx = (m + 1) % 12;
  const season = SEASONS[Math.floor(idx / 3)];
  const third = ["early", "mid", "late"][idx % 3];
  return `${third} ${season}`;
}

function dayWords(date: Date, at: LngLat, sun: SunState): string {
  const share = dayLengthShare(at.lat, sun.declination);
  if (share >= 0.999) return "the sun does not set today";
  if (share <= 0.001) return "the sun does not rise today";

  // Near a solstice or equinox, say so. Ecliptic longitude: 0 March equinox,
  // 90 June solstice, 180 September equinox, 270 December solstice.
  const L = sun.eclipticLongitude;
  const near = (x: number) => Math.abs(((L - x + 540) % 360) - 180) < 1.2;
  const north = at.lat >= 0;
  if (Math.abs(at.lat) > 2) {
    if (near(90)) return north ? "the longest day of the year" : "the shortest day of the year";
    if (near(270)) return north ? "the shortest day of the year" : "the longest day of the year";
  }
  if (near(0) || near(180)) return "day and night are nearly even";

  const tomorrow = sunState(new Date(date.getTime() + 86400000));
  const next = dayLengthShare(at.lat, tomorrow.declination);
  if (Math.abs(at.lat) < 2) return "day and night stay nearly even here all year";
  return next > share ? "the days are growing longer" : "the days are growing shorter";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function describeLight(date: Date, at: LngLat, sun: SunState = sunState(date)): LightWords {
  const sky = sunSky(at, sun);
  const halfDay = dayLengthShare(at.lat, sun.declination) * 180;
  const phase = phaseWord(sky.altitude, sky.hourAngle, halfDay);
  const skyText = skyWords(sky.altitude, sky.azimuth, sky.hourAngle);
  const season = seasonWords(date, at);
  const days = dayWords(date, at, sun);
  return {
    phase,
    sky: skyText,
    season,
    days,
    sentence: `${cap(phase)}. ${cap(skyText)}. ${cap(season)}, and ${days}.`,
    caption: `${phase} · ${season}`,
  };
}
