/**
 * Plankton's nightly rise: a MODEL of a real daily pattern, not data.
 *
 * Every night, across the world's oceans, vast numbers of zooplankton (and
 * the fish that follow them) rise from the deep to feed near the surface in
 * the safety of the dark, and sink again before dawn: diel vertical migration,
 * perhaps the largest daily movement of life on Earth (Brierley, 2014,
 * Current Biology 24: R1074). There is no clean global dataset of it, so this
 * follows the light alone:
 *
 * - by day, the plankton are down in the deep: nothing shows;
 * - as the sun sinks through the evening twilight, they rise, and the glow
 *   is brightest along that dusk edge where they are arriving;
 * - through the night they stay near the surface, a quieter glow;
 * - through the morning twilight they sink, the glow fading by sunrise.
 *
 * Where the sun never sets (the midnight sun) the rhythm stalls, as it does
 * for real plankton there.
 */

import { OCEAN_MASK } from "./data/ocean-mask.js";
import type { FeatureCollection, Position } from "./rings.js";
import { type LngLat, type SunState, sunSky } from "./sun.js";

let maskBits: Uint8Array | null = null;
function bits(): Uint8Array {
  if (!maskBits) {
    const bin = typeof atob === "function" ? atob(OCEAN_MASK.bits) : Buffer.from(OCEAN_MASK.bits, "base64").toString("binary");
    maskBits = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }
  return maskBits;
}

/** Is this point at sea (Natural Earth land at 1:110m, on a 1° grid)? */
export function isOcean(lat: number, lng: number): boolean {
  const row = Math.min(OCEAN_MASK.height - 1, Math.max(0, Math.floor(90 - lat)));
  const col = ((Math.floor(lng + 180) % 360) + 360) % 360;
  const i = row * OCEAN_MASK.width + col;
  return (bits()[i >> 3] & (1 << (i & 7))) !== 0;
}

export type PlanktonPhase = "deep" | "rising" | "night" | "sinking";

/** Where the plankton are in their daily journey at a place, and how near the surface (0 deep, 1 at the surface). */
export function planktonAt(at: LngLat, sun: SunState): { phase: PlanktonPhase; level: number } {
  const { altitude, hourAngle } = sunSky(at, sun);
  if (altitude >= 0) return { phase: "deep", level: 0 };
  if (altitude <= -12) return { phase: "night", level: 1 };
  const level = -altitude / 12;
  return { phase: hourAngle > 0 ? "rising" : "sinking", level };
}

/** How brightly each part of the journey glows: arrival at dusk brightest, the night quieter, the dawn sinking fading. */
const GLOW: Record<PlanktonPhase, number> = { deep: 0, rising: 1, night: 0.16, sinking: 0.35 };

export type PlanktonFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: Position };
  properties: { w: number; phase: PlanktonPhase };
};

/** The model over the oceans on a grid of `step` degrees, only where plankton are near the surface. */
export function planktonField(sun: SunState, step = 2): FeatureCollection<PlanktonFeature> {
  const features: PlanktonFeature[] = [];
  for (let lat = -80 + step / 2; lat < 80; lat += step) {
    for (let lng = -180 + step / 2; lng < 180; lng += step) {
      if (!isOcean(lat, lng)) continue;
      const { phase, level } = planktonAt({ lng, lat }, sun);
      const w = level * GLOW[phase];
      if (w <= 0.01) continue;
      features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { w, phase } });
    }
  }
  return { type: "FeatureCollection", features };
}

/** The model in words, for someone at `at` (said of the sea, wherever they stand). */
export function planktonWords(at: LngLat, sun: SunState): string {
  const { phase } = planktonAt(at, sun);
  switch (phase) {
    case "rising":
      return "out at sea, plankton are rising toward the surface for the night";
    case "night":
      return "out at sea, plankton are feeding near the surface in the dark";
    case "sinking":
      return "out at sea, plankton are sinking back into the deep before the light";
    default:
      return "out at sea, plankton are resting in the deep, away from the light";
  }
}
