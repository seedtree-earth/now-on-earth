/**
 * Ancient coastlines: the seabed that was dry land when the sea stood lower,
 * drawn as soft land over today's sea, following the deep time scrub.
 *
 * One small greyscale image of today's shallow seabed (GEBCO, 0 to 150 m,
 * each pixel its depth in metres + 1; built by scripts/earth/coastlines.mjs)
 * is laid over the globe and recoloured on the GPU: every pixel shallower
 * than the sea's fall at that moment shows as land. Nothing is fetched as the
 * scrub moves; only a paint property changes.
 *
 * Shows only in deep time, within the sea level curve's reach (about 800,000
 * years); further back the continents themselves moved.
 */

import type { ExpressionSpecification } from "mapbox-gl";
import { seaLevelAt } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setVisibility } from "./util.js";

export type AncientCoastsOptions = {
  /** Where the shelf image is served. The standalone site serves it at /data/shelf-depth.png. */
  url?: string;
};

/** Web Mercator's limits: the image covers the whole square. */
const MERC = 85.0511287798066;

export const ancientCoastsLayer = (options: AncientCoastsOptions = {}): ClockLayer => {
  const SOURCE = "ancient-coasts";
  const LAYER = "ancient-coasts-land";
  let level = 0;

  function colour(ctx: LayerContext): ExpressionSpecification | string {
    const shore = ctx.palette.shore;
    // Pixel values are depth + 1; 0 is land today or deep water. A pixel is dry
    // when its depth is less than the sea's fall.
    const fall = -level;
    if (fall < 1) return "rgba(0,0,0,0)";
    return ["step", ["raster-value"], "rgba(0,0,0,0)", 0.5, shore, Math.min(254.5, fall + 1), "rgba(0,0,0,0)"];
  }

  function apply(ctx: LayerContext, frame: Frame) {
    const sea = frame.deep > 0 ? seaLevelAt(frame.deep) : null;
    level = sea ?? 0;
    const shown = sea !== null && sea < -1;
    ctx.map.setPaintProperty(ctx.id(LAYER), "raster-opacity", shown ? 0.82 : 0);
    if (shown) ctx.map.setPaintProperty(ctx.id(LAYER), "raster-color", colour(ctx) as ExpressionSpecification);
  }

  return {
    key: "ancient-coasts",
    label: "Ancient coastlines",

    add(ctx, frame) {
      ctx.map.addSource(ctx.id(SOURCE), {
        type: "image",
        url: options.url ?? "/data/shelf-depth.png",
        coordinates: [
          [-180, MERC],
          [180, MERC],
          [180, -MERC],
          [-180, -MERC],
        ],
      });
      ctx.map.addLayer(
        {
          id: ctx.id(LAYER),
          type: "raster",
          source: ctx.id(SOURCE),
          paint: {
            "raster-opacity": 0,
            "raster-resampling": "nearest",
            "raster-fade-duration": 0,
            // Read the grey value straight back as metres + 1.
            "raster-color-mix": [255, 0, 0, 0],
            "raster-color-range": [0, 255],
            "raster-color": "rgba(0,0,0,0)",
          },
        },
        before(ctx),
      );
      apply(ctx, frame);
    },

    update(ctx, frame) {
      apply(ctx, frame);
    },

    applyPalette(ctx) {
      if (level < -1) ctx.map.setPaintProperty(ctx.id(LAYER), "raster-color", colour(ctx) as ExpressionSpecification);
    },

    setVisible(ctx, visible) {
      setVisibility(ctx, [LAYER], visible);
    },

    remove(ctx) {
      removeAll(ctx, [LAYER], [SOURCE]);
    },
  };
};
