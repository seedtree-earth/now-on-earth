/**
 * A migration as a flow: a soft ribbon along the corridor, thick in season and
 * gone out of it, with particles streaming along it the way the animals are
 * travelling (driven by the year slider through the frame's date). Built from
 * the event's own monthly grid by core/flows.ts; no sighting is drawn.
 *
 * Reduced motion: the particles hold still, spread along the ribbon.
 */

import { type MigrationFlow, type SeasonalEvent, deriveFlow, flowAt, flowParticles } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

export type FlowLayerOptions = {
  /** Which way the corridor runs; "lat" for a coast running north–south. */
  axis?: "lat" | "lng";
  /** Particles at full season. */
  count?: number;
};

export const migrationFlowLayer = (event: SeasonalEvent, options: FlowLayerOptions = {}): ClockLayer => {
  const flow: MigrationFlow = deriveFlow(event, { axis: options.axis ?? "lat" });
  const RIBBON = `flow-${event.id}-ribbon`;
  const PARTS = `flow-${event.id}-particles`;
  const GLOW = `flow-${event.id}-glow`;
  const CORE = `flow-${event.id}-core`;
  const DOTS = `flow-${event.id}-dots`;
  const LAYERS = [GLOW, CORE, DOTS];
  let date = new Date();
  let lastDraw = 0;
  let visible = true;

  const colour = (ctx: LayerContext) => (event.hue && (ctx.palette as unknown as Record<string, string>)[event.hue]) || ctx.palette.life;

  function paint(ctx: LayerContext) {
    const c = colour(ctx);
    for (const id of LAYERS) {
      const prop = id === DOTS ? "circle-color" : "line-color";
      ctx.map.setPaintProperty(ctx.id(id), prop, c);
    }
  }

  function season(ctx: LayerContext, frame: Frame) {
    date = frame.date;
    const { intensity } = flowAt(flow, date);
    // The ribbon swells with the season and all but vanishes out of it.
    ctx.map.setPaintProperty(ctx.id(GLOW), "line-width", 3 + 16 * intensity);
    ctx.map.setPaintProperty(ctx.id(GLOW), "line-opacity", 0.32 * intensity);
    ctx.map.setPaintProperty(ctx.id(CORE), "line-opacity", 0.12 + 0.3 * intensity);
  }

  function particles(ctx: LayerContext, seconds: number) {
    setSource(ctx, PARTS, flowParticles(flow, date, seconds, { count: options.count ?? 140 }));
  }

  return {
    key: event.id,
    label: event.name,

    add(ctx, frame) {
      setSource(ctx, RIBBON, { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: flow.corridor } });
      setSource(ctx, PARTS, { type: "FeatureCollection", features: [] });
      const b = before(ctx);
      ctx.map.addLayer(
        {
          id: ctx.id(GLOW),
          type: "line",
          source: ctx.id(RIBBON),
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-blur": 10, "line-width": 10, "line-opacity": 0.2 },
        },
        b,
      );
      ctx.map.addLayer(
        {
          id: ctx.id(CORE),
          type: "line",
          source: ctx.id(RIBBON),
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-width": 1, "line-opacity": 0.3, "line-dasharray": [1, 3] },
        },
        b,
      );
      ctx.map.addLayer(
        {
          id: ctx.id(DOTS),
          type: "circle",
          source: ctx.id(PARTS),
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 2.2, 5, 4],
            "circle-blur": 0.35,
            "circle-opacity": ["get", "a"],
            "circle-stroke-width": 0,
          },
        },
        b,
      );
      paint(ctx);
      season(ctx, frame);
      particles(ctx, ctx.reducedMotion ? 0 : performance.now() / 1000);
    },

    update(ctx, frame) {
      season(ctx, frame);
      if (ctx.reducedMotion) particles(ctx, 0);
    },

    tick(ctx, now) {
      if (ctx.reducedMotion || !visible) return;
      // About twenty frames a second is plenty for a slow stream.
      if (now - lastDraw < 50) return;
      lastDraw = now;
      particles(ctx, now / 1000);
    },

    applyPalette(ctx) {
      paint(ctx);
    },

    setVisible(ctx, v) {
      visible = v;
      setVisibility(ctx, LAYERS, v);
    },

    remove(ctx) {
      removeAll(ctx, LAYERS, [RIBBON, PARTS]);
    },
  };
};
