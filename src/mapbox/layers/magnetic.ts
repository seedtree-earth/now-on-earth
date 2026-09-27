/**
 * The Earth's body: its magnetic field, and its wandering magnetic poles.
 * Both draw on an overlay that follows the globe (see overlay.ts), because
 * field lines rise into space and the north magnetic pole now sits past 85°N,
 * beyond the reach of web map tiles.
 *
 * - Field lines: a small set traced from the World Magnetic Model 2025, drawn
 *   as fine threads with a slow drift along them, fading with height.
 * - Pole trail: where the north and south magnetic poles have wandered since
 *   1925 (NOAA NCEI, from IGRF), fading into the past, today's positions
 *   marked, with the geographic poles beside them so the gap shows.
 */

import type { Map as MapboxMap } from "mapbox-gl";
import { type FieldLine, type Vec3, fieldLines, magneticPoleTrails, toXYZ } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { globeView, overlayCanvas, zoomFade } from "./overlay.js";

type Overlay = ReturnType<typeof overlayCanvas>;

/** Shared plumbing: a canvas that redraws with the map and on the clock's ticks. */
function overlayLayer(
  key: string,
  label: string,
  draw: (g: CanvasRenderingContext2D, view: NonNullable<ReturnType<typeof globeView>>, ctx: LayerContext, now: number) => void,
  onFrame?: (frame: Frame) => void,
): ClockLayer {
  let overlay: Overlay | null = null;
  let map: MapboxMap | null = null;
  let visible = true;
  let lastCtx: LayerContext | null = null;

  const render = (now = performance.now()) => {
    if (!overlay || !map || !lastCtx) return;
    const { w, h } = overlay.resize();
    overlay.ctx2d.clearRect(0, 0, w, h);
    if (!visible) return;
    const view = globeView(map);
    if (!view || zoomFade(view.zoom) <= 0) return;
    overlay.ctx2d.save();
    overlay.ctx2d.globalAlpha = zoomFade(view.zoom);
    draw(overlay.ctx2d, view, lastCtx, now);
    overlay.ctx2d.restore();
  };
  const onRender = () => render();

  return {
    key,
    label,
    add(ctx, frame) {
      map = ctx.map;
      lastCtx = ctx;
      overlay = overlayCanvas(ctx.map, `noe-overlay noe-${key}`);
      onFrame?.(frame);
      ctx.map.on("render", onRender);
      render();
    },
    update(ctx, frame) {
      lastCtx = ctx;
      onFrame?.(frame);
      render();
    },
    applyPalette(ctx) {
      lastCtx = ctx;
      render();
    },
    setVisible(_ctx, v) {
      visible = v;
      if (overlay) overlay.canvas.style.display = v ? "" : "none";
      render();
    },
    tick(_ctx, now) {
      render(now);
    },
    remove(ctx) {
      ctx.map.off("render", onRender);
      overlay?.canvas.remove();
      overlay = null;
    },
  };
}

// ------------------------------------------------------------ field lines

export const magneticFieldLayer = (): ClockLayer => {
  let lines: FieldLine[] = [];
  let tracedFor = -1;

  return overlayLayer(
    "magnetic-field",
    "The magnetic field",
    (g, view, ctx, now) => {
      const colour = ctx.palette.field;
      g.lineCap = "round";
      g.lineJoin = "round";
      for (const line of lines) {
        const height = Math.max(0.05, line.apex - 1);
        // A faint thread, and a slow drift of light along it.
        for (const pass of ["thread", "drift"] as const) {
          g.beginPath();
          let drawing = false;
          for (const p of line.points) {
            const s = view.project(p);
            if (!s.visible) {
              drawing = false;
              continue;
            }
            if (!drawing) g.moveTo(s.x, s.y);
            else g.lineTo(s.x, s.y);
            drawing = true;
          }
          g.strokeStyle = colour;
          if (pass === "thread") {
            g.setLineDash([]);
            g.lineWidth = 1;
            g.save();
            g.globalAlpha = g.globalAlpha * (0.22 + 0.2 / (1 + height));
            g.stroke();
            g.restore();
          } else {
            g.save();
            g.setLineDash([3, 14]);
            g.lineDashOffset = ctx.reducedMotion ? 0 : -((now / 90) % 17);
            g.lineWidth = 1.4;
            g.globalAlpha = g.globalAlpha * 0.55;
            g.stroke();
            g.restore();
          }
        }
      }
    },
    (frame) => {
      // The field changes by a hair a year; trace once per year shown.
      const year = frame.date.getUTCFullYear();
      if (year !== tracedFor) {
        // A calm few: two rings of footpoints, every 60° of magnetic longitude.
        lines = fieldLines(frame.date, { latitudes: [36, 46], spacing: 60 });
        tracedFor = year;
      }
    },
  );
};

// ------------------------------------------------------------ pole trail

export const magneticPolesLayer = (): ClockLayer => {
  const trails = magneticPoleTrails();
  const LIFT = 1.002;

  /** A small word beside a mark, ink on a paper halo so it reads on land, sea or sky. */
  const label = (g: CanvasRenderingContext2D, text: string, x: number, y: number, ctx: LayerContext, side: "left" | "right") => {
    g.save();
    g.font = 'italic 12.5px "Fraunces", Georgia, serif';
    g.textBaseline = "middle";
    g.textAlign = side === "right" ? "left" : "right";
    const tx = side === "right" ? x + 10 : x - 10;
    g.lineJoin = "round";
    g.lineWidth = 3.5;
    g.strokeStyle = ctx.palette.paper;
    g.globalAlpha *= 0.85;
    g.strokeText(text, tx, y);
    g.globalAlpha = Math.min(1, g.globalAlpha / 0.85);
    g.fillStyle = ctx.palette.ink;
    g.fillText(text, tx, y);
    g.restore();
  };

  /** A faint great-circle arc between two surface points. */
  const arc = (a: Vec3, b: Vec3, steps = 24): Vec3[] => {
    const out: Vec3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = [0, 1, 2].map((k) => a[k] * (1 - t) + b[k] * t) as Vec3;
      const l = Math.hypot(...p) / LIFT;
      out.push(p.map((x) => x / l) as Vec3);
    }
    return out;
  };

  return overlayLayer("magnetic-poles", "Magnetic north's wandering", (g, view, ctx) => {
    const { field, ink } = ctx.palette;
    for (const [trail, magName, geoName, geoLat] of [
      [trails.north, "magnetic north", "north", 90],
      [trails.south, "magnetic south", "south", -90],
    ] as const) {
      // The trail, fading into the past.
      const first = trail[0].year;
      const span = trail[trail.length - 1].year - first || 1;
      g.lineCap = "round";
      for (let i = 1; i < trail.length; i++) {
        const a = view.project(toXYZ(trail[i - 1].lat, trail[i - 1].lng, LIFT));
        const b = view.project(toXYZ(trail[i].lat, trail[i].lng, LIFT));
        if (!a.visible || !b.visible) continue;
        const age = (trail[i].year - first) / span; // 0 oldest, 1 today
        g.save();
        g.globalAlpha *= 0.12 + 0.8 * age * age;
        g.strokeStyle = field;
        g.lineWidth = 1 + 1.6 * age;
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
        g.restore();
      }

      // Today's magnetic pole, and the geographic pole with the gap between.
      const now = trail[trail.length - 1];
      const mag = toXYZ(now.lat, now.lng, LIFT);
      const geo = toXYZ(geoLat, 0, LIFT);
      g.save();
      g.setLineDash([2, 4]);
      g.strokeStyle = ink;
      g.globalAlpha *= 0.45;
      g.lineWidth = 1;
      g.beginPath();
      let on = false;
      for (const p of arc(geo, mag)) {
        const s = view.project(p);
        if (!s.visible) {
          on = false;
          continue;
        }
        if (!on) g.moveTo(s.x, s.y);
        else g.lineTo(s.x, s.y);
        on = true;
      }
      g.stroke();
      g.restore();

      const m = view.project(mag);
      if (m.visible) {
        g.save();
        const halo = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, 14);
        halo.addColorStop(0, field);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha *= 0.6;
        g.fillStyle = halo;
        g.beginPath();
        g.arc(m.x, m.y, 14, 0, 2 * Math.PI);
        g.fill();
        g.restore();
        g.save();
        g.fillStyle = field;
        g.strokeStyle = "#fbf6ea";
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(m.x, m.y, 4.5, 0, 2 * Math.PI);
        g.fill();
        g.stroke();
        g.restore();
        const gp = view.project(geo);
        label(g, magName, m.x, m.y, ctx, m.x >= gp.x ? "right" : "left");
      }
      const p = view.project(geo);
      if (p.visible) {
        g.save();
        g.strokeStyle = ink;
        g.globalAlpha *= 0.8;
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        g.moveTo(p.x - 7, p.y);
        g.lineTo(p.x + 7, p.y);
        g.moveTo(p.x, p.y - 7);
        g.lineTo(p.x, p.y + 7);
        g.stroke();
        g.restore();
        const mp = view.project(mag);
        label(g, geoName, p.x, p.y, ctx, p.x > mp.x ? "right" : "left");
      }
    }
  });
};
