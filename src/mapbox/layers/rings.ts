/**
 * The light's own layers, each its own switch:
 *
 * - Day light: gold caps around the sun every hour band (15°, or 5° in fine
 *   mode) out to the terminator, stacked so the light deepens toward the sun
 *   and pales from gold to a warm white glow as it nears it.
 * - Night shade: violet caps around the antisolar point, deepening toward
 *   local midnight.
 * - Hour rings: the hairline edges of the bands (the terminator firmest; in
 *   fine mode the hour rings stay firmer than the steps between).
 * - Hour numbers: a small count in each hour band, 1 to 6 outward from the
 *   sun through the day and 7 to 12 across the night to midnight, so the
 *   difference between two places' numbers is their difference in hours.
 *
 * The three that share ring geometry share one computation per frame.
 */

import { type RingFeature, type RingEdgeFeature, type FeatureCollection, rings, stackedOpacity } from "../../core/index.js";
import type { ExpressionSpecification } from "mapbox-gl";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

/** How deep the stacked light gets at the centre of each side. */
const PEAK = {
  light: { day: 0.42, night: 0.5 },
  dark: { day: 0.5, night: 0.62 },
};

type RingData = {
  day: { fills: FeatureCollection<RingFeature>; edges: FeatureCollection<RingEdgeFeature> };
  night: { fills: FeatureCollection<RingFeature>; edges: FeatureCollection<RingEdgeFeature> };
};

/** One ring computation per moment and spacing, shared by the ring layers. */
let memo: { key: string; data: RingData } | null = null;
function ringData(frame: Frame): RingData {
  const spacing = frame.fine ? 5 : 15;
  const key = `${frame.date.getTime()}|${spacing}`;
  if (memo?.key !== key) {
    memo = {
      key,
      data: {
        day: rings(frame.sun.subsolar, "day", spacing),
        night: rings(frame.sun.antisolar, "night", spacing),
      },
    };
  }
  return memo.data;
}

/** A fill layer of stacked caps for one side of the terminator. */
function fillLayer(key: string, label: string, side: "day" | "night"): ClockLayer {
  const layer = `${key}-fill`;
  const source = `${key}-fill`;
  let lastFine: boolean | null = null;

  function paint(ctx: LayerContext, fine: boolean) {
    const count = fine ? 18 : 6;
    const peak = (ctx.palette.dark ? PEAK.dark : PEAK.light)[side];
    const colour: ExpressionSpecification | string =
      side === "day"
        ? // Gold at the terminator, lifting through lab space to glow at the sun.
          (["interpolate-lab", ["linear"], ["get", "radius"], 5, ctx.palette.glow, 90, ctx.palette.day] as ExpressionSpecification)
        : ctx.palette.night;
    ctx.map.setPaintProperty(ctx.id(layer), "fill-color", colour);
    ctx.map.setPaintProperty(ctx.id(layer), "fill-opacity", stackedOpacity(count, peak));
  }

  return {
    key,
    label,
    add(ctx, frame) {
      setSource(ctx, source, ringData(frame)[side].fills);
      // Seams where caps are cut at the antimeridian would show under
      // antialiasing; the hour rings layer draws the true outlines instead.
      ctx.map.addLayer({ id: ctx.id(layer), type: "fill", source: ctx.id(source), paint: { "fill-antialias": false } }, before(ctx));
      lastFine = frame.fine;
      paint(ctx, frame.fine);
    },
    update(ctx, frame) {
      setSource(ctx, source, ringData(frame)[side].fills);
      if (frame.fine !== lastFine) {
        lastFine = frame.fine;
        paint(ctx, frame.fine);
      }
    },
    applyPalette(ctx) {
      paint(ctx, lastFine ?? false);
    },
    setVisible(ctx, visible) {
      setVisibility(ctx, [layer], visible);
    },
    remove(ctx) {
      removeAll(ctx, [layer], [source]);
      lastFine = null;
    },
  };
}

export const dayLightLayer = (): ClockLayer => fillLayer("day-light", "Daylight", "day");
export const nightShadeLayer = (): ClockLayer => fillLayer("night-shade", "Night shade", "night");

export const hourRingsLayer = (): ClockLayer => {
  const edges = (frame: Frame) => {
    const d = ringData(frame);
    return { type: "FeatureCollection", features: [...d.night.edges.features, ...d.day.edges.features] };
  };
  const paint = (ctx: LayerContext) =>
    ctx.map.setPaintProperty(ctx.id("hour-rings"), "line-color", ["match", ["get", "kind"], "day", ctx.palette.day, ctx.palette.night]);
  return {
    key: "hour-rings",
    label: "Hour rings",
    add(ctx, frame) {
      setSource(ctx, "hour-rings", edges(frame));
      ctx.map.addLayer(
        {
          id: ctx.id("hour-rings"),
          type: "line",
          source: ctx.id("hour-rings"),
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-width": ["case", ["==", ["get", "radius"], 90], 1.4, ["==", ["%", ["get", "radius"], 15], 0], 0.9, 0.5],
            "line-opacity": ["case", ["==", ["get", "radius"], 90], 0.75, ["==", ["%", ["get", "radius"], 15], 0], 0.45, 0.22],
          },
        },
        before(ctx),
      );
      paint(ctx);
    },
    update(ctx, frame) {
      setSource(ctx, "hour-rings", edges(frame));
    },
    applyPalette: paint,
    setVisible(ctx, visible) {
      setVisibility(ctx, ["hour-rings"], visible);
    },
    remove(ctx) {
      removeAll(ctx, ["hour-rings"], ["hour-rings"]);
    },
  };
};

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/**
 * Where to set each hour's number: in the middle of its band. Day bands sit
 * along the sun's own parallel, night bands along the antisolar parallel,
 * which between them reach every band on any date. On a parallel at latitude
 * φ, the point at arc distance d from the centre is at a longitude offset of
 * acos((cos d - sin²φ) / cos²φ).
 */
export function hourNumberPoints(frame: Frame) {
  const features = [];
  for (let n = 1; n <= 12; n++) {
    const day = n <= 6;
    const centre = day ? frame.sun.subsolar : frame.sun.antisolar;
    const d = day ? (n - 0.5) * 15 : (12.5 - n) * 15; // arc distance from that centre
    const phi = centre.lat * RAD;
    const c = (Math.cos(d * RAD) - Math.sin(phi) ** 2) / Math.cos(phi) ** 2;
    if (c < -1 || c > 1) continue;
    const offset = Math.acos(c) * DEG;
    for (const sign of [-1, 1]) {
      let lng = centre.lng + sign * offset;
      lng = ((((lng + 180) % 360) + 360) % 360) - 180;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, centre.lat] },
        properties: { n: String(n), side: day ? "day" : "night" },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

export const hourNumbersLayer = (): ClockLayer => {
  const paint = (ctx: LayerContext) => {
    const m = ctx.map;
    m.setPaintProperty(ctx.id("hour-numbers"), "text-color", ["match", ["get", "side"], "day", ctx.palette.ink, ctx.palette.moon]);
    m.setPaintProperty(ctx.id("hour-numbers"), "text-halo-color", [
      "match",
      ["get", "side"],
      "day",
      ctx.palette.glow,
      ctx.palette.night,
    ]);
  };
  return {
    key: "hour-numbers",
    label: "Hour numbers",
    add(ctx, frame) {
      setSource(ctx, "hour-numbers", hourNumberPoints(frame));
      ctx.map.addLayer(
        {
          id: ctx.id("hour-numbers"),
          type: "symbol",
          source: ctx.id("hour-numbers"),
          layout: {
            "text-field": ["get", "n"],
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 0, 11.5, 4, 14],
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-halo-width": 1.6, "text-halo-blur": 0.5, "text-opacity": 0.9 },
        },
        before(ctx),
      );
      paint(ctx);
    },
    update(ctx, frame) {
      setSource(ctx, "hour-numbers", hourNumberPoints(frame));
    },
    applyPalette: paint,
    setVisible(ctx, visible) {
      setVisibility(ctx, ["hour-numbers"], visible);
    },
    remove(ctx) {
      removeAll(ctx, ["hour-numbers"], ["hour-numbers"]);
    },
  };
};
