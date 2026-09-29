/**
 * Major earthquakes, eruptions and wildfires, each its own layer, sharing one
 * feed from the host's cached endpoint (the standalone site's /api/hazards).
 * The layers never call USGS or GDACS directly.
 *
 * - Earthquakes: rings sized by magnitude, a soft halo, the freshest (the last
 *   day) breathing slowly; fading over a month.
 * - Volcanoes: a small ember with a warm halo, orange or red by alert.
 * - Wildfires: a warm glow while burning, fading for a week after.
 */

import { type Hazards, firesAt, quakesAt, volcanoesAt } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

export type HazardsOptions = { url?: string; refreshMs?: number };

// ------------------------------------------------------------ shared feed

type Feed = { data: Hazards | null; at: number; loading: boolean; listeners: Set<() => void> };
const feeds = new Map<string, Feed>();

function feed(url: string): Feed {
  let f = feeds.get(url);
  if (!f) {
    f = { data: null, at: 0, loading: false, listeners: new Set() };
    feeds.set(url, f);
  }
  return f;
}

async function refresh(url: string, refreshMs: number) {
  const f = feed(url);
  if (f.loading || Date.now() - f.at < refreshMs) return;
  f.loading = true;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const body = await res.json();
      if (!body.error) f.data = { quakes: body.quakes ?? [], fires: body.fires ?? [], volcanoes: body.volcanoes ?? [] };
    }
  } catch {
    /* keep the last copy; try again next time */
  } finally {
    f.at = Date.now();
    f.loading = false;
    f.listeners.forEach((fn) => fn());
  }
}

/** The latest hazards the shared feed holds for a URL (for hover and cards). */
export const hazardsFor = (url = "/api/hazards"): Hazards | null => feed(url).data;

// ------------------------------------------------------------ layer plumbing

function hazardLayer(
  key: string,
  label: string,
  options: HazardsOptions,
  build: (data: Hazards, frame: Frame) => unknown,
  layers: (ctx: LayerContext) => Array<Record<string, unknown>>,
  paint: (ctx: LayerContext) => void,
  tick?: (ctx: LayerContext, now: number) => void,
): ClockLayer {
  const url = options.url ?? "/api/hazards";
  const refreshMs = options.refreshMs ?? 10 * 60 * 1000;
  const source = key;
  let visible = true;
  let last: { ctx: LayerContext; frame: Frame } | null = null;
  let drawnKey = "";
  const onData = () => {
    drawnKey = "";
    if (last) draw(last.ctx, last.frame);
  };

  function draw(ctx: LayerContext, frame: Frame) {
    last = { ctx, frame };
    const data = feed(url).data;
    const k = `${Math.round(frame.date.getTime() / 600000)}|${feed(url).at}`;
    if (k === drawnKey) return;
    drawnKey = k;
    setSource(ctx, source, data ? build(data, frame) : { type: "FeatureCollection", features: [] });
    if (visible) void refresh(url, refreshMs);
  }

  const ids = (ctx: LayerContext) => layers(ctx).map((l) => String(l.id));

  return {
    key,
    label,
    add(ctx, frame) {
      drawnKey = "";
      feed(url).listeners.add(onData);
      setSource(ctx, source, { type: "FeatureCollection", features: [] });
      for (const l of layers(ctx)) ctx.map.addLayer({ ...l, source: ctx.id(source) } as never, before(ctx));
      paint(ctx);
      draw(ctx, frame);
    },
    update: draw,
    applyPalette: paint,
    setVisible(ctx, v) {
      visible = v;
      setVisibility(ctx, ids(ctx).map((id) => id.slice(ctx.id("").length)), v);
      if (v && last) void refresh(url, refreshMs);
    },
    tick,
    remove(ctx) {
      feed(url).listeners.delete(onData);
      removeAll(ctx, ids(ctx).map((id) => id.slice(ctx.id("").length)), [source]);
      drawnKey = "";
    },
  };
}

const point = (lng: number, lat: number, properties: Record<string, unknown>) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties,
});

// ------------------------------------------------------------ earthquakes

export const earthquakesLayer = (options: HazardsOptions = {}): ClockLayer =>
  hazardLayer(
    "earthquakes",
    "Major earthquakes",
    options,
    (data, frame) => ({
      type: "FeatureCollection",
      features: quakesAt(data.quakes, frame.date).map((q) =>
        point(q.lng, q.lat, { id: q.id, mag: q.mag, s: q.strength, fresh: q.ageDays < 1 ? 1 : 0 }),
      ),
    }),
    (ctx) => {
      const size = ["interpolate", ["linear"], ["get", "mag"], 5, 3, 6, 5.5, 7, 9, 8, 14];
      return [
        {
          id: ctx.id("earthquakes-halo"),
          type: "circle",
          paint: {
            "circle-radius": ["*", size, 2.4],
            "circle-blur": 1,
            "circle-opacity": ["*", 0.5, ["get", "s"]],
            "circle-pitch-alignment": "map",
          },
        },
        {
          id: ctx.id("earthquakes-ring"),
          type: "circle",
          paint: {
            "circle-radius": size,
            "circle-opacity": 0,
            "circle-stroke-width": 1.6,
            "circle-stroke-opacity": ["*", 0.9, ["get", "s"]],
            "circle-pitch-alignment": "map",
          },
        },
      ];
    },
    (ctx) => {
      ctx.map.setPaintProperty(ctx.id("earthquakes-halo"), "circle-color", ctx.palette.quake);
      ctx.map.setPaintProperty(ctx.id("earthquakes-ring"), "circle-stroke-color", ctx.palette.quake);
    },
    (ctx, now) => {
      // The last day's quakes breathe, slowly.
      if (ctx.reducedMotion || !ctx.map.getLayer(ctx.id("earthquakes-halo"))) return;
      const b = 0.5 - 0.5 * Math.cos((2 * Math.PI * (now % 4000)) / 4000);
      ctx.map.setPaintProperty(ctx.id("earthquakes-halo"), "circle-opacity", [
        "*",
        ["get", "s"],
        ["case", ["==", ["get", "fresh"], 1], 0.3 + 0.4 * b, 0.5],
      ]);
    },
  );

// ------------------------------------------------------------ volcanoes

export const volcanoesLayer = (options: HazardsOptions = {}): ClockLayer =>
  hazardLayer(
    "volcanoes",
    "Erupting volcanoes",
    options,
    (data, frame) => ({
      type: "FeatureCollection",
      features: volcanoesAt(data.volcanoes, frame.date).map((v) => point(v.lng, v.lat, { id: v.id, red: v.level === "Red" ? 1 : 0, s: v.strength })),
    }),
    (ctx) => [
      {
        id: ctx.id("volcanoes-halo"),
        type: "circle",
        paint: { "circle-radius": 13, "circle-blur": 1, "circle-opacity": ["*", 0.55, ["get", "s"]], "circle-pitch-alignment": "map" },
      },
      {
        id: ctx.id("volcanoes-core"),
        type: "circle",
        paint: {
          "circle-radius": ["case", ["==", ["get", "red"], 1], 4.5, 3.5],
          "circle-opacity": ["*", 0.95, ["get", "s"]],
          "circle-stroke-width": 1.2,
          "circle-stroke-color": "#2a1410",
          "circle-stroke-opacity": ["*", 0.6, ["get", "s"]],
        },
      },
    ],
    (ctx) => {
      ctx.map.setPaintProperty(ctx.id("volcanoes-halo"), "circle-color", ctx.palette.ember);
      ctx.map.setPaintProperty(ctx.id("volcanoes-core"), "circle-color", ctx.palette.ember);
    },
  );

// ------------------------------------------------------------ wildfires

export const firesLayer = (options: HazardsOptions = {}): ClockLayer =>
  hazardLayer(
    "fires",
    "Major wildfires",
    options,
    (data, frame) => ({
      type: "FeatureCollection",
      features: firesAt(data.fires, frame.date).map((f) => point(f.lng, f.lat, { id: f.id, red: f.level === "Red" ? 1 : 0, s: f.strength })),
    }),
    (ctx) => [
      {
        id: ctx.id("fires-glow"),
        type: "circle",
        paint: {
          "circle-radius": ["case", ["==", ["get", "red"], 1], 16, 12],
          "circle-blur": 0.9,
          "circle-opacity": ["*", 0.7, ["get", "s"]],
          "circle-pitch-alignment": "map",
        },
      },
      {
        id: ctx.id("fires-core"),
        type: "circle",
        paint: { "circle-radius": 2.6, "circle-opacity": ["*", 0.95, ["get", "s"]], "circle-color": "#fff1cf" },
      },
    ],
    (ctx) => {
      ctx.map.setPaintProperty(ctx.id("fires-glow"), "circle-color", ["case", ["==", ["get", "red"], 1], ctx.palette.ember, ctx.palette.fire]);
    },
  );
