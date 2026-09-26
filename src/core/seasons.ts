/**
 * The seasonal lines: where the sun is allowed to walk, where it walks today,
 * and the parallel the viewer lives on, cut into its lit and dark arcs. The lit
 * share of that line IS the viewer's day length, read without a number.
 */

import { type LngLat, type SunState, litHalfArc, wrapLng } from "./sun.js";
import type { FeatureCollection, LineCoords, Position } from "./rings.js";

export type SeasonLineKind = "tropic" | "sun-track" | "me-lit" | "me-dark";

export type SeasonLineFeature = {
  type: "Feature";
  geometry: { type: "MultiLineString"; coordinates: LineCoords[] };
  properties: { kind: SeasonLineKind };
};

export type PointFeature<P> = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: Position };
  properties: P;
};

const STEP = 2;

/** A parallel from lng a to lng b (a < b, unwrapped), cut at ±180. */
export function parallelArc(lat: number, a: number, b: number): LineCoords[] {
  if (b - a >= 360) return [sweep(lat, -180, 180)];
  const lo = wrapLng(a);
  const hi = lo + (b - a);
  if (hi <= 180) return [sweep(lat, lo, hi)];
  return [sweep(lat, lo, 180), sweep(lat, -180, hi - 360)];
}

function sweep(lat: number, a: number, b: number): LineCoords {
  const out: Position[] = [];
  for (let x = a; x < b; x += STEP) out.push([x, lat]);
  out.push([b, lat]);
  return out;
}

export function seasonLines(
  sun: SunState,
  viewer: LngLat,
): FeatureCollection<SeasonLineFeature> {
  const features: SeasonLineFeature[] = [];
  const line = (kind: SeasonLineKind, coordinates: LineCoords[]) => {
    if (coordinates.length) features.push({ type: "Feature", geometry: { type: "MultiLineString", coordinates }, properties: { kind } });
  };

  // The sun's lane: it never stands overhead beyond these two lines.
  line("tropic", [sweep(sun.obliquity, -180, 180), sweep(-sun.obliquity, -180, 180)]);
  // Today's track: the parallel the sun crosses overhead today.
  line("sun-track", [sweep(sun.declination, -180, 180)]);

  // The viewer's parallel, split at the terminator.
  const half = litHalfArc(viewer.lat, sun.declination);
  const noon = sun.subsolar.lng;
  if (half >= 180) {
    line("me-lit", [sweep(viewer.lat, -180, 180)]);
  } else if (half <= 0) {
    line("me-dark", [sweep(viewer.lat, -180, 180)]);
  } else {
    line("me-lit", parallelArc(viewer.lat, noon - half, noon + half));
    line("me-dark", parallelArc(viewer.lat, noon + half, noon + 360 - half));
  }
  return { type: "FeatureCollection", features };
}
