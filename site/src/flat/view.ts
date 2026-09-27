/**
 * The flat model, drawn: a North-Pole-centred azimuthal equidistant disc on
 * a canvas, with Antarctica around the rim and the sun as a circling
 * spotlight. It takes the globe's place when switched on and follows the same
 * controls. Standalone site only; not part of the Landscape integration.
 *
 * It uses no Mapbox and no token: land outlines are Natural Earth (via
 * world-atlas), loaded the first time the view is shown.
 */

import { geoAzimuthalEquidistant, geoPath, type GeoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { LngLat, SunState } from "now-on-earth/core";
import { type Palette, readPalette } from "now-on-earth/mapbox";
import { SPOTLIGHT_REACH, flatDayShare } from "./model";

const RAD = Math.PI / 180;

export type FlatFrame = { sun: SunState; viewer: LngLat; lines: boolean };

export type FlatView = {
  /** Show the disc (loads land outlines the first time). */
  show(): Promise<void>;
  hide(): void;
  isShown(): boolean;
  draw(frame: FlatFrame): void;
  /** Turn the disc so the viewer sits at the bottom, nearest the dock. */
  faceMe(): void;
  /** Keep the sun at the bottom as it circles, or stop. */
  follow(on: boolean): void;
  following(): boolean;
  /** Room taken by the words above and the dock below. */
  setPadding(p: { top: number; bottom: number }): void;
  refreshPalette(): void;
};

type Colours = Palette & { ocean: string; land: string };

function colours(): Colours {
  const p = readPalette();
  return p.dark
    ? { ...p, ocean: "#10212e", land: "#3d5a3d" }
    : { ...p, ocean: "#2c4b5e", land: "#7b8a5e" };
}

/** Composite a colour at an opacity (canvas takes any CSS colour via globalAlpha). */
function fillWith(g: CanvasRenderingContext2D, colour: string, alpha: number, path: () => void, rule: CanvasFillRule = "nonzero") {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = colour;
  g.beginPath();
  path();
  g.fill(rule);
  g.restore();
}


export function createFlatView(container: HTMLElement): FlatView {
  const canvas = document.createElement("canvas");
  canvas.className = "flat";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Flat model");
  canvas.setAttribute("aria-describedby", "light-words");
  canvas.hidden = true;
  const credit = document.createElement("p");
  credit.className = "flat-credit";
  credit.hidden = true;
  credit.innerHTML = 'Land: <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a>';
  container.append(canvas, credit);
  const g = canvas.getContext("2d")!;

  let shown = false;
  let land: GeoJSON.FeatureCollection | GeoJSON.Feature | null = null;
  let rotation = 0; // degrees of longitude the disc is turned by
  let followSun = false;
  let padding = { top: 0, bottom: 0 };
  let frame: FlatFrame | null = null;
  let pal = colours();
  let pending = 0;
  const landCache = document.createElement("canvas");
  let landKey = "";
  let faceOnFirstDraw = true;

  // ---------------------------------------------------------- layout

  function layout() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const room = Math.max(160, Math.min(w, h - padding.top - padding.bottom));
    const discR = room * 0.46;
    const cx = w / 2;
    const cy = padding.top + (h - padding.top - padding.bottom) / 2;
    return { w, h, cx, cy, discR, scale: discR / Math.PI };
  }

  function projection(): GeoProjection {
    const { cx, cy, scale } = layout();
    return geoAzimuthalEquidistant()
      .rotate([rotation, -90])
      .clipAngle(179.9)
      .scale(scale)
      .translate([cx, cy])
      .precision(0.5);
  }

  /** Screen angle (radians) of a longitude around the centre, at the current rotation. */
  function screenAngle(lng: number): number {
    const { cx, cy } = layout();
    const p = projection()([lng, 0])!;
    return Math.atan2(p[1] - cy, p[0] - cx);
  }

  /** Turn so that a longitude sits straight below the centre. */
  function turnTo(lng: number) {
    const a = screenAngle(lng);
    const b = screenAngle(lng + 1);
    const perDegree = Math.atan2(Math.sin(b - a), Math.cos(b - a)); // ± one degree, in radians
    const want = Math.PI / 2;
    const delta = Math.atan2(Math.sin(want - a), Math.cos(want - a));
    rotation += delta / perDegree;
  }

  // ---------------------------------------------------------- drawing

  function drawLand(proj: GeoProjection, w: number, h: number, dpr: number) {
    const key = [rotation.toFixed(2), w, h, dpr, pal.dark, !!land].join("|");
    if (key === landKey) return;
    landKey = key;
    landCache.width = w * dpr;
    landCache.height = h * dpr;
    const lg = landCache.getContext("2d")!;
    lg.setTransform(dpr, 0, 0, dpr, 0, 0);
    lg.clearRect(0, 0, w, h);
    if (!land) return;
    lg.fillStyle = pal.land;
    lg.beginPath();
    geoPath(proj, lg)(land as GeoJSON.FeatureCollection);
    lg.fill();
  }

  function render() {
    pending = 0;
    if (!shown || !frame) return;
    const { sun, viewer, lines } = frame;
    if (followSun) turnTo(sun.subsolar.lng);
    else if (faceOnFirstDraw) turnTo(viewer.lng);
    faceOnFirstDraw = false;

    const dpr = window.devicePixelRatio || 1;
    const { w, h, cx, cy, discR, scale } = layout();
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const proj = projection();
    const px = (deg: number) => deg * RAD * scale; // degrees of arc on the plan → pixels
    const disc = () => g.arc(cx, cy, discR, 0, 2 * Math.PI);
    const [sx, sy] = proj([sun.subsolar.lng, sun.subsolar.lat])!;

    // The disc and its soft rim.
    g.save();
    g.shadowColor = pal.dark ? "rgba(0,0,0,0.6)" : "rgba(30,40,30,0.25)";
    g.shadowBlur = 40;
    fillWith(g, pal.ocean, 1, disc);
    g.restore();

    // Everything else stays on the disc.
    g.save();
    g.beginPath();
    disc();
    g.clip();

    drawLand(proj, w, h, dpr);
    g.drawImage(landCache, 0, 0, w, h);

    // The spotlight: light that pales toward the sun and thins toward its
    // reach, like the globe's rings, with faint rings at each sixth of it.
    const reach = px(SPOTLIGHT_REACH);
    const light = g.createRadialGradient(sx, sy, 0, sx, sy, reach);
    light.addColorStop(0, pal.glow);
    light.addColorStop(0.35, pal.day);
    light.addColorStop(1, pal.day);
    g.save();
    g.globalAlpha = pal.dark ? 0.34 : 0.28;
    g.fillStyle = light;
    g.beginPath();
    g.arc(sx, sy, reach, 0, 2 * Math.PI);
    g.fill();
    g.globalAlpha = pal.dark ? 0.22 : 0.18;
    g.strokeStyle = pal.day;
    g.lineWidth = 0.8;
    for (let k = 1; k <= 6; k++) {
      g.beginPath();
      g.arc(sx, sy, (reach * k) / 6, 0, 2 * Math.PI);
      g.stroke();
    }
    g.restore();

    // Night: everywhere the light does not reach, with a short soft edge.
    const grad = g.createRadialGradient(sx, sy, Math.max(0, reach - px(3)), sx, sy, reach + px(3));
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, pal.night);
    g.save();
    g.globalAlpha = pal.dark ? 0.62 : 0.55;
    g.fillStyle = grad;
    g.beginPath();
    disc();
    g.fill();
    g.restore();

    if (lines) {
      const circle = (lat: number) => () => g.arc(cx, cy, px(90 - lat), 0, 2 * Math.PI);
      g.save();
      g.strokeStyle = pal.day;
      g.lineWidth = 1.1;
      g.globalAlpha = 0.7;
      g.setLineDash([4, 4]);
      for (const lat of [sun.obliquity, -sun.obliquity]) {
        g.beginPath();
        circle(lat)();
        g.stroke();
      }
      g.setLineDash([0.5, 4]);
      g.lineCap = "round";
      g.lineWidth = 1.8;
      g.globalAlpha = 0.85;
      g.beginPath();
      circle(sun.declination)();
      g.stroke();
      g.restore();

      // The viewer's own circle, bright where the light reaches it today.
      const a = 90 - viewer.lat;
      const share = flatDayShare(viewer.lat, sun.declination);
      const sunAngle = Math.atan2(sy - cy, sx - cx);
      g.save();
      g.strokeStyle = pal.me;
      g.lineWidth = 1.4;
      g.globalAlpha = 0.35;
      g.beginPath();
      g.arc(cx, cy, px(a), 0, 2 * Math.PI);
      g.stroke();
      if (share > 0) {
        g.globalAlpha = 0.95;
        g.lineWidth = 2.2;
        g.beginPath();
        if (share >= 1) g.arc(cx, cy, px(a), 0, 2 * Math.PI);
        else g.arc(cx, cy, px(a), sunAngle - share * Math.PI, sunAngle + share * Math.PI);
        g.stroke();
      }
      g.restore();
    }

    g.restore(); // end disc clip

    // The rim.
    g.save();
    g.strokeStyle = pal.dark ? "rgba(233,230,215,0.25)" : "rgba(28,35,26,0.2)";
    g.lineWidth = 1;
    g.beginPath();
    disc();
    g.stroke();
    g.restore();

    // The sun, above the disc.
    g.save();
    const halo = g.createRadialGradient(sx, sy, 0, sx, sy, 22);
    halo.addColorStop(0, pal.day);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 0.55;
    g.fillStyle = halo;
    g.beginPath();
    g.arc(sx, sy, 22, 0, 2 * Math.PI);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = pal.day;
    g.strokeStyle = "#fff6de";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(sx, sy, 6, 0, 2 * Math.PI);
    g.fill();
    g.stroke();
    g.restore();

    // Where the viewer stands.
    const [vx, vy] = proj([viewer.lng, viewer.lat])!;
    g.save();
    g.fillStyle = pal.me;
    g.strokeStyle = "#fbf6ea";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(vx, vy, 5, 0, 2 * Math.PI);
    g.fill();
    g.stroke();
    g.restore();
  }

  const schedule = () => {
    if (!pending) pending = requestAnimationFrame(render);
  };

  // ---------------------------------------------------------- turning by hand

  let dragFrom: number | null = null;
  canvas.addEventListener("pointerdown", (e) => {
    const { cx, cy } = layout();
    dragFrom = Math.atan2(e.offsetY - cy, e.offsetX - cx);
    canvas.setPointerCapture(e.pointerId);
    followSun = false;
    canvas.dispatchEvent(new CustomEvent("flat:release", { bubbles: true }));
  });
  canvas.addEventListener("pointermove", (e) => {
    if (dragFrom === null) return;
    const { cx, cy } = layout();
    const now = Math.atan2(e.offsetY - cy, e.offsetX - cx);
    const a = screenAngle(0);
    const b = screenAngle(1);
    const perDegree = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    const d = Math.atan2(Math.sin(now - dragFrom), Math.cos(now - dragFrom));
    rotation += d / perDegree;
    dragFrom = now;
    schedule();
  });
  const end = () => (dragFrom = null);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  new ResizeObserver(schedule).observe(container);

  return {
    async show() {
      if (!land) {
        type Topo = Parameters<typeof feature>[0];
        const topo = (await import("world-atlas/land-50m.json")).default as unknown as Topo;
        const objects = topo.objects as unknown as Record<string, Parameters<typeof feature>[1]>;
        land = feature(topo, objects.land) as GeoJSON.Feature;
        landKey = "";
      }
      shown = true;
      canvas.hidden = false;
      credit.hidden = false;
      pal = colours();
      schedule();
    },
    hide() {
      shown = false;
      canvas.hidden = true;
      credit.hidden = true;
    },
    isShown: () => shown,
    draw(f) {
      frame = f;
      schedule();
    },
    faceMe() {
      followSun = false;
      if (frame) turnTo(frame.viewer.lng);
      schedule();
    },
    follow(on) {
      followSun = on;
      schedule();
    },
    following: () => followSun,
    setPadding(p) {
      padding = p;
      landKey = "";
      schedule();
    },
    refreshPalette() {
      pal = colours();
      landKey = "";
      schedule();
    },
  };
}
