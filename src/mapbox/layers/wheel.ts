/**
 * The wheel of the year on the globe: a loop around the sun, along its
 * seasonal lane, with the eight turnings marked on it.
 *
 * Each turning sits at the latitude the sun stands over at that moment (on
 * the equator at the equinoxes, on a tropic at the solstices, partway at the
 * cross-quarters), spread east and west of the sun so the eight form a wheel
 * that travels with the sun. The year runs around it sunwise for the north:
 * the March equinox to the west, the June solstice at the top, the September
 * equinox to the east, the December solstice at the bottom. A small hand on
 * the loop, level with the sun, shows where the year is now.
 *
 * Every marker carries two names, because the wheel turns opposite in each
 * hemisphere: the northern name above it, the southern below (when the north
 * is at Beltane, the south is at Samhain). The names are those of the
 * Celtic/European wheel tradition, and the caption says so.
 */

import type { ExpressionSpecification } from "mapbox-gl";
import { TURNINGS, turningDeclination, wrapLng, type FeatureCollection, type Position } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

/** Half the wheel's width, in degrees of longitude. */
const SPREAD = 40;

/** Where on the wheel the sun's longitude `lambda` falls, around a centre longitude. */
export function wheelPoint(centre: number, lambda: number, obliquity = 23.44): Position {
  return [centre - SPREAD * Math.cos((lambda * Math.PI) / 180), turningDeclination(lambda, obliquity)];
}

type WheelProps = { part: "loop" | "mark" | "hand" | "caption"; kind?: string; north?: string; south?: string; id?: string };
type WheelFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: Position } | { type: "LineString"; coordinates: Position[] };
  properties: WheelProps;
};

/** The wheel for a moment: the loop, its eight marks, the hand, and the caption naming the tradition. */
export function wheelFeatures(frame: Frame): FeatureCollection<WheelFeature> {
  const centre = frame.sun.subsolar.lng;
  const eps = frame.sun.obliquity;
  const loop: Position[] = [];
  for (let l = 0; l <= 360; l += 4) loop.push(wheelPoint(centre, l, eps));
  const point = (p: Position): { type: "Point"; coordinates: Position } => ({ type: "Point", coordinates: [wrapLng(p[0]), p[1]] });
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "LineString", coordinates: loop }, properties: { part: "loop" } },
      ...TURNINGS.map(
        (t): WheelFeature => ({
          type: "Feature",
          geometry: point(wheelPoint(centre, t.longitude, eps)),
          properties: { part: "mark", kind: t.kind, north: t.north.name, south: t.south.name, id: t.id },
        }),
      ),
      { type: "Feature", geometry: point(wheelPoint(centre, frame.sun.eclipticLongitude, eps)), properties: { part: "hand" } },
      { type: "Feature", geometry: point([centre, -eps - 9]), properties: { part: "caption" } },
    ],
  };
}

const LAYERS = ["wheel-loop", "wheel-hand-glow", "wheel-marks", "wheel-hand", "wheel-north", "wheel-south", "wheel-caption"];

export const wheelLayer = (): ClockLayer => {
  const SOURCE = "wheel";

  function paint(ctx: LayerContext) {
    const { day, dusk, ink, glow } = ctx.palette;
    const m = ctx.map;
    m.setPaintProperty(ctx.id("wheel-loop"), "line-color", dusk);
    m.setPaintProperty(ctx.id("wheel-marks"), "circle-color", ["match", ["get", "kind"], "solstice", day, "equinox", glow, "#fbf6ea"] as ExpressionSpecification);
    m.setPaintProperty(ctx.id("wheel-marks"), "circle-stroke-color", dusk);
    m.setPaintProperty(ctx.id("wheel-hand"), "circle-color", day);
    m.setPaintProperty(ctx.id("wheel-hand-glow"), "circle-color", glow);
    for (const id of ["wheel-north", "wheel-south", "wheel-caption"]) {
      // Northern names in the deep dusk of the wheel, southern in ink, so the two read apart.
      m.setPaintProperty(ctx.id(id), "text-color", id === "wheel-north" ? dusk : ink);
      m.setPaintProperty(ctx.id(id), "text-halo-color", "rgba(251,246,234,0.9)");
    }
  }

  const label = (field: "north" | "south"): Record<string, unknown> => ({
    "text-field": ["get", field],
    "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 0, 12, 4, 15],
    "text-letter-spacing": 0.04,
    // Northern names sit above the marker, southern below.
    "text-anchor": field === "north" ? "bottom" : "top",
    "text-offset": [0, field === "north" ? -0.55 : 0.55],
    "text-allow-overlap": true,
    "text-ignore-placement": true,
  });

  return {
    key: "wheel-marks",
    label: "The wheel of the year",

    add(ctx, frame) {
      setSource(ctx, SOURCE, wheelFeatures(frame));
      const b = before(ctx);
      const src = ctx.id(SOURCE);
      const is = (part: string): ExpressionSpecification => ["==", ["get", "part"], part];
      ctx.map.addLayer({ id: ctx.id("wheel-loop"), type: "line", source: src, filter: is("loop"), paint: { "line-width": 1.2, "line-opacity": 0.55, "line-dasharray": [2, 2] } }, b);
      ctx.map.addLayer({ id: ctx.id("wheel-hand-glow"), type: "circle", source: src, filter: is("hand"), paint: { "circle-radius": 11, "circle-blur": 1, "circle-opacity": 0.6 } }, b);
      ctx.map.addLayer(
        {
          id: ctx.id("wheel-marks"),
          type: "circle",
          source: src,
          filter: is("mark"),
          paint: {
            "circle-radius": ["match", ["get", "kind"], "solstice", 5, "equinox", 4.5, 3.5],
            "circle-stroke-width": 1.4,
          },
        },
        b,
      );
      ctx.map.addLayer({ id: ctx.id("wheel-hand"), type: "circle", source: src, filter: is("hand"), paint: { "circle-radius": 3, "circle-stroke-width": 1.5, "circle-stroke-color": "#fbf6ea" } }, b);
      for (const field of ["north", "south"] as const) {
        ctx.map.addLayer(
          {
            id: ctx.id(`wheel-${field}`),
            type: "symbol",
            source: src,
            filter: is("mark"),
            layout: label(field) as never,
            paint: { "text-halo-width": 2, "text-halo-blur": 0.3, "text-opacity": field === "north" ? 1 : 0.9 },
          },
        );
      }
      ctx.map.addLayer(
        {
          id: ctx.id("wheel-caption"),
          type: "symbol",
          source: src,
          filter: is("caption"),
          layout: {
            "text-field": "The Celtic/European wheel\nnorthern names above · southern below",
            "text-font": ["DIN Pro Italic", "Arial Unicode MS Regular"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 0, 9.5, 4, 12],
            "text-anchor": "top",
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-halo-width": 1.8, "text-opacity": 0.85 },
        },
      );
      paint(ctx);
    },

    update(ctx, frame) {
      setSource(ctx, SOURCE, wheelFeatures(frame));
    },

    applyPalette(ctx) {
      paint(ctx);
    },

    setVisible(ctx, visible) {
      setVisibility(ctx, LAYERS, visible);
    },

    remove(ctx) {
      removeAll(ctx, LAYERS, [SOURCE]);
    },
  };
};
