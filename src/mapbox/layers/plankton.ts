/**
 * Plankton's nightly rise, drawn: a soft bioluminescent glow over the dark
 * oceans, brightest along the dusk edge where the plankton are arriving at
 * the surface, quieter through the night, fading along the dawn edge as they
 * sink. It breathes slowly. A MODEL of a real daily pattern (see
 * core/plankton.ts), labelled as such wherever it is shown.
 */

import { planktonField } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

const LAYERS = ["plankton-glow"];
const SOURCES = ["plankton"];
const BREATH_MS = 11000;

function withAlpha(color: string, a: number): string {
  const hex = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) return `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${a})`;
  const rgb = color.match(/[\d.]+/g);
  return rgb && rgb.length >= 3 ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})` : color;
}

export const planktonLayer = (): ClockLayer => {
  let drawnFor = NaN;

  function refresh(ctx: LayerContext, frame: Frame) {
    // The sun moves a degree every four minutes; redraw when it has.
    const slot = Math.round(frame.date.getTime() / (4 * 60 * 1000));
    if (slot === drawnFor) return;
    drawnFor = slot;
    setSource(ctx, "plankton", planktonField(frame.sun));
  }

  function paint(ctx: LayerContext) {
    const c = ctx.palette.plankton;
    ctx.map.setPaintProperty(ctx.id("plankton-glow"), "heatmap-color", [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(0,0,0,0)",
      0.12,
      withAlpha(c, 0.14),
      0.45,
      withAlpha(c, 0.4),
      1,
      withAlpha(c, 0.62),
    ]);
  }

  return {
    key: "plankton",
    label: "Plankton's nightly rise (a model)",

    add(ctx, frame) {
      drawnFor = NaN;
      setSource(ctx, "plankton", { type: "FeatureCollection", features: [] });
      ctx.map.addLayer(
        {
          id: ctx.id("plankton-glow"),
          type: "heatmap",
          source: ctx.id("plankton"),
          paint: {
            "heatmap-weight": ["get", "w"],
            // A 2° grid: wide enough to merge into one soft sea of light.
            "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, 8, 3, 26, 6, 80],
            "heatmap-intensity": 0.7,
            "heatmap-opacity": 0.9,
          },
        },
        before(ctx),
      );
      paint(ctx);
      refresh(ctx, frame);
    },

    update(ctx, frame) {
      refresh(ctx, frame);
    },

    applyPalette(ctx) {
      paint(ctx);
    },

    tick(ctx, now) {
      if (ctx.reducedMotion || !ctx.map.getLayer(ctx.id("plankton-glow"))) return;
      const breath = 0.5 - 0.5 * Math.cos((2 * Math.PI * (now % BREATH_MS)) / BREATH_MS);
      ctx.map.setPaintProperty(ctx.id("plankton-glow"), "heatmap-intensity", 0.6 + 0.2 * breath);
    },

    setVisible(ctx, visible) {
      setVisibility(ctx, LAYERS, visible);
    },

    remove(ctx) {
      removeAll(ctx, LAYERS, SOURCES);
      drawnFor = NaN;
    },
  };
};
