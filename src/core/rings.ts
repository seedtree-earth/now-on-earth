/**
 * Rings of light as GeoJSON that Mapbox draws without tearing.
 *
 * A ring is a spherical cap: every point within `radius` degrees of arc of a
 * centre. Drawn naively (walk round the circle, emit a polygon) a cap breaks in
 * two places on a web map: where it crosses the antimeridian the fill streaks
 * the whole way round the world, and when it swallows a pole the ring is not a
 * closed loop in longitude/latitude at all.
 *
 * So each cap's edge is walked evenly around the circle (by bearing from the
 * centre, so points stay dense where the edge bends hard near a pole) with its
 * longitude unwrapped as it goes. Then:
 *
 * - An edge that circles no pole closes on itself. Clip that loop to the
 *   world's strip, and to the strips either side shifted back in, so a cap
 *   across ±180 becomes two ordinary polygons.
 * - An edge that circles a pole gains a full turn of longitude. Cut one turn
 *   out, from -180 exactly to 180 exactly, and close it along the pole.
 *
 * The day and night caps at the terminator therefore walk the same great
 * circle point for point, so no gap or overlap opens between them, even where
 * the terminator passes close to a pole. Every coordinate stays inside
 * [-180, 180] x [-90, 90], with no wrapping left for the renderer to guess at.
 */

import type { LngLat } from "./sun.js";

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

/** The latitude where the Web Mercator world ends: atan(sinh(π)). */
export const MERCATOR_LIMIT = 85.0511287798066;

/**
 * Where caps that hold a pole are closed, a little inside the Mercator edge.
 * Mapbox's globe stretches any fill that touches its top or bottom edge across
 * the whole polar cap, opaque; stopping just short keeps the pole plain.
 */
export const POLE_CLOSE = 84.8;

/** Points around the edge. 1° of bearing reads as a smooth curve on a globe. */
const SAMPLES = 360;

/** Does the cap contain the north or south pole? */
function poles(center: LngLat, radius: number) {
  return {
    north: 90 - center.lat < radius,
    south: 90 + center.lat < radius,
  };
}

/**
 * The cap's edge, walked by bearing from the centre, longitude unwrapped so
 * each step moves less than half a turn. `n + 1` points: the last is the first
 * again, carrying whatever whole turn of longitude the walk gained.
 */
function edgeWalk(center: LngLat, radius: number, n: number): Position[] {
  const p1 = center.lat * RAD;
  const d = radius * RAD;
  const out: Position[] = [];
  let prev = center.lng;
  for (let i = 0; i <= n; i++) {
    const theta = (2 * Math.PI * i) / n;
    const sinLat = Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(theta);
    const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
    let lng =
      center.lng +
      Math.atan2(Math.sin(theta) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(lat)) * DEG;
    // Unwrap against the previous step.
    lng += 360 * Math.round((prev - lng) / 360);
    prev = lng;
    out.push([lng, lat * DEG]);
  }
  return out;
}

/** Clip a polygon ring to lng >= lo and lng <= hi (Sutherland-Hodgman). */
function clipStrip(ring: Position[], lo: number, hi: number): Position[] {
  const clip = (pts: Position[], inside: (p: Position) => boolean, x: number) => {
    const out: Position[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const ia = inside(a);
      const ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) {
        const t = (x - a[0]) / (b[0] - a[0]);
        out.push([x, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  };
  let pts = clip(ring, (p) => p[0] >= lo, lo);
  pts = clip(pts, (p) => p[0] <= hi, hi);
  return pts;
}

/**
 * Split an unwrapped polyline at every ±180 crossing and shift each piece
 * back into [-180, 180]. Crossings get an exact point on the seam.
 */
function splitLine(pts: Position[]): LineCoords[] {
  const strip = (x: number) => Math.floor((x + 180) / 360);
  const shift = (p: Position, k: number): Position => [Math.max(-180, Math.min(180, p[0] - 360 * k)), p[1]];
  const lines: LineCoords[] = [];
  let k = strip(pts[0][0]);
  let line: Position[] = [shift(pts[0], k)];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    let kb = strip(b[0]);
    // A point sitting exactly on a seam belongs to the strip we came from.
    if (kb !== k && b[0] === 360 * Math.max(k, kb) - 180) kb = k;
    while (kb !== k) {
      const dir = kb > k ? 1 : -1;
      const x = 360 * (dir > 0 ? k + 1 : k) - 180;
      const t = (x - a[0]) / (b[0] - a[0]);
      const seam: Position = [x, a[1] + (b[1] - a[1]) * t];
      line.push(shift(seam, k));
      if (line.length > 1) lines.push(line);
      k += dir;
      line = [shift(seam, k)];
    }
    line.push(shift(b, k));
  }
  if (line.length > 1) lines.push(line);
  return lines;
}

/** Build a spherical cap of angular `radius` degrees around `center`. */
export function cap(center: LngLat, radius: number): Cap {
  if (radius <= 0) return { polygons: [], edges: [] };
  const { north, south } = poles(center, radius);
  const turns = north || south ? (north && south ? 0 : 1) : 0;

  // Walk the edge; if a pass skims a pole so closely that one step's
  // longitude becomes ambiguous, walk again more finely.
  let walk = edgeWalk(center, radius, SAMPLES);
  for (let n = SAMPLES * 4; n <= SAMPLES * 64; n *= 4) {
    const gained = Math.round(Math.abs(walk[walk.length - 1][0] - walk[0][0]) / 360);
    if (gained === turns) break;
    walk = edgeWalk(center, radius, n);
  }

  if (turns === 0) {
    // A closed loop: clip it into each strip of the world it touches.
    const loop = walk.slice(0, -1);
    const xs = loop.map((p) => p[0]);
    const polygons: PolygonCoords[] = [];
    const kMin = Math.floor((Math.min(...xs) + 180) / 360);
    const kMax = Math.floor((Math.max(...xs) + 180) / 360);
    for (let k = kMin; k <= kMax; k++) {
      const piece = clipStrip(loop, 360 * k - 180, 360 * k + 180);
      if (piece.length < 3) continue;
      const ring = piece.map(([x, y]): Position => [x - 360 * k, Math.max(-POLE_CLOSE, Math.min(POLE_CLOSE, y))]);
      ring.push(ring[0]);
      polygons.push([ring]);
    }
    return { polygons, edges: splitLine(walk) };
  }

  // One pole inside: the walk gains a full turn. Make it run eastward, lay
  // two turns end to end, and cut exactly one turn from -180 to 180.
  let run = walk;
  if (run[run.length - 1][0] < run[0][0]) run = run.slice().reverse();
  const turn = run[run.length - 1][0] - run[0][0]; // 360
  const twice: Position[] = [...run, ...run.slice(1).map(([x, y]): Position => [x + turn, y])];
  const start = 360 * Math.ceil((twice[0][0] + 180) / 360) - 180; // first seam at or after the walk's start
  const edge: Position[] = [];
  for (let i = 1; i < twice.length; i++) {
    const a = twice[i - 1];
    const b = twice[i];
    for (const seam of [start, start + 360]) {
      if (a[0] < seam && b[0] >= seam) {
        const t = (seam - a[0]) / (b[0] - a[0]);
        edge.push([seam, a[1] + (b[1] - a[1]) * t]);
      }
    }
    if (b[0] > start && b[0] < start + 360) edge.push(b);
  }
  if (twice[0][0] === start) edge.unshift(twice[0]);
  const shiftBy = start + 180;
  const line = edge.map(([x, y]): Position => [x - shiftBy, Math.max(-POLE_CLOSE, Math.min(POLE_CLOSE, y))]);
  // Close short of the pole (see POLE_CLOSE): a vertex at ±90 sits at
  // infinity in Mercator, and one on the Mercator edge makes Mapbox paint the
  // whole polar cap as a solid, unblended disc.
  const poleLat = north ? POLE_CLOSE : -POLE_CLOSE;
  // Close past the pole: east end to the world's edge, back west, to the start.
  const ring: Position[] = [...line, [180, poleLat], [-180, poleLat], line[0]];
  return { polygons: [[ring]], edges: [line] };
}

/** Ray-cast point in a lng/lat ring (valid for our cut, in-range rings). */
function inRing(pt: Position, ring: Position[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * A band between two circles around one centre: every point from `inner` to
 * `outer` degrees of arc away. Both radii must be at most 90 (for bands past
 * a hemisphere, band the opposite point instead: [a, b] from the sun is
 * [180 - b, 180 - a] from the antisolar point).
 *
 * When both circles hold the same pole, both edges run the full width of the
 * world and the band is the strip between them. Otherwise the inner cap's
 * pieces become holes in whichever outer piece holds them.
 */
export function band(center: LngLat, inner: number, outer: number): PolygonCoords[] {
  const out = cap(center, outer);
  if (inner <= 0) return out.polygons;
  const inn = cap(center, inner);
  const po = poles(center, outer);
  const pi = poles(center, inner);
  if ((po.north || po.south) && (pi.north || pi.south)) {
    const a = out.edges[0];
    const b = inn.edges[0];
    return [[[...a, ...b.slice().reverse(), a[0]]]];
  }
  return out.polygons.map((poly) => {
    const holes = inn.polygons
      .map((h) => h[0])
      .filter((h) => {
        const n = h.length - 1;
        const mid: Position = [h.slice(0, n).reduce((s, p) => s + p[0], 0) / n, h.slice(0, n).reduce((s, p) => s + p[1], 0) / n];
        return inRing(mid, poly[0]);
      });
    return [poly[0], ...holes];
  });
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
