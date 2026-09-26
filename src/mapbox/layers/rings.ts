/**
 * Day and night rings. Gold caps around the sun every hour of the Earth's turn
 * (15°, or 5° in fine mode) out to the terminator, stacked so the light deepens
 * toward the sun; violet caps around the antisolar point, deepening toward
 * local midnight. Hour rings keep a slightly firmer hairline in fine mode so
 * the hours still read through the finer steps.
 */

import { rings, stackedOpacity } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

const LAYERS = ["rings-night-fill", "rings-day-fill", "rings-edge"];
const SOURCES = ["rings-fill", "rings-edge"];

/** How deep the stacked light gets at the centre of each side. */
const PEAK = {
  light: { day: 0.42, night: 0.5 },
  dark: { day: 0.5, night: 0.62 },
};

function data(frame: Frame) {
  const spacing = frame.fine ? 5 : 15;
  const day = rings(frame.sun.subsolar, "day", spacing);
  const night = rings(frame.sun.antisolar, "night", spacing);
  return {
    fills: { type: "FeatureCollection", features: [...night.fills.features, ...day.fills.features] },
    edges: { type: "FeatureCollection", features: [...night.edges.features, ...day.edges.features] },
  };
}

function paintFills(ctx: LayerContext, fine: boolean) {
  const count = fine ? 18 : 6;
  const peak = ctx.palette.dark ? PEAK.dark : PEAK.light;
  const m = ctx.map;
  m.setPaintProperty(ctx.id("rings-day-fill"), "fill-color", ctx.palette.day);
  m.setPaintProperty(ctx.id("rings-day-fill"), "fill-opacity", stackedOpacity(count, peak.day));
  m.setPaintProperty(ctx.id("rings-night-fill"), "fill-color", ctx.palette.night);
  m.setPaintProperty(ctx.id("rings-night-fill"), "fill-opacity", stackedOpacity(count, peak.night));
  m.setPaintProperty(ctx.id("rings-edge"), "line-color", [
    "match",
    ["get", "kind"],
    "day",
    ctx.palette.day,
    ctx.palette.night,
  ]);
}

export const ringsLayer = (): ClockLayer => {
  let lastFine: boolean | null = null;
  return {
    key: "rings",
    label: "Rings of light",

    add(ctx, frame) {
      const d = data(frame);
      setSource(ctx, "rings-fill", d.fills);
      setSource(ctx, "rings-edge", d.edges);
      const b = before(ctx);
      // Seams where caps are cut at the antimeridian would show as faint lines
      // under antialiasing; the edges layer draws the true ring outlines instead.
      ctx.map.addLayer(
        {
          id: ctx.id("rings-night-fill"),
          type: "fill",
          source: ctx.id("rings-fill"),
          filter: ["==", ["get", "kind"], "night"],
          paint: { "fill-antialias": false },
        },
        b,
      );
      ctx.map.addLayer(
        {
          id: ctx.id("rings-day-fill"),
          type: "fill",
          source: ctx.id("rings-fill"),
          filter: ["==", ["get", "kind"], "day"],
          paint: { "fill-antialias": false },
        },
        b,
      );
      ctx.map.addLayer(
        {
          id: ctx.id("rings-edge"),
          type: "line",
          source: ctx.id("rings-edge"),
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            // The terminator is the firmest line; hour rings next; fine steps faintest.
            "line-width": [
              "case",
              ["==", ["get", "radius"], 90],
              1.4,
              ["==", ["%", ["get", "radius"], 15], 0],
              0.9,
              0.5,
            ],
            "line-opacity": [
              "case",
              ["==", ["get", "radius"], 90],
              0.75,
              ["==", ["%", ["get", "radius"], 15], 0],
              0.45,
              0.22,
            ],
          },
        },
        b,
      );
      lastFine = frame.fine;
      paintFills(ctx, frame.fine);
    },

    update(ctx, frame) {
      const d = data(frame);
      setSource(ctx, "rings-fill", d.fills);
      setSource(ctx, "rings-edge", d.edges);
      if (frame.fine !== lastFine) {
        lastFine = frame.fine;
        paintFills(ctx, frame.fine);
      }
    },

    applyPalette(ctx) {
      paintFills(ctx, lastFine ?? false);
    },

    setVisible(ctx, visible) {
      setVisibility(ctx, LAYERS, visible);
    },

    remove(ctx) {
      removeAll(ctx, LAYERS, SOURCES);
      lastFine = null;
    },
  };
};
