/**
 * Seasonal lines, as three separate layers:
 *
 * - the lane: the two tropics dashed in gold, the only band where the sun ever
 *   stands overhead;
 * - the sun track: today's parallel under the sun, dotted, sliding between the
 *   tropics through the year;
 * - the day line: the viewer's own parallel in teal, bright where it is lit and
 *   faint where it is dark, with a dot where they are. How much of it is
 *   bright is how long their day is.
 */

import { seasonLines, type SeasonLineKind } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

const only = (frame: Frame, kinds: SeasonLineKind[]) => {
  const fc = seasonLines(frame.sun, frame.viewer);
  return { ...fc, features: fc.features.filter((f) => kinds.includes(f.properties.kind)) };
};

type LineSpec = { id: string; kind: SeasonLineKind; paint: Record<string, unknown>; round?: boolean };

/** A layer made of one or more seasonal lines from a single source. */
function linesLayer(key: string, label: string, specs: LineSpec[], colour: (ctx: LayerContext) => string): ClockLayer {
  const source = `${key}-lines`;
  const layers = specs.map((s) => s.id);
  const kinds = specs.map((s) => s.kind);
  return {
    key,
    label,
    add(ctx, frame) {
      setSource(ctx, source, only(frame, kinds));
      for (const s of specs) {
        ctx.map.addLayer(
          {
            id: ctx.id(s.id),
            type: "line",
            source: ctx.id(source),
            filter: ["==", ["get", "kind"], s.kind],
            ...(s.round && { layout: { "line-cap": "round" as const } }),
            paint: s.paint,
          },
          before(ctx),
        );
      }
      this.applyPalette(ctx);
    },
    update(ctx, frame) {
      setSource(ctx, source, only(frame, kinds));
    },
    applyPalette(ctx) {
      for (const id of layers) ctx.map.setPaintProperty(ctx.id(id), "line-color", colour(ctx));
    },
    setVisible(ctx, visible) {
      setVisibility(ctx, layers, visible);
    },
    remove(ctx) {
      removeAll(ctx, layers, [source]);
    },
  };
}

/** The tropics: the sun's lane. */
export const laneLayer = (): ClockLayer =>
  linesLayer(
    "lane",
    "The sun's lane",
    [{ id: "lane-tropics", kind: "tropic", paint: { "line-width": 1.1, "line-opacity": 0.7, "line-dasharray": [3, 3] } }],
    (ctx) => ctx.palette.day,
  );

/** Today's parallel under the sun. */
export const sunTrackLayer = (): ClockLayer =>
  linesLayer(
    "sun-track",
    "Today's sun track",
    [{ id: "sun-track-line", kind: "sun-track", round: true, paint: { "line-width": 1.6, "line-opacity": 0.8, "line-dasharray": [0.1, 2.4] } }],
    (ctx) => ctx.palette.day,
  );

/** The viewer's parallel, lit and dark, and their dot. */
export const dayLineLayer = (): ClockLayer => {
  const base = linesLayer(
    "day-line",
    "Your day line",
    [
      { id: "day-line-dark", kind: "me-dark", paint: { "line-width": 1.4, "line-opacity": 0.35 } },
      { id: "day-line-lit", kind: "me-lit", round: true, paint: { "line-width": 2.2, "line-opacity": 0.95 } },
    ],
    (ctx) => ctx.palette.me,
  );
  const me = (frame: Frame) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [frame.viewer.lng, frame.viewer.lat] },
    properties: {},
  });
  return {
    ...base,
    add(ctx, frame) {
      base.add.call(this, ctx, frame);
      setSource(ctx, "day-line-me", me(frame));
      ctx.map.addLayer(
        {
          id: ctx.id("day-line-dot"),
          type: "circle",
          source: ctx.id("day-line-me"),
          paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 4.5, 5, 7], "circle-stroke-width": 2 },
        },
        before(ctx),
      );
      this.applyPalette(ctx);
    },
    update(ctx, frame) {
      base.update(ctx, frame);
      setSource(ctx, "day-line-me", me(frame));
    },
    applyPalette(ctx) {
      base.applyPalette.call(this, ctx);
      if (!ctx.map.getLayer(ctx.id("day-line-dot"))) return;
      ctx.map.setPaintProperty(ctx.id("day-line-dot"), "circle-color", ctx.palette.me);
      ctx.map.setPaintProperty(ctx.id("day-line-dot"), "circle-stroke-color", "#fbf6ea");
    },
    setVisible(ctx, visible) {
      base.setVisible(ctx, visible);
      setVisibility(ctx, ["day-line-dot"], visible);
    },
    remove(ctx) {
      base.remove(ctx);
      removeAll(ctx, ["day-line-dot"], ["day-line-me"]);
    },
  };
};
