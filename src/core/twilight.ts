/**
 * Twilight: the soft light either side of the terminator.
 *
 * On the day side, golden hour, while the sun stands less than 6° above the
 * horizon. On the night side, the three twilights, while it is less than 6°
 * (civil), 12° (nautical) and 18° (astronomical) below it. Each is cut into
 * thin bands carrying a `depth` from 0 at the terminator to 1 at the band's far
 * edge, so a renderer can grade colour and opacity smoothly across them.
 *
 * Distances past 90° from the sun are taken from the antisolar point instead,
 * so every band stays within a hemisphere of its centre.
 */

import type { SunState } from "./sun.js";
import { type FeatureCollection, type PolygonCoords, band } from "./rings.js";

export type TwilightKind = "golden" | "civil" | "nautical" | "astronomical";

export type TwilightFeature = {
  type: "Feature";
  geometry: { type: "MultiPolygon"; coordinates: PolygonCoords[] };
  properties: {
    kind: TwilightKind;
    /** 0 at the terminator, 1 at the far edge of astronomical twilight (or of golden hour). */
    depth: number;
  };
};

/** Width of each graded step, in degrees of sun altitude. */
export const TWILIGHT_STEP = 2;

const KINDS: Array<{ kind: TwilightKind; from: number; to: number }> = [
  { kind: "civil", from: 0, to: 6 },
  { kind: "nautical", from: 6, to: 12 },
  { kind: "astronomical", from: 12, to: 18 },
];

export function twilightBands(sun: SunState, step = TWILIGHT_STEP): FeatureCollection<TwilightFeature> {
  const features: TwilightFeature[] = [];
  const push = (kind: TwilightKind, depth: number, coordinates: PolygonCoords[]) => {
    if (coordinates.length) features.push({ type: "Feature", geometry: { type: "MultiPolygon", coordinates }, properties: { kind, depth } });
  };

  // Golden hour: sun altitude 0..6°, i.e. 84..90° from the subsolar point.
  for (let a = 0; a < 6; a += step) {
    push("golden", (a + step / 2) / 6, band(sun.subsolar, 90 - a - step, 90 - a));
  }
  // Twilight: sun 0..18° below the horizon, i.e. 90..108° from the sun,
  // which is 72..90° from the antisolar point.
  for (const k of KINDS) {
    for (let a = k.from; a < k.to; a += step) {
      push(k.kind, (a + step / 2) / 18, band(sun.antisolar, 90 - a - step, 90 - a));
    }
  }
  return { type: "FeatureCollection", features };
}
