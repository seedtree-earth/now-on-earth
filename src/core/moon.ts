/**
 * Where the moon is overhead, and how much of it is lit.
 *
 * A low-precision lunar theory: the leading periodic terms of Meeus,
 * "Astronomical Algorithms" ch. 47. Good to a few tenths of a degree, far
 * finer than a dot on a globe, and cheap enough to run every frame.
 */

import { type LngLat, julianCentury, sunState, wrapLng } from "./sun.js";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export type MoonPhase =
  | "new"
  | "waxing crescent"
  | "first quarter"
  | "waxing gibbous"
  | "full"
  | "waning gibbous"
  | "last quarter"
  | "waning crescent";

export type MoonState = {
  /** The sublunar point: the moon is straight overhead here. */
  sublunar: LngLat;
  /** The far side of the Earth from the moon: the second tidal bulge. */
  antisublunar: LngLat;
  /** Share of the disc lit, 0 (new) to 1 (full). */
  illumination: number;
  /** Growing toward full? */
  waxing: boolean;
  /** Angle between moon and sun as seen from Earth, degrees, 0 to 180. */
  elongation: number;
  /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter, cycling. */
  age: number;
  phase: MoonPhase;
};

const norm = (x: number) => ((x % 360) + 360) % 360;

/** Greenwich mean sidereal time, degrees. */
export function gmst(date: Date): number {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545;
  const T = d / 36525;
  return norm(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T);
}

export function moonState(date: Date): MoonState {
  const T = julianCentury(date);
  const Lp = 218.3164477 + 481267.88123421 * T; // mean longitude
  const D = 297.8501921 + 445267.1114034 * T; // mean elongation
  const M = 357.5291092 + 35999.0502909 * T; // sun's mean anomaly
  const Mp = 134.9633964 + 477198.8675055 * T; // moon's mean anomaly
  const F = 93.272095 + 483202.0175233 * T; // argument of latitude
  const s = (x: number) => Math.sin(x * RAD);

  const lambda = norm(
    Lp +
      6.289 * s(Mp) +
      1.274 * s(2 * D - Mp) +
      0.658 * s(2 * D) +
      0.214 * s(2 * Mp) -
      0.186 * s(M) -
      0.114 * s(2 * F) +
      0.059 * s(2 * D - 2 * Mp) +
      0.057 * s(2 * D - M - Mp) +
      0.053 * s(2 * D + Mp) +
      0.046 * s(2 * D - M) -
      0.041 * s(M - Mp) -
      0.035 * s(D) -
      0.031 * s(M + Mp),
  );
  const beta = 5.128 * s(F) + 0.2806 * s(Mp + F) + 0.2777 * s(Mp - F) + 0.1732 * s(2 * D - F);

  // Ecliptic to equatorial.
  const sun = sunState(date);
  const eps = sun.obliquity * RAD;
  const l = lambda * RAD;
  const b = beta * RAD;
  const ra = Math.atan2(Math.sin(l) * Math.cos(eps) - Math.tan(b) * Math.sin(eps), Math.cos(l)) * DEG;
  const dec = Math.asin(Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l)) * DEG;

  const lng = wrapLng(ra - gmst(date));

  // Phase from the angle between moon and sun.
  const dLong = norm(lambda - sun.eclipticLongitude);
  const cosPsi = Math.cos(b) * Math.cos(dLong * RAD);
  const elongation = Math.acos(Math.max(-1, Math.min(1, cosPsi))) * DEG;
  const illumination = (1 - cosPsi) / 2;
  const waxing = dLong < 180;
  const age = dLong / 360;

  return {
    sublunar: { lng, lat: dec },
    antisublunar: { lng: wrapLng(lng + 180), lat: -dec },
    illumination,
    waxing,
    elongation,
    age,
    phase: phaseName(age),
  };
}

/** Eight named phases, each centred on its moment (quarters are ±1/16 of a cycle). */
export function phaseName(age: number): MoonPhase {
  const names: MoonPhase[] = [
    "new",
    "waxing crescent",
    "first quarter",
    "waxing gibbous",
    "full",
    "waning gibbous",
    "last quarter",
    "waning crescent",
  ];
  return names[Math.round(norm(age * 360) / 45) % 8];
}
