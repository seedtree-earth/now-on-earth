/**
 * The moon's pull on the oceans: two moonlit swells, one under the moon and
 * one on the far side of the Earth, rising smoothly toward their crests; a
 * faint belt of low water around the Earth between them; and a dashed rim
 * where the pull turns from lifting the sea to drawing it away. The swells
 * show fuller at spring tides (new and full moon) and fainter at neap tides.
 *
 * Idealised on purpose: this is the pull (the equilibrium tide), not a tide
 * table. Real tides lag it and bend with coastlines and ocean basins.
 */

import { springNeap, stackedOpacity, tideFeatures } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

const LAYERS = ["tides-ebb", "tides-swell", "tides-rim"];
const SOURCES = ["tides"];
const STEPS = 12;

export const tidesLayer = (): ClockLayer => {
  let strength = 1;

  function paint(ctx: LayerContext) {
    const { moon, night, dark } = ctx.palette;
    const m = ctx.map;
    const swellPeak = (dark ? 0.5 : 0.55) * strength;
    m.setPaintProperty(ctx.id("tides-swell"), "fill-color", moon);
    m.setPaintProperty(ctx.id("tides-swell"), "fill-opacity", stackedOpacity(STEPS, swellPeak));
    m.setPaintProperty(ctx.id("tides-ebb"), "fill-color", night);
    m.setPaintProperty(ctx.id("tides-ebb"), "fill-opacity", stackedOpacity(STEPS / 2, (dark ? 0.2 : 0.14) * strength));
    m.setPaintProperty(ctx.id("tides-rim"), "line-color", moon);
    m.setPaintProperty(ctx.id("tides-rim"), "line-opacity", 0.35 + 0.4 * strength);
  }

  function refresh(ctx: LayerContext, frame: Frame) {
    setSource(ctx, "tides", tideFeatures(frame.moon, STEPS));
    const s = springNeap(frame.moon);
    if (Math.abs(s - strength) > 0.01) {
      strength = s;
      paint(ctx);
    }
  }

  return {
    key: "tides",
    label: "The moon's pull on the oceans",

    add(ctx, frame) {
      strength = springNeap(frame.moon);
      setSource(ctx, "tides", tideFeatures(frame.moon, STEPS));
      const b = before(ctx);
      const kind = (k: string) => ["==", ["get", "kind"], k] as ["==", ["get", string], string];
      ctx.map.addLayer(
        { id: ctx.id("tides-ebb"), type: "fill", source: ctx.id("tides"), filter: kind("ebb"), paint: { "fill-antialias": false } },
        b,
      );
      ctx.map.addLayer(
        { id: ctx.id("tides-swell"), type: "fill", source: ctx.id("tides"), filter: kind("swell"), paint: { "fill-antialias": false } },
        b,
      );
      ctx.map.addLayer(
        {
          id: ctx.id("tides-rim"),
          type: "line",
          source: ctx.id("tides"),
          filter: kind("rim"),
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-width": 1.2, "line-dasharray": [1.5, 2.5] },
        },
        b,
      );
      paint(ctx);
    },

    update(ctx, frame) {
      refresh(ctx, frame);
    },

    applyPalette(ctx) {
      paint(ctx);
    },

    setVisible(ctx, visible) {
      setVisibility(ctx, LAYERS, visible);
    },

    remove(ctx) {
      removeAll(ctx, LAYERS, SOURCES);
    },
  };
};
