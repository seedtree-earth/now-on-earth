/**
 * Seasonal lines. The two tropics dashed in gold: the sun's lane, the only
 * band where it ever stands overhead. Today's sun track dotted: the parallel it
 * crosses overhead today, sliding between the tropics through the year. And
 * the viewer's own parallel in teal, bright where it is lit and faint where it
 * is dark, with a dot where they are. How much of their line is bright is how
 * long their day is.
 */

import { seasonLines } from "../../core/index.js";
import type { ClockLayer, Frame } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

const LAYERS = ["season-tropics", "season-track", "season-me-dark", "season-me-lit", "season-me-dot"];
const SOURCES = ["season-lines", "season-me"];

const me = (frame: Frame) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [frame.viewer.lng, frame.viewer.lat] },
  properties: {},
});

export const seasonsLayer = (): ClockLayer => ({
  key: "seasons",
  label: "Seasons and your line of light",

  add(ctx, frame) {
    setSource(ctx, "season-lines", seasonLines(frame.sun, frame.viewer));
    setSource(ctx, "season-me", me(frame));
    const b = before(ctx);
    const src = ctx.id("season-lines");
    const kind = (k: string) => ["==", ["get", "kind"], k] as ["==", ["get", string], string];

    ctx.map.addLayer(
      {
        id: ctx.id("season-tropics"),
        type: "line",
        source: src,
        filter: kind("tropic"),
        paint: { "line-width": 1.1, "line-opacity": 0.7, "line-dasharray": [3, 3] },
      },
      b,
    );
    ctx.map.addLayer(
      {
        id: ctx.id("season-track"),
        type: "line",
        source: src,
        filter: kind("sun-track"),
        layout: { "line-cap": "round" },
        paint: { "line-width": 1.6, "line-opacity": 0.8, "line-dasharray": [0.1, 2.4] },
      },
      b,
    );
    ctx.map.addLayer(
      {
        id: ctx.id("season-me-dark"),
        type: "line",
        source: src,
        filter: kind("me-dark"),
        paint: { "line-width": 1.4, "line-opacity": 0.35 },
      },
      b,
    );
    ctx.map.addLayer(
      {
        id: ctx.id("season-me-lit"),
        type: "line",
        source: src,
        filter: kind("me-lit"),
        layout: { "line-cap": "round" },
        paint: { "line-width": 2.2, "line-opacity": 0.95 },
      },
      b,
    );
    ctx.map.addLayer(
      {
        id: ctx.id("season-me-dot"),
        type: "circle",
        source: ctx.id("season-me"),
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 4.5, 5, 7],
          "circle-stroke-width": 2,
        },
      },
      b,
    );
    this.applyPalette(ctx);
  },

  update(ctx, frame) {
    setSource(ctx, "season-lines", seasonLines(frame.sun, frame.viewer));
    setSource(ctx, "season-me", me(frame));
  },

  applyPalette(ctx) {
    const m = ctx.map;
    m.setPaintProperty(ctx.id("season-tropics"), "line-color", ctx.palette.day);
    m.setPaintProperty(ctx.id("season-track"), "line-color", ctx.palette.day);
    m.setPaintProperty(ctx.id("season-me-dark"), "line-color", ctx.palette.me);
    m.setPaintProperty(ctx.id("season-me-lit"), "line-color", ctx.palette.me);
    m.setPaintProperty(ctx.id("season-me-dot"), "circle-color", ctx.palette.me);
    m.setPaintProperty(ctx.id("season-me-dot"), "circle-stroke-color", "#fbf6ea");
  },

  setVisible(ctx, visible) {
    setVisibility(ctx, LAYERS, visible);
  },

  remove(ctx) {
    removeAll(ctx, LAYERS, SOURCES);
  },
});
