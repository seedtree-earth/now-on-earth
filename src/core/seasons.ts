/**
 * The seasonal lines: where the sun is allowed to walk, where it walks today,
 * and the parallel the viewer lives on, cut into its lit and dark arcs. The lit
 * share of that line IS the viewer's day length, read without a number.
 */

import { type LngLat, type SunState, litHalfArc, sunState, wrapLng } from "./sun.js";
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

// ------------------------------------------------------------ year marks

export type SeasonMarkKind = "march-equinox" | "june-solstice" | "september-equinox" | "december-solstice";

export type SeasonMark = {
  kind: SeasonMarkKind;
  date: Date;
};

const MARKS: Array<{ kind: SeasonMarkKind; longitude: number }> = [
  { kind: "march-equinox", longitude: 0 },
  { kind: "june-solstice", longitude: 90 },
  { kind: "september-equinox", longitude: 180 },
  { kind: "december-solstice", longitude: 270 },
];

/** Signed gap, -180..180, from the sun's ecliptic longitude to a target. */
const gap = (date: Date, target: number) => ((sunState(date).eclipticLongitude - target + 540) % 360) - 180;

/**
 * The solstices and equinoxes between two dates, each found to within a
 * minute: the moments the sun's ecliptic longitude crosses 0°, 90°, 180°
 * and 270°.
 */
export function seasonMarks(from: Date, to: Date): SeasonMark[] {
  const DAY = 86400000;
  const out: SeasonMark[] = [];
  for (const { kind, longitude } of MARKS) {
    for (let t = from.getTime(); t < to.getTime(); t += DAY) {
      const a = gap(new Date(t), longitude);
      const b = gap(new Date(t + DAY), longitude);
      // A crossing is a step from just below to just above; far-side wraps are ignored.
      if (a < 0 && b >= 0 && b - a < 10) {
        let lo = t;
        let hi = t + DAY;
        while (hi - lo > 60000) {
          const mid = (lo + hi) / 2;
          if (gap(new Date(mid), longitude) < 0) lo = mid;
          else hi = mid;
        }
        const date = new Date(Math.round((lo + hi) / 2));
        if (date >= from && date <= to) out.push({ kind, date });
      }
    }
  }
  return out.sort((x, y) => x.date.getTime() - y.date.getTime());
}

/** A mark in words for someone at `lat`: the longest day, the shortest day, or an equinox. */
export function seasonMarkWords(kind: SeasonMarkKind, lat: number): string {
  if (kind === "march-equinox" || kind === "september-equinox") {
    const turn = (kind === "march-equinox") === lat >= 0 ? "spring" : "autumn";
    return `the ${turn} equinox, when day and night are even`;
  }
  const longest = (kind === "june-solstice") === lat >= 0;
  return longest ? "the longest day, the summer solstice" : "the shortest day, the winter solstice";
}
