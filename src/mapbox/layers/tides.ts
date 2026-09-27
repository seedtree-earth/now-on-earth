/**
 * The moon's pull: two soft swells of moonlight, one under the moon and one on
 * the far side of the Earth, where the oceans are drawn highest. Idealised, as
 * a picture of the pull rather than a tide table: real tides lag and bend with
 * coastlines and ocean basins.
 */

import { cap, stackedOpacity } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

const LAYERS = ["tides-fill"];
const SOURCES = ["tides"];
const RADII = [45, 30, 15];

function data(frame: Frame) {
  const features = [frame.moon.sublunar, frame.moon.antisublunar].flatMap((c) =>
    RADII.map((radius) => ({
      type: "Feature",
      geometry: { type: "MultiPolygon", coordinates: cap(c, radius).polygons },
      properties: { radius },
    })),
  );
  return { type: "FeatureCollection", features };
}

function paint(ctx: LayerContext) {
  ctx.map.setPaintProperty(ctx.id("tides-fill"), "fill-color", ctx.palette.moon);
  ctx.map.setPaintProperty(ctx.id("tides-fill"), "fill-opacity", stackedOpacity(RADII.length, ctx.palette.dark ? 0.26 : 0.3));
}

export const tidesLayer = (): ClockLayer => ({
  key: "tides",
  label: "The moon's pull on the oceans",

  add(ctx, frame) {
    setSource(ctx, "tides", data(frame));
    ctx.map.addLayer(
      { id: ctx.id("tides-fill"), type: "fill", source: ctx.id("tides"), paint: { "fill-antialias": false } },
      before(ctx),
    );
    paint(ctx);
  },

  update(ctx, frame) {
    setSource(ctx, "tides", data(frame));
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
