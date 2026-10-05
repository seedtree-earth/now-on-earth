/**
 * Where people lived: a soft glow of human population through History, from
 * HYDE (population density, coarsened to 1° and banded on a log scale at
 * build time by scripts/history/hyde.mjs). It includes everyone, not only
 * the peoples who drew borders: the glow over Australia, the Americas and
 * Africa is there long before any mapped state.
 *
 * Each cell carries one digit per time step (0 nobody, 9 the densest
 * cities); the glow blends between the two steps either side of the year
 * shown. Loaded only when History is first opened; shows only in History.
 */

import type { ExpressionSpecification, GeoJSONSource } from "mapbox-gl";
import { yearOf } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

export type PeopleLivedOptions = {
  /** Where the coarsened grid is served. The standalone site serves it at /data/people.json. */
  url?: string;
};

type Body = { years: number[]; cells: Array<[number, number]>; values: string[] };

/** The two time steps either side of a year, and how far between them (0..1). */
export function stepsAround(years: number[], year: number): { a: number; b: number; t: number } {
  if (year <= years[0]) return { a: 0, b: 0, t: 0 };
  if (year >= years[years.length - 1]) return { a: years.length - 1, b: years.length - 1, t: 0 };
  const b = years.findIndex((y) => y >= year);
  const a = b - 1;
  return { a, b, t: (year - years[a]) / (years[b] - years[a]) };
}

const alpha = (hex: string, a: number) => {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})` : hex;
};

const features = (b: Body) => ({
  type: "FeatureCollection",
  features: b.cells.map((c, i) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: { v: b.values[i] } })),
});

export const peopleLivedLayer = (options: PeopleLivedOptions = {}): ClockLayer => {
  const SOURCE = "people-lived";
  const HEAT = "people-lived-heat";
  let body: Body | null = null;
  let loading: Promise<Body | null> | null = null;
  let visible = true;
  let inHistory = false;
  let lastKey = "";

  const load = () =>
    (loading ??= fetch(options.url ?? "/data/people.json")
      .then((r) => (r.ok ? (r.json() as Promise<Body>) : null))
      .catch(() => null));

  function paint(ctx: LayerContext) {
    const { glow, dusk, day } = ctx.palette;
    ctx.map.setPaintProperty(ctx.id(HEAT), "heatmap-color", ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.1, alpha(dusk, 0.18), 0.4, alpha(dusk, 0.55), 0.75, alpha(day, 0.8), 1, glow] as never);
  }

  function weigh(ctx: LayerContext, frame: Frame) {
    if (!body) return;
    const { a, b, t } = stepsAround(body.years, yearOf(frame.deep));
    const key = `${a}|${b}|${t.toFixed(3)}`;
    if (key === lastKey) return;
    lastKey = key;
    const digit = (i: number): ExpressionSpecification => ["to-number", ["slice", ["get", "v"], i, i + 1]];
    // Blend the two steps, each banded 0..9 on a log scale of density.
    // Squared, so the thinly peopled land stays faint and the crowded places glow.
    const band: ExpressionSpecification = ["/", ["+", ["*", 1 - t, digit(a)], ["*", t, digit(b)]], 9];
    ctx.map.setPaintProperty(ctx.id(HEAT), "heatmap-weight", ["*", band, band] as never);
  }

  function apply(ctx: LayerContext, frame: Frame) {
    inHistory = frame.deep > 0;
    setVisibility(ctx, [HEAT], visible && inHistory);
    if (!inHistory) return;
    if (body) return weigh(ctx, frame);
    void load().then((b) => {
      if (!b || body) return;
      body = b;
      (ctx.map.getSource(ctx.id(SOURCE)) as GeoJSONSource | undefined)?.setData(features(b) as never);
      lastKey = "";
      weigh(ctx, frame);
    });
  }

  return {
    key: "people-lived",
    label: "Where people lived",

    add(ctx, frame) {
      setSource(ctx, SOURCE, body ? features(body) : { type: "FeatureCollection", features: [] });
      ctx.map.addLayer(
        {
          id: ctx.id(HEAT),
          type: "heatmap",
          source: ctx.id(SOURCE),
          paint: {
            "heatmap-weight": 0,
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.55, 4, 1],
            // Wide enough that neighbouring cells melt into one soft glow, not a grid of dots.
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 6, 2, 14, 4, 34],
            "heatmap-opacity": 0.8,
          },
        },
        before(ctx),
      );
      paint(ctx);
      lastKey = "";
      apply(ctx, frame);
    },

    update(ctx, frame) {
      apply(ctx, frame);
    },

    applyPalette(ctx) {
      paint(ctx);
    },

    setVisible(ctx, v) {
      visible = v;
      setVisibility(ctx, [HEAT], visible && inHistory);
    },

    remove(ctx) {
      removeAll(ctx, [HEAT], [SOURCE]);
    },
  };
};
