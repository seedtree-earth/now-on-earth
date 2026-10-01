/**
 * Migrations as flows: a corridor and a season, not points.
 *
 * From an event's monthly grid of sightings (built at build time, see
 * scripts/ecology/) this derives:
 *
 * - the corridor: the line the animals follow, as the weighted middle of the
 *   sightings in each band of latitude (or longitude), smoothed;
 * - the season: how strong the flow is each month (the square root of that
 *   month's sightings against the busiest, so quiet months stay faint);
 * - the direction each month: which way the middle of the sightings is
 *   moving along the corridor, from the months either side. Where it barely
 *   moves, the flow mills, as the animals do on their grounds.
 *
 * Particles are then placed along the corridor for any moment, streaming in
 * that direction, thick in season and gone out of it. No individual sighting
 * is drawn.
 */

import type { Position } from "./rings.js";
import { type SeasonalEvent, monthBlend } from "./events.js";
import { type LngLat, angularDistance } from "./sun.js";

export type FlowMonth = {
  /** 0..1: how strong the flow is this month. */
  intensity: number;
  /** -1..1: along the corridor (+, from its first point to its last) or back (−); near 0, milling. */
  direction: number;
};

export type MigrationFlow = {
  id: string;
  /** The corridor, first point to last. */
  corridor: Position[];
  /** Twelve months, January first. */
  months: FlowMonth[];
  /** Words for travelling toward each end, first then last (e.g. "heading south", "heading north"). */
  ends: [string, string];
  /** A name for this stretch, if it is one leg of a flyway ("New Zealand to the Yellow Sea"). */
  name?: string;
};

const toRad = Math.PI / 180;

/** Distance along the corridor at each vertex, in degrees of arc. */
function lengths(line: Position[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i++) {
    out.push(out[i - 1] + angularDistance({ lng: line[i - 1][0], lat: line[i - 1][1] }, { lng: line[i][0], lat: line[i][1] }));
  }
  return out;
}

/**
 * The corridor and its season from a gridded event. `axis` is the direction
 * the migration runs: "lat" for a coast running north–south.
 */
export function deriveFlow(event: SeasonalEvent, opts: { axis?: "lat" | "lng"; bin?: number; smooth?: number; trim?: number } = {}): MigrationFlow {
  const axis = opts.axis ?? "lat";
  const bin = opts.bin ?? 1;
  const smooth = opts.smooth ?? 2;
  const along = (c: number[]) => (axis === "lat" ? c[1] : c[0]);
  const across = (c: number[]) => (axis === "lat" ? c[0] : c[1]);

  // The corridor: the weighted middle of all the year's sightings, band by band.
  const bands = new Map<number, { w: number; a: number }>();
  for (const m of event.months) {
    for (const c of m.cells) {
      const k = Math.floor(along(c) / bin);
      const b = bands.get(k) ?? { w: 0, a: 0 };
      b.w += c[2];
      b.a += c[2] * across(c);
      bands.set(k, b);
    }
  }
  // Trim the stray ends: keep the bands holding the middle 98% of the sightings.
  const sorted = [...bands.keys()].sort((x, y) => x - y);
  const total = sorted.reduce((t, k) => t + bands.get(k)!.w, 0);
  let lo = 0;
  let hi = sorted.length - 1;
  for (let acc = 0; lo < hi && (acc += bands.get(sorted[lo])!.w) < (opts.trim ?? 0.01) * total; ) lo++;
  for (let acc = 0; hi > lo && (acc += bands.get(sorted[hi])!.w) < (opts.trim ?? 0.01) * total; ) hi--;
  const keys = sorted.slice(lo, hi + 1);
  const raw = keys.map((k) => ({ along: (k + 0.5) * bin, across: bands.get(k)!.a / bands.get(k)!.w }));
  const corridor: Position[] = raw.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - smooth); j <= Math.min(raw.length - 1, i + smooth); j++) {
      sum += raw[j].across;
      n++;
    }
    const x = sum / n;
    return axis === "lat" ? [x, p.along] : [p.along, x];
  });

  // The season: each month's sightings, and where their middle sits along the corridor.
  const counts = event.months.map((m) => m.cells.reduce((s, c) => s + c[2], 0));
  const peak = Math.max(1, ...counts);
  const middle = event.months.map((m, i) => (counts[i] ? m.cells.reduce((s, c) => s + c[2] * along(c), 0) / counts[i] : NaN));
  const span = Math.max(1, Math.abs(along(corridor[corridor.length - 1]) - along(corridor[0])));
  const months: FlowMonth[] = counts.map((n, i) => {
    const prev = (i + 11) % 12;
    const next = (i + 1) % 12;
    // A quiet neighbour says little; lean on the busier side.
    const weak = (k: number) => counts[k] < 0.1 * Math.max(counts[prev], counts[next]);
    let slope: number;
    if (weak(prev) && !weak(next)) slope = middle[next] - middle[i];
    else if (weak(next) && !weak(prev)) slope = middle[i] - middle[prev];
    else slope = (middle[next] - middle[prev]) / 2;
    if (!Number.isFinite(slope)) slope = 0;
    // A move of a tenth of the corridor in a month is a full stream.
    const direction = Math.max(-1, Math.min(1, slope / (0.1 * span)));
    return { intensity: Math.sqrt(n / peak), direction: Math.round(direction * 100) / 100 };
  });
  const ends: [string, string] = axis === "lat" ? ["heading south", "heading north"] : ["heading west", "heading east"];
  return { id: event.id, corridor, months, ends };
}

/** The flow for a moment, blended between the two nearest months. */
export function flowAt(flow: MigrationFlow, date: Date, at?: LngLat): FlowMonth {
  const { from, to, t } = monthBlend(date, at ?? { lng: flow.corridor[0][0], lat: flow.corridor[0][1] });
  const a = flow.months[from - 1];
  const b = flow.months[to - 1];
  return { intensity: a.intensity + (b.intensity - a.intensity) * t, direction: a.direction + (b.direction - a.direction) * t };
}

/** A point at fraction `f` (0..1) of the way along a line. */
export function pointAlong(line: Position[], f: number, lens = lengths(line)): Position {
  const total = lens[lens.length - 1];
  const d = Math.max(0, Math.min(1, f)) * total;
  let i = 1;
  while (i < lens.length - 1 && lens[i] < d) i++;
  const seg = lens[i] - lens[i - 1] || 1;
  const t = (d - lens[i - 1]) / seg;
  const [x0, y0] = line[i - 1];
  const [x1, y1] = line[i];
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}

/** A steady pseudo-random number for particle `i`, so particles keep their lanes. */
const lane = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export type FlowParticle = { type: "Feature"; geometry: { type: "Point"; coordinates: Position }; properties: { a: number } };

/**
 * Particles along the corridor for a moment. `seconds` is wall-clock time,
 * which sets the stream moving; `date` sets the season. Each particle keeps
 * its own lane across the corridor and fades in and out at the ends.
 */
export function flowParticles(
  flow: MigrationFlow,
  date: Date,
  seconds: number,
  opts: { count?: number; width?: number; speed?: number } = {},
): { type: "FeatureCollection"; features: FlowParticle[] } {
  const { intensity, direction } = flowAt(flow, date);
  const lens = lengths(flow.corridor);
  const count = Math.round((opts.count ?? 90) * intensity);
  const width = (opts.width ?? 0.6) * (0.4 + 0.6 * intensity);
  // Corridor lengths per second: a slow, steady stream, slower still when milling.
  const speed = (opts.speed ?? 0.018) * direction;
  const mill = 1 - Math.min(1, Math.abs(direction));
  const features: FlowParticle[] = [];
  for (let i = 0; i < count; i++) {
    const base = lane(i, 1);
    const drift = mill * 0.03 * Math.sin(seconds * 0.4 + i);
    const f = (((base + seconds * speed * (0.7 + 0.6 * lane(i, 2)) + drift) % 1) + 1) % 1;
    const [x, y] = pointAlong(flow.corridor, f, lens);
    // Across the corridor: perpendicular offset in its own lane.
    const [ax, ay] = pointAlong(flow.corridor, Math.max(0, f - 0.01), lens);
    const [bx, by] = pointAlong(flow.corridor, Math.min(1, f + 0.01), lens);
    const dx = (bx - ax) * Math.cos(y * toRad);
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const off = (lane(i, 3) - 0.5) * 2 * width;
    const px = x + ((-dy / len) * off) / Math.max(0.2, Math.cos(y * toRad));
    const py = y + (dx / len) * off;
    // Fade at the ends, so the stream arrives and leaves rather than popping.
    const edge = Math.min(1, f / 0.08, (1 - f) / 0.08);
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [px, py] }, properties: { a: edge * (0.35 + 0.65 * intensity) } });
  }
  return { type: "FeatureCollection", features };
}

/** How far a place is from the corridor, in degrees of arc. */
export function corridorDistance(flow: MigrationFlow, at: LngLat): number {
  let best = Infinity;
  const line = flow.corridor;
  for (let i = 0; i < 200; i++) {
    const [x, y] = pointAlong(line, i / 199);
    best = Math.min(best, angularDistance(at, { lng: x, lat: y }));
  }
  return best;
}

/** Which way the flow runs now, in words: "streaming north", "milling", or null out of season. */
export function flowWords(flow: MigrationFlow, date: Date): string | null {
  const { intensity, direction } = flowAt(flow, date);
  if (intensity < 0.12) return null;
  const strength = intensity > 0.7 ? "in full flow" : intensity > 0.35 ? "flowing" : "a thin stream";
  if (Math.abs(direction) < 0.25) return `${strength}, milling about`;
  return `${strength}, ${direction > 0 ? flow.ends[1] : flow.ends[0]}`;
}

// ------------------------------------------------------------ flyways

const inBox = ([lng, lat]: number[], [w, s, e, n]: [number, number, number, number]) =>
  lat >= s && lat <= n && (w <= e ? lng >= w && lng <= e : lng >= w || lng <= e);

/** The great circle from a to b, as a line whose longitudes run on without a jump at 180°. */
export function greatCircle(a: Position, b: Position, steps = 64): Position[] {
  const v = ([lng, lat]: Position) => [Math.cos(lat * toRad) * Math.cos(lng * toRad), Math.cos(lat * toRad) * Math.sin(lng * toRad), Math.sin(lat * toRad)];
  const p = v(a);
  const q = v(b);
  const omega = Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  const out: Position[] = [];
  let prev = a[0];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k1 = omega ? Math.sin((1 - t) * omega) / Math.sin(omega) : 1 - t;
    const k2 = omega ? Math.sin(t * omega) / Math.sin(omega) : t;
    const x = k1 * p[0] + k2 * q[0];
    const y = k1 * p[1] + k2 * q[1];
    const z = k1 * p[2] + k2 * q[2];
    let lng = Math.atan2(y, x) / toRad;
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    prev = lng;
    out.push([lng, Math.atan2(z, Math.hypot(x, y)) / toRad]);
  }
  return out;
}

/**
 * A flyway: legs between named stopovers, each its own flow. The route of a
 * leg is the great circle between the weighted middle of each stopover's
 * sightings: where the birds are seen, joined, not a tracked path. A leg's
 * season is when its first stopover empties while its second fills, month to
 * month, scaled so each leg peaks at one in its own season; faint echoes
 * (under a quarter of the peak) are left out.
 */
export function deriveFlyway(event: SeasonalEvent): MigrationFlow[] {
  const fw = event.flyway;
  if (!fw) return [];
  const stops = new Map(
    fw.stops.map((st) => {
      const counts = event.months.map((m) => m.cells.filter((c) => inBox(c, st.bbox)).reduce((t, c) => t + c[2], 0));
      const peak = Math.max(1, ...counts);
      const wraps = st.bbox[0] > st.bbox[2];
      let w = 0;
      let x = 0;
      let y = 0;
      for (const m of event.months) {
        for (const c of m.cells) {
          if (!inBox(c, st.bbox)) continue;
          // A stop astride 180° averages its longitudes on one side of it.
          const lng = wraps && c[0] < 0 ? c[0] + 360 : c[0];
          w += c[2];
          x += c[2] * lng;
          y += c[2] * c[1];
        }
      }
      const mid: Position = w
        ? [((((x / w + 180) % 360) + 360) % 360) - 180, y / w]
        : [(st.bbox[0] + st.bbox[2]) / 2, (st.bbox[1] + st.bbox[3]) / 2];
      return [st.id, { ...st, occupancy: counts.map((n) => n / peak), mid }] as const;
    }),
  );
  return fw.legs.map(([from, to]) => {
    const a = stops.get(from)!;
    const b = stops.get(to)!;
    const raw = a.occupancy.map((v, m) => {
      const n = (m + 1) % 12;
      return Math.min(Math.max(0, v - a.occupancy[n]), Math.max(0, b.occupancy[n] - b.occupancy[m]));
    });
    const peak = Math.max(...raw) || 1;
    const months: FlowMonth[] = raw.map((v) => {
      const i = v / peak;
      return i < 0.25 ? { intensity: 0, direction: 0 } : { intensity: Math.round(i * 100) / 100, direction: 1 };
    });
    return {
      id: `${event.id}-${from}-${to}`,
      name: `${a.name} to ${b.name}`,
      corridor: greatCircle(a.mid, b.mid),
      months,
      ends: [`heading back to ${a.name}`, `heading for ${b.name}`] as [string, string],
    };
  });
}
