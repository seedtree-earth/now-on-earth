/**
 * The sun point: a gold dot where the sun stands straight overhead, with a
 * soft halo that breathes slowly so the face feels alive even when the light
 * itself moves too gently to see. The breath stops for reduced motion.
 */

import type { ClockLayer, Frame } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

const LAYERS = ["sun-halo", "sun-dot"];
const SOURCES = ["sun"];

/** One slow breath every eight seconds. */
const BREATH_MS = 8000;

const point = (frame: Frame) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [frame.sun.subsolar.lng, frame.sun.subsolar.lat] },
  properties: {},
});

export const sunLayer = (): ClockLayer => ({
  key: "sun",
  label: "The sun",

  add(ctx, frame) {
    setSource(ctx, "sun", point(frame));
    const b = before(ctx);
    ctx.map.addLayer(
      {
        id: ctx.id("sun-halo"),
        type: "circle",
        source: ctx.id("sun"),
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 16, 5, 30],
          "circle-blur": 1,
          "circle-opacity": 0.55,
          "circle-pitch-alignment": "map",
        },
      },
      b,
    );
    ctx.map.addLayer(
      {
        id: ctx.id("sun-dot"),
        type: "circle",
        source: ctx.id("sun"),
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 5, 5, 8],
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 0.85,
        },
      },
      b,
    );
    this.applyPalette(ctx);
  },

  update(ctx, frame) {
    setSource(ctx, "sun", point(frame));
  },

  applyPalette(ctx) {
    ctx.map.setPaintProperty(ctx.id("sun-halo"), "circle-color", ctx.palette.day);
    ctx.map.setPaintProperty(ctx.id("sun-dot"), "circle-color", ctx.palette.day);
    ctx.map.setPaintProperty(ctx.id("sun-dot"), "circle-stroke-color", "#fff6de");
  },

  tick(ctx, now) {
    if (ctx.reducedMotion || !ctx.map.getLayer(ctx.id("sun-halo"))) return;
    const breath = 0.5 - 0.5 * Math.cos((2 * Math.PI * (now % BREATH_MS)) / BREATH_MS);
    ctx.map.setPaintProperty(ctx.id("sun-halo"), "circle-opacity", 0.35 + 0.3 * breath);
  },

  setVisible(ctx, visible) {
    setVisibility(ctx, LAYERS, visible);
  },

  remove(ctx) {
    removeAll(ctx, LAYERS, SOURCES);
  },
});
