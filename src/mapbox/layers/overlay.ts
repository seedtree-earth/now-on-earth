/**
 * A light 2D overlay that follows the globe, for things Mapbox's layers
 * cannot draw: lines that rise off the surface into space, and points past
 * 85° of latitude, where web map tiles end.
 *
 * Each frame it measures the globe from the map itself: where the view's
 * centre lands on screen, and where two points 60° away (toward screen-up and
 * screen-right) land. From those three it builds an affine view of the sphere,
 * exact for an orthographic globe and close for Mapbox's gentle perspective at
 * the zoom levels where the overlay shows. Points behind the globe are hidden.
 */

import type { Map as MapboxMap } from "mapbox-gl";
import { type Vec3, toXYZ } from "../../core/index.js";

const RAD = Math.PI / 180;
const S60 = Math.sin(60 * RAD);

export type GlobeView = {
  /** Screen position of a point in Earth radii (x toward 0°E, y toward 90°E, z north), and whether it can be seen. */
  project(p: Vec3): { x: number; y: number; visible: boolean };
  zoom: number;
};

function unit(v: Vec3): Vec3 {
  const l = Math.hypot(...v);
  return v.map((x) => x / l) as Vec3;
}
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const toLngLat = (p: Vec3): [number, number] => [Math.atan2(p[1], p[0]) / RAD, Math.asin(p[2] / Math.hypot(...p)) / RAD];

export function globeView(map: MapboxMap): GlobeView | null {
  const c = map.getCenter();
  const toward = toXYZ(c.lat, c.lng);
  // Local north and east at the centre.
  const la = c.lat * RAD;
  const lo = c.lng * RAD;
  const north: Vec3 = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const east: Vec3 = [-Math.sin(lo), Math.cos(lo), 0];
  // Screen-up on the globe is north turned by the map's bearing.
  const b = map.getBearing() * RAD;
  const up3 = unit([0, 1, 2].map((i) => Math.cos(b) * north[i] + Math.sin(b) * east[i]) as Vec3);
  const right3 = unit([0, 1, 2].map((i) => Math.cos(b) * east[i] - Math.sin(b) * north[i]) as Vec3);

  const at60 = (dir: Vec3) => toLngLat([0, 1, 2].map((i) => 0.5 * toward[i] + S60 * dir[i]) as Vec3);
  const C = map.project([c.lng, c.lat]);
  const U = map.project(at60(up3));
  const R = map.project(at60(right3));
  if (![C, U, R].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  const ux = (U.x - C.x) / S60;
  const uy = (U.y - C.y) / S60;
  const rx = (R.x - C.x) / S60;
  const ry = (R.y - C.y) / S60;

  return {
    zoom: map.getZoom(),
    project(p) {
      const a = dot(p, right3);
      const bb = dot(p, up3);
      const z = dot(p, toward);
      // Behind the globe if it is on the far side and inside the disc.
      const visible = z >= 0 || a * a + bb * bb > 1;
      return { x: C.x + a * rx + bb * ux, y: C.y + a * ry + bb * uy, visible };
    },
  };
}

/** A canvas over the map, sized to it, for one overlay module. */
export function overlayCanvas(map: MapboxMap, className: string): { canvas: HTMLCanvasElement; ctx2d: CanvasRenderingContext2D; resize(): { w: number; h: number } } {
  const canvas = document.createElement("canvas");
  canvas.className = className;
  Object.assign(canvas.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "1" });
  map.getContainer().append(canvas);
  const ctx2d = canvas.getContext("2d")!;
  return {
    canvas,
    ctx2d,
    resize() {
      const el = map.getContainer();
      const w = el.clientWidth;
      const h = el.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    },
  };
}

/** Overlays show while the whole globe is in view and fade as it fills the screen. */
export const zoomFade = (zoom: number) => Math.max(0, Math.min(1, (3.3 - zoom) / 1.2));
