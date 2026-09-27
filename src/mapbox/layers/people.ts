/**
 * People and nodes, each in their own light: a dot coloured by the sun where
 * they are (gold by day, dusk rose at the edges, violet with a moonlit ring by
 * night). Only those who chose to be shown are drawn, each at a coarse place;
 * see core/people.ts for the line this layer holds.
 *
 * Hovering or tapping a dot hands its details to `onPick`, so the host can
 * show them in its own UI. This layer never searches for anyone.
 */

import type { ExpressionSpecification, MapMouseEvent } from "mapbox-gl";
import { presenceFeatures, type PresenceFeature } from "../../core/index.js";
import type { ClockLayer, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

const LAYERS = ["people-halo", "people-dot"];
const SOURCES = ["people"];

export type PresencePick = PresenceFeature["properties"];

export type PeopleLayerOptions = {
  /** Called with a dot's details on hover or tap, and with null on leave. */
  onPick?: (pick: PresencePick | null) => void;
};

function paint(ctx: LayerContext) {
  const { day, dusk, night, glow, moon } = ctx.palette;
  const m = ctx.map;
  const colour: ExpressionSpecification = [
    "interpolate-lab",
    ["linear"],
    ["get", "altitude"],
    -18,
    night,
    -6,
    dusk,
    2,
    dusk,
    10,
    day,
    50,
    glow,
  ];
  m.setPaintProperty(ctx.id("people-dot"), "circle-color", colour);
  m.setPaintProperty(ctx.id("people-halo"), "circle-color", colour);
  // By night the dot wears a ring of moonlight so it still reads on the dark.
  m.setPaintProperty(ctx.id("people-dot"), "circle-stroke-color", [
    "case",
    ["<", ["get", "altitude"], -6],
    moon,
    "#fbf6ea",
  ]);
}

export const peopleLayer = (options: PeopleLayerOptions = {}): ClockLayer => {
  let handlers: Array<[string, (e: MapMouseEvent) => void]> = [];

  return {
    key: "people",
    label: "People and nodes, each in their own light",

    add(ctx, frame) {
      setSource(ctx, "people", presenceFeatures(frame.people, frame.sun));
      const b = before(ctx);
      ctx.map.addLayer(
        {
          id: ctx.id("people-halo"),
          type: "circle",
          source: ctx.id("people"),
          paint: { "circle-radius": 11, "circle-blur": 1, "circle-opacity": 0.45 },
        },
        b,
      );
      ctx.map.addLayer(
        {
          id: ctx.id("people-dot"),
          type: "circle",
          source: ctx.id("people"),
          paint: {
            "circle-radius": ["match", ["get", "kind"], "organisation", 3.6, 4.6],
            "circle-stroke-width": 1.4,
          },
        },
        b,
      );
      paint(ctx);

      const dot = ctx.id("people-dot");
      const pick = (e: MapMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        ctx.map.getCanvas().style.cursor = "pointer";
        options.onPick?.(f.properties as PresencePick);
      };
      const leave = () => {
        ctx.map.getCanvas().style.cursor = "";
        options.onPick?.(null);
      };
      handlers = [
        ["mousemove", pick],
        ["click", pick],
        ["mouseleave", leave],
      ];
      for (const [type, fn] of handlers) ctx.map.on(type as "click", dot, fn);
    },

    update(ctx, frame) {
      setSource(ctx, "people", presenceFeatures(frame.people, frame.sun));
    },

    applyPalette(ctx) {
      paint(ctx);
    },

    setVisible(ctx, visible) {
      setVisibility(ctx, LAYERS, visible);
      if (!visible) options.onPick?.(null);
    },

    remove(ctx) {
      for (const [type, fn] of handlers) ctx.map.off(type as "click", ctx.id("people-dot"), fn);
      handlers = [];
      removeAll(ctx, LAYERS, SOURCES);
    },
  };
};
