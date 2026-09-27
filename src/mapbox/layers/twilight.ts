/**
 * Twilight: soft graded bands either side of the terminator. Golden hour on
 * the lit side warms from gold into dusk rose as the sun nears the horizon;
 * past it, civil, nautical and astronomical twilight cool from that rose into
 * the night's violet, fading as they go, so the day never simply switches off.
 */

import { twilightBands } from "../../core/index.js";
import type { ClockLayer, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

const LAYERS = ["twilight-fill"];
const SOURCES = ["twilight"];

function paint(ctx: LayerContext) {
  const { day, dusk, night, dark } = ctx.palette;
  const lift = dark ? 1.15 : 1;
  const m = ctx.map;
  m.setPaintProperty(ctx.id("twilight-fill"), "fill-color", [
    "case",
    ["==", ["get", "kind"], "golden"],
    // depth 0 at the horizon (rose) to 1 where golden hour gives way to day (gold)
    ["interpolate-lab", ["linear"], ["get", "depth"], 0, dusk, 1, day],
    // depth 0 at the terminator (rose) to 1 at the end of astronomical twilight (violet)
    ["interpolate-lab", ["linear"], ["get", "depth"], 0, dusk, 0.45, night, 1, night],
  ]);
  m.setPaintProperty(ctx.id("twilight-fill"), "fill-opacity", [
    "case",
    ["==", ["get", "kind"], "golden"],
    ["interpolate", ["linear"], ["get", "depth"], 0, 0.3 * lift, 1, 0.06],
    ["interpolate", ["linear"], ["get", "depth"], 0, 0.3 * lift, 0.4, 0.2 * lift, 1, 0.1],
  ]);
}

export const twilightLayer = (): ClockLayer => ({
  key: "twilight",
  label: "Twilight and golden hour",

  add(ctx, frame) {
    setSource(ctx, "twilight", twilightBands(frame.sun));
    ctx.map.addLayer(
      {
        id: ctx.id("twilight-fill"),
        type: "fill",
        source: ctx.id("twilight"),
        paint: { "fill-antialias": false },
      },
      before(ctx),
    );
    paint(ctx);
  },

  update(ctx, frame) {
    setSource(ctx, "twilight", twilightBands(frame.sun));
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
});
