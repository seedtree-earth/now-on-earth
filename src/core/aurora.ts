/**
 * The aurora: where it may be seen, live from NOAA or as a typical night.
 *
 * Live, the data is NOAA SWPC's OVATION forecast: a 1° grid of values that
 * grow with the chance of seeing aurora. When the clock is moved away from
 * now, there is no forecast to show, so a typical oval stands in, clearly
 * styled as typical: a ring around each geomagnetic pole at about the
 * latitudes of a moderately active night, lowest and brightest toward
 * midnight, highest and faintest toward noon (after Feldstein's ovals).
 *
 * The aurora is only seen in the dark, so every point is weighted by how far
 * the sun is below the horizon there.
 */

import { type Vec3, coefficientsAt, decimalYear, dipoleAxis, toXYZ } from "./magnetic.js";
import { type LngLat, type SunState, sunSky } from "./sun.js";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** [longitude, latitude, value], value on OVATION's scale. */
export type AuroraPoint = [number, number, number];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l) as Vec3;
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** How dark it is for seeing aurora: 0 with the sun up or in bright twilight, 1 once it is 16° below. */
export function darkness(at: LngLat, sun: SunState): number {
  const alt = sunSky(at, sun).altitude;
  return Math.max(0, Math.min(1, (-alt - 6) / 10));
}

/** The oval's shape at an angle ψ from magnetic midnight: centre and half-width in magnetic latitude. */
function ovalAt(psi: number) {
  const c = Math.cos(psi);
  return { centre: 71 - 4.5 * c, width: 3.5 + 1.5 * c, strength: 0.55 + 0.45 * c };
}

/** The magnetic frame for a moment: the geomagnetic axis, and midnight's direction around it. */
function frame(date: Date, sun: SunState) {
  const axis = dipoleAxis(coefficientsAt(decimalYear(date)));
  const s = toXYZ(sun.subsolar.lat, sun.subsolar.lng);
  const sPerp = unit(s.map((x, i) => x - dot(s, axis) * axis[i]) as Vec3);
  const midnight = sPerp.map((x) => -x) as Vec3;
  const side = cross(axis, midnight);
  return { axis, midnight, side };
}

/** A typical night's aurora, as grid points like OVATION's, both hemispheres. */
export function typicalAurora(date: Date, sun: SunState, peak = 14): AuroraPoint[] {
  const { axis, midnight, side } = frame(date, sun);
  const out: AuroraPoint[] = [];
  for (let lat = -89; lat <= 89; lat++) {
    if (Math.abs(lat) < 45) continue;
    for (let lng = -180; lng < 180; lng++) {
      const p = toXYZ(lat, lng);
      const mlatSigned = Math.asin(Math.max(-1, Math.min(1, dot(p, axis)))) * DEG;
      const mlat = Math.abs(mlatSigned);
      if (mlat < 55) continue;
      const psi = Math.atan2(dot(p, side), dot(p, midnight));
      const { centre, width, strength } = ovalAt(psi);
      const v = peak * strength * Math.exp(-(((mlat - centre) / width) ** 2));
      if (v >= 3) out.push([lng, lat, Math.round(v)]);
    }
  }
  return out;
}

/** The typical oval's two edges in each hemisphere, as closed lines of [lng, lat]. */
export function typicalOvalEdges(date: Date, sun: SunState): Array<Array<[number, number]>> {
  const { axis, midnight, side } = frame(date, sun);
  const rings: Array<Array<[number, number]>> = [];
  for (const hemi of [1, -1]) {
    const a = axis.map((x) => x * hemi) as Vec3;
    for (const edge of [-1, 1]) {
      const ring: Array<[number, number]> = [];
      for (let deg = 0; deg <= 360; deg += 4) {
        const psi = deg * RAD;
        const { centre, width } = ovalAt(psi);
        const m = (centre + edge * width) * RAD;
        const p = [0, 1, 2].map(
          (i) => Math.sin(m) * a[i] + Math.cos(m) * (Math.cos(psi) * midnight[i] + Math.sin(psi) * side[i]),
        ) as Vec3;
        ring.push([Math.atan2(p[1], p[0]) * DEG, Math.asin(p[2]) * DEG]);
      }
      rings.push(ring);
    }
  }
  return rings;
}

/** The aurora for someone at `at`, in words; only when it may be seen and it is dark. */
export function auroraWords(at: LngLat, points: AuroraPoint[], sun: SunState): string | undefined {
  const lng = Math.round(at.lng) >= 180 ? -180 : Math.round(at.lng);
  const lat = Math.round(at.lat);
  const cell = points.find((p) => p[0] === lng && p[1] === lat);
  const v = cell?.[2] ?? 0;
  const dark = darkness(at, sun);
  if (dark < 0.5 || v < 5) return undefined;
  return v >= 12 ? "the aurora may be dancing overhead here" : "the aurora may be glowing low in the sky here";
}
