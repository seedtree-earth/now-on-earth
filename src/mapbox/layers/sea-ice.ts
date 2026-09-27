/**
 * Sea ice and snow through the year: soft white over the ice and snow of the
 * month, crossfading to the next as the year slider turns.
 *
 * The imagery is NASA's, from the Global Imagery Browse Services (GIBS), as
 * Web Mercator tiles the map loads itself. NASA colours these layers for
 * science; here they are drawn back as white:
 *
 * - Sea ice: AMSR2 sea ice concentration (GCOM-W1, 12 km). Microwave, so it
 *   sees through cloud and the polar night. Open water is transparent; any
 *   ice is drawn as one soft white.
 * - Snow: MODIS/Terra monthly average snow cover. NASA shades it yellow to red
 *   as cover grows, with the green channel falling; that channel is read back
 *   as depth of white, so snow thickens where it lies more of the month.
 *
 * Each month is shown from the most recent year GIBS holds for it (the sea
 * ice series ends in September 2025), so this is the seasonal pattern of a
 * recent year, not this week's ice.
 */

import { monthBlend } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setVisibility } from "./util.js";

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

type Product = {
  id: "snow" | "ice";
  layer: string;
  /** GoogleMapsCompatible level the layer is published to. */
  maxzoom: number;
  /** Day of the month to show (monthly products are dated the 1st). */
  day: number;
  /** The latest month GIBS holds, as [year, month]. Update when GIBS extends it. */
  latest: [number, number];
  /** Months GIBS is known to be missing, as "YYYY-MM". */
  gaps: string[];
};

export const SNOW: Product = {
  id: "snow",
  layer: "MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct",
  maxzoom: 6,
  day: 1,
  latest: [2026, 8],
  gaps: ["2016-02", "2022-10"],
};

export const ICE: Product = {
  id: "ice",
  layer: "AMSRU2_Sea_Ice_Concentration_12km",
  maxzoom: 6,
  day: 15,
  latest: [2025, 8],
  gaps: [],
};

export const GIBS_ACKNOWLEDGEMENT =
  "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).";

const pad = (n: number) => String(n).padStart(2, "0");

/** The date to request for a month: that month in the given year, or the latest year before it that GIBS holds. */
export function productDate(p: Product, month: number, year: number): string {
  let y = year;
  const [ly, lm] = p.latest;
  for (let i = 0; i < 30; i++) {
    const tooNew = y > ly || (y === ly && month > lm);
    if (!tooNew && !p.gaps.includes(`${y}-${pad(month)}`)) break;
    y--;
  }
  return `${y}-${pad(month)}-${pad(p.day)}`;
}

const tiles = (p: Product, date: string) => [
  `${GIBS}/${p.layer}/default/${date}/GoogleMapsCompatible_Level${p.maxzoom}/{z}/{y}/{x}.png`,
];

export const seaIceLayer = (): ClockLayer => {
  const PRODUCTS = [SNOW, ICE];
  const SLOTS = ["a", "b"] as const;
  const layerIds = PRODUCTS.flatMap((p) => SLOTS.map((s) => `${p.id}-${s}`));
  const shown: Record<string, string> = {}; // slot → date currently loaded
  let lastKey = "";

  const peak = (ctx: LayerContext, p: Product) => (p.id === "ice" ? (ctx.palette.dark ? 0.62 : 0.72) : ctx.palette.dark ? 0.7 : 0.8);

  function blend(ctx: LayerContext, frame: Frame) {
    const { from, to, t } = monthBlend(frame.date, { lng: 0, lat: 0 });
    const year = frame.date.getUTCFullYear();
    // The "to" month may fall in the next year (December into January).
    const toYear = to < from ? year + 1 : year;
    const key = `${from}|${to}|${t.toFixed(3)}|${year}`;
    if (key === lastKey) return;
    lastKey = key;
    for (const p of PRODUCTS) {
      const dates = { a: productDate(p, from, year), b: productDate(p, to, toYear) };
      for (const s of SLOTS) {
        const id = `${p.id}-${s}`;
        if (shown[id] !== dates[s]) {
          const src = ctx.map.getSource(ctx.id(id)) as { setTiles?: (t: string[]) => void } | undefined;
          src?.setTiles?.(tiles(p, dates[s]));
          shown[id] = dates[s];
        }
        const weight = s === "a" ? 1 - t : t;
        ctx.map.setPaintProperty(ctx.id(id), "raster-opacity", weight * peak(ctx, p));
      }
    }
  }

  function paint(ctx: LayerContext) {
    const white = ctx.palette.dark ? "rgba(236, 240, 246, 1)" : "rgba(255, 255, 255, 1)";
    for (const s of SLOTS) {
      // Any sea ice: one soft white.
      ctx.map.setPaintProperty(ctx.id(`ice-${s}`), "raster-color", [
        "interpolate",
        ["linear"],
        ["raster-value"],
        0,
        white,
        1,
        white,
      ]);
      // Snow: the green channel falls from 240 (a little snow) to 0 (snow all month).
      ctx.map.setPaintProperty(ctx.id(`snow-${s}`), "raster-color", [
        "interpolate",
        ["linear"],
        ["raster-value"],
        0,
        white,
        0.5,
        white.replace(", 1)", ", 0.85)"),
        0.82,
        white.replace(", 1)", ", 0.45)"),
        0.95,
        white.replace(", 1)", ", 0.18)"),
        1,
        white.replace(", 1)", ", 0)"),
      ]);
    }
  }

  return {
    key: "sea-ice",
    label: "Sea ice and snow",

    add(ctx, frame) {
      lastKey = "";
      const b = before(ctx);
      const { from } = monthBlend(frame.date, { lng: 0, lat: 0 });
      for (const p of PRODUCTS) {
        for (const s of SLOTS) {
          const id = `${p.id}-${s}`;
          const date = productDate(p, from, frame.date.getUTCFullYear());
          shown[id] = date;
          ctx.map.addSource(ctx.id(id), {
            type: "raster",
            tiles: tiles(p, date),
            tileSize: 256,
            maxzoom: p.maxzoom,
            attribution:
              '<a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a> (snow: MODIS/Terra; sea ice: AMSR2)',
          });
          ctx.map.addLayer(
            {
              id: ctx.id(id),
              type: "raster",
              source: ctx.id(id),
              paint: {
                "raster-opacity": 0,
                "raster-fade-duration": 400,
                "raster-resampling": "linear",
                // Snow reads its green channel; ice only needs to know it is there.
                "raster-color-mix": p.id === "snow" ? [0, 1, 0, 0] : [0, 0, 0, 1],
                "raster-color-range": [0, 1],
              },
            },
            b,
          );
        }
      }
      paint(ctx);
      blend(ctx, frame);
    },

    update(ctx, frame) {
      blend(ctx, frame);
    },

    applyPalette(ctx) {
      paint(ctx);
      lastKey = "";
    },

    setVisible(ctx, visible) {
      setVisibility(ctx, layerIds, visible);
    },

    remove(ctx) {
      removeAll(ctx, layerIds, layerIds);
      lastKey = "";
    },
  };
};
