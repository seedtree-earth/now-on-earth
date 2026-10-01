/**
 * A migration as a flow: a soft ribbon along each corridor, thick in season
 * and gone out of it, with particles streaming along it the way the animals
 * are travelling (driven by the year slider through the frame's date). One
 * corridor for a coastal migration (the humpbacks), or several legs for a
 * flyway (the godwits). Built from the event's own monthly grid by
 * core/flows.ts; no sighting is drawn.
 *
 * Reduced motion: the particles hold still, spread along the ribbon.
 */

import {
  type FlowParticle,
  type MigrationFlow,
  type SeasonalEvent,
  deriveFlow,
  deriveFlyway,
  flowAt,
  flowParticles,
} from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

export type FlowLayerOptions = {
  /** For a single corridor: which way it runs; "lat" for a coast running north–south. */
  axis?: "lat" | "lng";
  /** Particles per corridor at full season. */
  count?: number;
  /** Half-width of the stream, in degrees. */
  width?: number;
};

/** The flows an event draws: its flyway's legs, or one corridor. */
export function flowsOf(event: SeasonalEvent, axis?: "lat" | "lng"): MigrationFlow[] {
  return event.display === "flyway" ? deriveFlyway(event) : [deriveFlow(event, { axis: axis ?? event.flowAxis ?? "lat" })];
}

export const migrationFlowLayer = (event: SeasonalEvent, options: FlowLayerOptions = {}): ClockLayer => {
  const flows = flowsOf(event, options.axis);
  const flyway = event.display === "flyway";
  const count = options.count ?? (flyway ? 160 : 140);
  const width = options.width ?? (flyway ? 1.4 : 0.6);
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
    ctx.map.setPaintProperty(ctx.id(GLOW), "line-color", c);
    ctx.map.setPaintProperty(ctx.id(CORE), "line-color", c);
    ctx.map.setPaintProperty(ctx.id(DOTS), "circle-color", c);
  }

  /** Each corridor carries its season as `i`; the ribbon swells with it. */
  function ribbons(ctx: LayerContext, frame: Frame) {
    date = frame.date;
    setSource(ctx, RIBBON, {
      type: "FeatureCollection",
      features: flows.map((f) => ({
        type: "Feature",
        properties: { i: Math.round(flowAt(f, date).intensity * 100) / 100 },
        geometry: { type: "LineString", coordinates: f.corridor },
      })),
    });
  }

  function particles(ctx: LayerContext, seconds: number) {
    const features: FlowParticle[] = [];
    for (const f of flows) features.push(...flowParticles(f, date, seconds, { count, width }).features);
    setSource(ctx, PARTS, { type: "FeatureCollection", features });
  }

  return {
    key: event.id,
    label: event.name,

    add(ctx, frame) {
      ribbons(ctx, frame);
      setSource(ctx, PARTS, { type: "FeatureCollection", features: [] });
      const b = before(ctx);
      ctx.map.addLayer(
        {
          id: ctx.id(GLOW),
          type: "line",
          source: ctx.id(RIBBON),
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-blur": 10,
            "line-width": ["+", 3, ["*", 16, ["get", "i"]]],
            "line-opacity": ["*", 0.32, ["get", "i"]],
          },
        },
        b,
      );
      ctx.map.addLayer(
        {
          id: ctx.id(CORE),
          type: "line",
          source: ctx.id(RIBBON),
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-width": 1,
            // A flyway's quiet legs all but vanish; a coast's corridor keeps a faint trace.
            "line-opacity": ["+", flyway ? 0.02 : 0.12, ["*", 0.3, ["get", "i"]]],
            "line-dasharray": [1, 3],
          },
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
      particles(ctx, ctx.reducedMotion ? 0 : performance.now() / 1000);
    },

    update(ctx, frame) {
      ribbons(ctx, frame);
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
