/**
 * The moon: a small disc over the sublunar point, drawn in its true phase,
 * with a faint halo of moonlight. The disc is drawn as the viewer would see
 * it: lit on the right while waxing from the northern hemisphere, and mirrored
 * for someone standing in the south.
 */

import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

const LAYERS = ["moon-halo", "moon-disc"];
const SOURCES = ["moon"];
const SIZE = 64; // device pixels; drawn at pixelRatio 2
const ICON = "moon-phase";

const point = (frame: Frame) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [frame.moon.sublunar.lng, frame.moon.sublunar.lat] },
  properties: {},
});

/**
 * Draw a phase: a dark disc, then the lit part bounded by the limb on one side
 * and the terminator ellipse on the other.
 */
export function drawPhase(
  illumination: number,
  litOnRight: boolean,
  colours: { lit: string; dark: string },
): ImageData | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d");
  if (!g) return null;
  const r = SIZE / 2 - 4;
  g.translate(SIZE / 2, SIZE / 2);
  if (!litOnRight) g.scale(-1, 1);

  g.beginPath();
  g.arc(0, 0, r, 0, 2 * Math.PI);
  g.fillStyle = colours.dark;
  g.globalAlpha = 0.55;
  g.fill();
  g.globalAlpha = 1;

  const f = Math.max(0, Math.min(1, illumination));
  const rx = r * Math.abs(1 - 2 * f);
  g.beginPath();
  g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); // the lit limb, top to bottom on the right
  if (f >= 0.5) g.ellipse(0, 0, rx, r, 0, Math.PI / 2, (3 * Math.PI) / 2, false); // gibbous: bulge left
  else g.ellipse(0, 0, rx, r, 0, Math.PI / 2, -Math.PI / 2, true); // crescent: hollow right
  g.closePath();
  g.fillStyle = colours.lit;
  g.shadowColor = colours.lit;
  g.shadowBlur = 6;
  g.fill();

  g.beginPath();
  g.arc(0, 0, r, 0, 2 * Math.PI);
  g.lineWidth = 1.5;
  g.strokeStyle = colours.lit;
  g.globalAlpha = 0.6;
  g.stroke();
  return g.getImageData(0, 0, SIZE, SIZE);
}

export const moonLayer = (): ClockLayer => {
  let drawnKey = "";

  function refreshIcon(ctx: LayerContext, frame: Frame, force = false) {
    // Waxing moons are lit on the right from the north; the south sees it mirrored.
    const right = frame.moon.waxing === frame.viewer.lat >= 0;
    const key = [Math.round(frame.moon.illumination * 60), right, ctx.palette.moon, ctx.palette.night].join("|");
    if (!force && key === drawnKey) return;
    const img = drawPhase(frame.moon.illumination, right, { lit: ctx.palette.moon, dark: ctx.palette.night });
    if (!img) return;
    const id = ctx.id(ICON);
    if (ctx.map.hasImage(id)) ctx.map.updateImage(id, img);
    else ctx.map.addImage(id, img, { pixelRatio: 2 });
    drawnKey = key;
  }

  let last: Frame | null = null;

  return {
    key: "moon",
    label: "The moon and its phase",

    add(ctx, frame) {
      last = frame;
      drawnKey = "";
      refreshIcon(ctx, frame, true);
      setSource(ctx, "moon", point(frame));
      const b = before(ctx);
      ctx.map.addLayer(
        {
          id: ctx.id("moon-halo"),
          type: "circle",
          source: ctx.id("moon"),
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 18, 5, 30],
            "circle-blur": 1,
            "circle-opacity": 0.35,
            "circle-pitch-alignment": "map",
          },
        },
        b,
      );
      ctx.map.addLayer(
        {
          id: ctx.id("moon-disc"),
          type: "symbol",
          source: ctx.id("moon"),
          layout: {
            "icon-image": ctx.id(ICON),
            "icon-size": ["interpolate", ["linear"], ["zoom"], 0, 0.75, 5, 1.1],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        },
        b,
      );
      this.applyPalette(ctx);
    },

    update(ctx, frame) {
      last = frame;
      refreshIcon(ctx, frame);
      setSource(ctx, "moon", point(frame));
    },

    applyPalette(ctx) {
      ctx.map.setPaintProperty(ctx.id("moon-halo"), "circle-color", ctx.palette.moon);
      if (last) refreshIcon(ctx, last, true);
    },

    setVisible(ctx, visible) {
      setVisibility(ctx, LAYERS, visible);
    },

    remove(ctx) {
      removeAll(ctx, LAYERS, SOURCES);
      if (ctx.map.hasImage(ctx.id(ICON))) ctx.map.removeImage(ctx.id(ICON));
      drawnKey = "";
    },
  };
};
