/**
 * The moon's pull on the oceans, as a shape.
 *
 * The tide-raising force of the moon lifts the sea toward it and on the far
 * side of the Earth, and draws it away along the great circle between. Its
 * height follows the second Legendre polynomial of the angle θ from the
 * sublunar point: P2(cos θ) = (3cos²θ - 1) / 2, which is 1 under the moon and
 * opposite it, 0 at about 54.7°, and -½ on the belt 90° away.
 *
 * The sun adds its own, smaller swell (about 46% of the moon's). In line with
 * the moon (new and full) the two add up to spring tides; at right angles
 * (the quarters) they partly cancel to neap tides.
 *
 * This is the equilibrium tide: an idealised picture of the pull. Real tides
 * lag it by hours and are reshaped by coasts and ocean basins, so the layer
 * and its words speak of the pull, never of the tide at a beach.
 */

import { type LngLat, angularDistance } from "./sun.js";
import type { MoonState } from "./moon.js";
import { type FeatureCollection, type LineCoords, type PolygonCoords, band, cap } from "./rings.js";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** The sun's tide-raising force relative to the moon's. */
export const SOLAR_TIDE_RATIO = 0.46;

/** Relative height of the equilibrium tide, θ degrees from the sublunar point. */
export function tidalPull(theta: number): number {
  const c = Math.cos(theta * RAD);
  return (3 * c * c - 1) / 2;
}

/** The angle from the sublunar point where the pull reaches `level` (0 < level ≤ 1, or -½ ≤ level < 0). */
export function pullRadius(level: number): number {
  return Math.acos(Math.sqrt(Math.max(0, Math.min(1, (2 * level + 1) / 3)))) * DEG;
}

/** Where the pull turns from lifting to drawing away: about 54.7°. */
export const PULL_RIM = pullRadius(0);

/**
 * Spring to neap, 1 to about 0.37: the combined swell of moon and sun,
 * relative to its greatest, from the angle between them.
 */
export function springNeap(moon: MoonState): number {
  const r = SOLAR_TIDE_RATIO;
  const amp = Math.sqrt(1 + r * r + 2 * r * Math.cos(2 * moon.elongation * RAD));
  return amp / (1 + r);
}

export type TideFeature = {
  type: "Feature";
  geometry: { type: "MultiPolygon"; coordinates: PolygonCoords[] } | { type: "MultiLineString"; coordinates: LineCoords[] };
  properties: { kind: "swell" | "ebb" | "rim"; level: number };
};

/**
 * The swells as stacked caps at equal steps of pull, so their stacked
 * opacity follows the true P2 shape; the low-water belt as bands; and the rim
 * where the pull changes sign.
 */
export function tideFeatures(moon: MoonState, steps = 8): FeatureCollection<TideFeature> {
  const features: TideFeature[] = [];
  const centres = [moon.sublunar, moon.antisublunar];

  for (let k = 0; k < steps; k++) {
    const level = (k + 0.5) / steps;
    const r = pullRadius(level);
    const coordinates = centres.flatMap((c) => cap(c, r).polygons);
    features.push({ type: "Feature", geometry: { type: "MultiPolygon", coordinates }, properties: { kind: "swell", level } });
  }

  const ebbSteps = Math.max(2, Math.round(steps / 2));
  for (let k = 0; k < ebbSteps; k++) {
    const level = -0.5 * ((k + 0.5) / ebbSteps);
    const a = pullRadius(level);
    // Points more than `a` from both the sublunar point and its opposite.
    const coordinates = centres.flatMap((c) => band(c, a, 90));
    features.push({ type: "Feature", geometry: { type: "MultiPolygon", coordinates }, properties: { kind: "ebb", level } });
  }

  const rim = centres.flatMap((c) => cap(c, PULL_RIM).edges);
  features.push({ type: "Feature", geometry: { type: "MultiLineString", coordinates: rim }, properties: { kind: "rim", level: 0 } });

  return { type: "FeatureCollection", features };
}

/** The pull where someone stands, in words. Never a tide time or height. */
export function tideWords(at: LngLat, moon: MoonState): string {
  const pull = tidalPull(angularDistance(at, moon.sublunar));
  const where =
    pull > 0.35
      ? "the moon's pull is lifting the seas here"
      : pull < -0.2
        ? "the moon's pull is drawing the seas away from here"
        : "the seas here lie between the moon's two swells";
  const sn = springNeap(moon);
  const when = sn > 0.85 ? "spring tides, with sun and moon in line" : sn < 0.55 ? "neap tides, with sun and moon at right angles" : "";
  return when ? `${where}, in ${when}` : where;
}
