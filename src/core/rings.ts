/**
 * Rings of light as GeoJSON that Mapbox draws without tearing.
 *
 * A ring is a spherical cap: every point within `radius` degrees of arc of a
 * centre. Drawn naively (walk round the circle, emit a polygon) a cap breaks in
 * two places on a web map: where it crosses the antimeridian the fill streaks
 * the whole way round the world, and when it swallows a pole the ring is not a
 * closed loop in longitude/latitude at all.
 *
 * So caps are built by sweeping LONGITUDE instead of walking the circle. At
 * each longitude the cap covers one band of latitude, [low, high], solved in
 * closed form. Then:
 *
 * - A cap that holds no pole spans a finite run of longitudes. Sweep it with
 *   points bunched at the ends (where the edge turns fastest), and cut the run
 *   at ±180 so each piece is an ordinary polygon: the high edge out, the low
 *   edge back.
 * - A cap that holds a pole spans every longitude. Sweep the one free edge from
 *   -180 to 180 and close the polygon along the pole.
 *
 * Every coordinate stays inside [-180, 180] x [-90, 90], with no wrapping for
 * the renderer to guess at.
 */

import { type LngLat, wrapLng } from "./sun.js";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export type Position = [number, number];
export type PolygonCoords = Position[][];
export type LineCoords = Position[];

export type Cap = {
  /** One or more polygons (more than one when cut at the antimeridian). */
  polygons: PolygonCoords[];
  /** The cap's edge as polylines, without the cut or pole seams. */
  edges: LineCoords[];
};

/** Longitude samples for a full sweep. 2° reads as a smooth curve on a globe. */
const FULL_STEP = 2;
/** Samples across a partial sweep (bunched toward its ends). */
const PARTIAL_SAMPLES = 96;

const clampLat = (x: number) => Math.max(-90, Math.min(90, x));

/**
 * The band of latitude covered by the cap at longitude offset `dLng` (degrees
 * from the centre's meridian). Null when the cap does not reach that meridian.
 *
 * A point is inside when cos(distance) >= cos(radius):
 *   sinφ·sinφ0 + cosφ·cosφ0·cos(dLng) >= cos r
 * i.e. R·cos(φ - α) >= cos r with R, α from the left-hand coefficients.
 */
function band(lat0: number, radius: number, dLng: number): [number, number] | null {
  const A = Math.sin(lat0 * RAD);
  const B = Math.cos(lat0 * RAD) * Math.cos(dLng * RAD);
  const C = Math.cos(radius * RAD);
  const R = Math.hypot(A, B);
  if (R === 0) return null;
  const q = C / R;
  if (q > 1) return null;
  const alpha = Math.atan2(A, B) * DEG;
  const beta = Math.acos(Math.max(-1, q)) * DEG;
  let low = alpha - beta;
  let high = alpha + beta;
  // The interval can sit up past a pole (alpha near ±180 on the far side);
  // fold it back into the visible range.
  if (low > 90) return null;
  if (high < -90) return null;
  return [clampLat(low), clampLat(high)];
}

/** Does the cap contain the north or south pole? */
function poles(center: LngLat, radius: number) {
  return {
    north: 90 - center.lat < radius,
    south: 90 + center.lat < radius,
  };
}

/**
 * Longitudinal half-width of a cap that holds no pole: the meridian offset at
 * which its edge turns back. From R = C at the tangent meridian.
 */
function halfSpan(lat0: number, radius: number): number {
  const s = Math.sin(lat0 * RAD);
  const c = Math.cos(lat0 * RAD);
  const C = Math.cos(radius * RAD);
  if (c === 0) return 180;
  const k = (C * C - s * s) / (c * c);
  if (k <= 0) return 90;
  return Math.acos(Math.min(1, Math.sqrt(k))) * DEG;
}

/** Split an ascending run of unwrapped longitudes into runs inside [-180, 180]. */
function cutAtAntimeridian(lngs: number[]): number[][] {
  const lo = lngs[0];
  const hi = lngs[lngs.length - 1];
  const cuts: number[] = [];
  for (let k = Math.ceil((lo + 180) / 360); k * 360 - 180 < hi; k++) {
    const x = k * 360 - 180;
    if (x > lo && x < hi) cuts.push(x);
  }
  if (!cuts.length) return [lngs];
  const runs: number[][] = [];
  let run: number[] = [];
  let ci = 0;
  for (const x of lngs) {
    while (ci < cuts.length && x > cuts[ci]) {
      run.push(cuts[ci]);
      runs.push(run);
      run = [cuts[ci]];
      ci++;
    }
    run.push(x);
  }
  runs.push(run);
  return runs;
}

/** Put an unwrapped run back into [-180, 180], keeping its own seam values. */
function normaliseRun(run: number[]): number[] {
  const mid = (run[0] + run[run.length - 1]) / 2;
  const shift = wrapLng(mid) - mid;
  return run.map((x) => {
    const y = x + shift;
    // Keep the ±180 seam on the side this run lives on.
    return Math.max(-180, Math.min(180, y));
  });
}

/** Build a spherical cap of angular `radius` degrees around `center`. */
export function cap(center: LngLat, radius: number): Cap {
  if (radius <= 0) return { polygons: [], edges: [] };
  const { north, south } = poles(center, radius);

  if (north || south) {
    // Sweep every longitude; one edge is free, the other is the pole.
    const low: Position[] = [];
    const high: Position[] = [];
    for (let lng = -180; lng <= 180 + 1e-9; lng += FULL_STEP) {
      const b = band(center.lat, radius, lng - center.lng);
      if (!b) continue;
      low.push([lng, b[0]]);
      high.push([lng, b[1]]);
    }
    if (north && south) {
      // Only possible past a hemisphere; the free edges are both in play.
      return {
        polygons: [[[...low, ...high.slice().reverse(), low[0]]]],
        edges: [low, high],
      };
    }
    const edge = north ? low : high;
    const poleLat = north ? 90 : -90;
    const ring: Position[] = [...edge, [180, poleLat], [-180, poleLat], edge[0]];
    return { polygons: [[ring]], edges: [edge] };
  }

  // No pole: a finite run of longitudes, bunched toward the turning points.
  const span = halfSpan(center.lat, radius);
  const lngs: number[] = [];
  for (let i = 0; i <= PARTIAL_SAMPLES; i++) {
    const t = -Math.cos((Math.PI * i) / PARTIAL_SAMPLES); // -1 .. 1
    lngs.push(center.lng + span * t);
  }

  const polygons: PolygonCoords[] = [];
  const edges: LineCoords[] = [];
  for (const run of cutAtAntimeridian(lngs)) {
    const high: Position[] = [];
    const low: Position[] = [];
    const out = normaliseRun(run);
    run.forEach((x, i) => {
      const b = band(center.lat, radius, x - center.lng);
      // At the exact turning point rounding can leave the band empty; the
      // edge meets itself there, so collapse onto the centre latitude line.
      const [lo, hi] = b ?? [center.lat, center.lat];
      high.push([out[i], hi]);
      low.push([out[i], lo]);
    });
    if (high.length < 2) continue;
    polygons.push([[...high, ...low.slice().reverse(), high[0]]]);
    edges.push(high, low);
  }
  return { polygons, edges };
}

export type RingKind = "day" | "night";

export type RingFeature = {
  type: "Feature";
  geometry: { type: "MultiPolygon"; coordinates: PolygonCoords[] };
  properties: { kind: RingKind; step: number; radius: number };
};

export type RingEdgeFeature = {
  type: "Feature";
  geometry: { type: "MultiLineString"; coordinates: LineCoords[] };
  properties: { kind: RingKind; step: number; radius: number };
};

export type FeatureCollection<F> = { type: "FeatureCollection"; features: F[] };

/**
 * Nested caps around a centre, every `spacing` degrees out to `limit` (90 for
 * the terminator). Largest first, so stacked translucent fills deepen toward
 * the centre. `step` counts rings from the centre, 1-based.
 */
export function rings(
  center: LngLat,
  kind: RingKind,
  spacing = 15,
  limit = 90,
): { fills: FeatureCollection<RingFeature>; edges: FeatureCollection<RingEdgeFeature> } {
  const fills: RingFeature[] = [];
  const edgeFeatures: RingEdgeFeature[] = [];
  const count = Math.round(limit / spacing);
  for (let step = count; step >= 1; step--) {
    const radius = step * spacing;
    const c = cap(center, radius);
    if (!c.polygons.length) continue;
    const properties = { kind, step, radius };
    fills.push({ type: "Feature", geometry: { type: "MultiPolygon", coordinates: c.polygons }, properties });
    edgeFeatures.push({ type: "Feature", geometry: { type: "MultiLineString", coordinates: c.edges }, properties });
  }
  return {
    fills: { type: "FeatureCollection", features: fills },
    edges: { type: "FeatureCollection", features: edgeFeatures },
  };
}

/**
 * Per-ring opacity so that `count` stacked fills reach `peak` at the centre:
 * 1 - (1 - a)^count = peak. Keeps coarse and fine modes equally deep.
 */
export function stackedOpacity(count: number, peak: number): number {
  return 1 - Math.pow(1 - peak, 1 / Math.max(1, count));
}
