/**
 * The aurora: a soft glowing oval on the night side.
 *
 * Near the present moment it is NOAA's live forecast (OVATION), fetched from
 * the host's cached endpoint (the standalone site's /api/aurora), never from
 * NOAA directly. Move the clock more than an hour or so from now and the live
 * glow fades out and a typical oval fades in: paler, with dashed edges, so it
 * reads as "typical" rather than "tonight". Either way it only shows where it
 * is dark.
 */

import {
  type AuroraPoint,
  darkness,
  typicalAurora,
  typicalOvalEdges,
} from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

export type AuroraOptions = {
  /** Where the lightened NOAA forecast is served (see api/aurora.ts). */
  url?: string;
  /** How often to ask for a fresh forecast while live. */
  refreshMs?: number;
  /** Told when live data arrives, fails, or the layer turns typical. */
  onStatus?: (status: AuroraStatus) => void;
};

export type AuroraStatus = {
  mode: "live" | "typical" | "unavailable";
  observed?: string;
  credit?: string;
  /** The live forecast's points, when live (for words at a place). */
  points?: AuroraPoint[];
};

const LAYERS = ["aurora-typical", "aurora-typical-edge", "aurora-live"];
const SOURCES = ["aurora-live", "aurora-typical", "aurora-typical-edge"];
/** Within this of the real now, the forecast counts as live; it fades out over the next half hour. */
const LIVE_MS = 60 * 60 * 1000;
const FADE_MS = 30 * 60 * 1000;

function withAlpha(color: string, a: number): string {
  const hex = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) return `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${a})`;
  const rgb = color.match(/[\d.]+/g);
  return rgb && rgb.length >= 3 ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})` : color;
}

/** Points as GeoJSON, each weighted by its value and by how dark it is there now. */
function weighted(points: AuroraPoint[], frame: Frame) {
  return {
    type: "FeatureCollection",
    features: points.map(([lng, lat, v]) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      // NOAA's grid is a point every degree, so each carries only a little light.
      properties: { w: Math.min(1, v / 30) * darkness({ lng, lat }, frame.sun) },
    })),
  };
}

export const auroraLayer = (options: AuroraOptions = {}): ClockLayer => {
  const url = options.url ?? "/api/aurora";
  const refreshMs = options.refreshMs ?? 10 * 60 * 1000;
  let live: AuroraPoint[] = [];
  let liveMeta: { observed?: string; credit?: string } = {};
  let fetchedAt = 0;
  let fetching = false;
  let failed = false;
  let visible = true;
  let drawnKey = "";
  let lastCtx: LayerContext | null = null;
  let lastFrame: Frame | null = null;
  let status: AuroraStatus["mode"] | "" = "";

  const liveness = (frame: Frame) => {
    const gap = Math.abs(frame.date.getTime() - Date.now());
    return gap <= LIVE_MS ? 1 : Math.max(0, 1 - (gap - LIVE_MS) / FADE_MS);
  };

  function report(mode: AuroraStatus["mode"], force = false) {
    if (mode === status && !force) return;
    status = mode;
    options.onStatus?.({ mode, ...(mode === "live" ? { ...liveMeta, points: live } : {}) });
  }

  async function refresh() {
    if (fetching || !visible || Date.now() - fetchedAt < refreshMs) return;
    fetching = true;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      live = body.points ?? [];
      liveMeta = { observed: body.observed, credit: body.credit };
      failed = false;
    } catch {
      failed = true;
    } finally {
      fetchedAt = Date.now();
      fetching = false;
      drawnKey = "";
      if (lastCtx && lastFrame) draw(lastCtx, lastFrame);
      if (status === "live") report("live", true);
    }
  }

  function draw(ctx: LayerContext, frame: Frame) {
    lastCtx = ctx;
    lastFrame = frame;
    const l = liveness(frame);
    // Redraw when the minute of the frame or the live weight moves on.
    const key = `${Math.round(frame.date.getTime() / 300000)}|${l.toFixed(2)}|${live.length}`;
    if (key === drawnKey) return;
    drawnKey = key;
    const liveOn = l > 0 && live.length > 0 && !failed;
    setSource(ctx, "aurora-live", weighted(liveOn ? live : [], frame));
    const typical = !liveOn || l < 1;
    setSource(ctx, "aurora-typical", weighted(typical ? typicalAurora(frame.date, frame.sun) : [], frame));
    setSource(ctx, "aurora-typical-edge", {
      type: "FeatureCollection",
      features: typical
        ? typicalOvalEdges(frame.date, frame.sun).map((ring) => ({
            type: "Feature",
            geometry: { type: "LineString", coordinates: ring },
            properties: {},
          }))
        : [],
    });
    const liveWeight = liveOn ? l : 0;
    ctx.map.setPaintProperty(ctx.id("aurora-live"), "heatmap-opacity", 0.9 * liveWeight);
    ctx.map.setPaintProperty(ctx.id("aurora-typical"), "heatmap-opacity", 0.55 * (1 - liveWeight));
    ctx.map.setPaintProperty(ctx.id("aurora-typical-edge"), "line-opacity", 0.55 * (1 - liveWeight));
    report(liveOn && l >= 0.5 ? "live" : failed && l > 0 ? "unavailable" : "typical");
    if (l > 0) void refresh();
  }

  function paint(ctx: LayerContext) {
    const { aurora, moon } = ctx.palette;
    const m = ctx.map;
    m.setPaintProperty(ctx.id("aurora-live"), "heatmap-color", [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(0,0,0,0)",
      0.1,
      withAlpha(aurora, 0.08),
      0.4,
      withAlpha(aurora, 0.3),
      0.8,
      withAlpha(aurora, 0.55),
      1,
      withAlpha(aurora, 0.7),
    ]);
    // Typical: the same shape in moonlight grey, so it never passes for tonight's.
    m.setPaintProperty(ctx.id("aurora-typical"), "heatmap-color", [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(0,0,0,0)",
      0.2,
      withAlpha(moon, 0.12),
      1,
      withAlpha(moon, 0.4),
    ]);
    m.setPaintProperty(ctx.id("aurora-typical-edge"), "line-color", moon);
  }

  const heat = (id: string) => ({
    id,
    type: "heatmap" as const,
    paint: {
      "heatmap-weight": ["get", "w"],
      "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 0, 6, 3, 18, 6, 50],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.55, 3, 0.7, 6, 0.9],
      "heatmap-opacity": 0,
    },
  });

  return {
    key: "aurora",
    label: "The aurora",

    add(ctx, frame) {
      drawnKey = "";
      status = "";
      setSource(ctx, "aurora-live", { type: "FeatureCollection", features: [] });
      setSource(ctx, "aurora-typical", { type: "FeatureCollection", features: [] });
      setSource(ctx, "aurora-typical-edge", { type: "FeatureCollection", features: [] });
      const b = before(ctx);
      ctx.map.addLayer({ ...heat(ctx.id("aurora-typical")), source: ctx.id("aurora-typical") } as never, b);
      ctx.map.addLayer(
        {
          id: ctx.id("aurora-typical-edge"),
          type: "line",
          source: ctx.id("aurora-typical-edge"),
          paint: { "line-width": 1, "line-dasharray": [2, 3], "line-opacity": 0 },
        },
        b,
      );
      ctx.map.addLayer({ ...heat(ctx.id("aurora-live")), source: ctx.id("aurora-live") } as never, b);
      paint(ctx);
      draw(ctx, frame);
    },

    update(ctx, frame) {
      draw(ctx, frame);
    },

    applyPalette(ctx) {
      paint(ctx);
    },

    setVisible(ctx, v) {
      visible = v;
      setVisibility(ctx, LAYERS, v);
      if (v && lastFrame) void refresh();
    },

    remove(ctx) {
      removeAll(ctx, LAYERS, SOURCES);
      drawnKey = "";
    },
  };
};

