/**
 * An ecological event as a soft seasonal glow: where a species is seen in
 * this part of the year, blended between the months either side of the date
 * so it drifts as the year slider turns. Deliberately broad (a wide heatmap
 * radius, no markers, no tracks): it shows the general seasonal pattern, not
 * where any animal was.
 *
 * The data is static JSON built by scripts/ecology/; this layer never fetches.
 */

import { type LngLat, type SeasonalEvent, eventFeatures, monthBlend } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

/** A colour at a given opacity, as rgba() (Mapbox-safe). */
function withAlpha(color: string, a: number): string {
  const hex = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) return `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${a})`;
  const rgb = color.match(/[\d.]+/g);
  return rgb && rgb.length >= 3 ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})` : color;
}

export type EventLayerOptions = {
  /** Toggle key; defaults to the event's id. */
  key?: string;
  label?: string;
  /** Where the region's local day is taken from, for the turn of the month. */
  at?: LngLat;
};

export const seasonalEventLayer = (event: SeasonalEvent, options: EventLayerOptions = {}): ClockLayer => {
  const LAYERS = ["event-heat"];
  const SOURCES = ["event"];
  let lastKey = "";

  function paint(ctx: LayerContext) {
    const { life } = ctx.palette;
    ctx.map.setPaintProperty(ctx.id("event-heat"), "heatmap-color", [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(0,0,0,0)",
      0.15,
      withAlpha(life, 0.18),
      0.5,
      withAlpha(life, 0.45),
      1,
      withAlpha(life, 0.7),
    ]);
  }

  function blend(ctx: LayerContext, frame: Frame) {
    const { from, to, t } = monthBlend(frame.date, options.at);
    const key = `${from}|${to}|${t.toFixed(3)}`;
    if (key === lastKey) return;
    lastKey = key;
    const id = ctx.id("event-heat");
    ctx.map.setFilter(id, ["in", ["get", "month"], ["literal", [from, to]]]);
    ctx.map.setPaintProperty(id, "heatmap-weight", [
      "*",
      ["get", "w"],
      ["case", ["==", ["get", "month"], from], 1 - t, t],
    ]);
  }

  return {
    key: options.key ?? event.id,
    label: options.label ?? event.name,

    add(ctx, frame) {
      lastKey = "";
      setSource(ctx, "event", eventFeatures(event));
      ctx.map.addLayer(
        {
          id: ctx.id("event-heat"),
          type: "heatmap",
          source: ctx.id("event"),
          paint: {
            // Wide and soft on purpose: a season's pattern, not points.
            "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, 10, 3, 28, 6, 60, 9, 120],
            // Never saturating: a haze that says "around here, this season".
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.7, 6, 0.9],
            "heatmap-opacity": 0.9,
          },
        },
        before(ctx),
      );
      paint(ctx);
      blend(ctx, frame);
    },

    update(ctx, frame) {
      blend(ctx, frame);
    },

    applyPalette(ctx) {
      paint(ctx);
    },

    setVisible(ctx, visible) {
      setVisibility(ctx, LAYERS, visible);
    },

    remove(ctx) {
      removeAll(ctx, LAYERS, SOURCES);
      lastKey = "";
    },
  };
};

/**
 * PLACEHOLDER · partnered seasonal knowledge. Draws nothing, on purpose: see
 * PartneredKnowledge in core/events.ts. It exists so the slot, its toggle and
 * its terms are in place before any knowledge is shared, with permission.
 */
export const partneredKnowledgeLayer = (): ClockLayer => ({
  key: "partnered-knowledge",
  label: "Seasonal knowledge, shared in partnership (to come, with permission)",
  add() {},
  update() {},
  applyPalette() {},
  setVisible() {},
  remove() {},
});
