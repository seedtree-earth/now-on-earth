/**
 * Ground notes as small dots: what people noticed where they are. One module
 * per lens: weather notes (frost, rain, snow) in Weather and ice, life notes
 * (flowering, cicadas, birds) in Life. Each dot is full while fresh and fades
 * over a month, and is not there before the day it was noticed, so scrubbing
 * the year shows the season's signs arriving.
 *
 * Notes come from the host (`setGroundNotes`), already shared by choice; the
 * core rounds them again before they are drawn. This layer never fetches.
 */

import { type GroundNoteGroup, groundNoteFeatures } from "../../core/index.js";
import type { ClockLayer, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

export const groundNotesLayer = (group: GroundNoteGroup): ClockLayer => {
  const key = group === "weather" ? "notes-weather" : "notes-life";
  const src = key;
  const halo = `${key}-halo`;
  const dot = `${key}-dot`;
  const colour = (ctx: LayerContext) => (group === "weather" ? ctx.palette.rain : ctx.palette.life);
  const paint = (ctx: LayerContext) => {
    ctx.map.setPaintProperty(ctx.id(halo), "circle-color", colour(ctx));
    ctx.map.setPaintProperty(ctx.id(dot), "circle-color", colour(ctx));
  };

  return {
    key,
    label: group === "weather" ? "Weather noticed on the ground" : "Life noticed on the ground",

    add(ctx, frame) {
      setSource(ctx, src, groundNoteFeatures(frame.notes, frame.date, group));
      const b = before(ctx);
      ctx.map.addLayer(
        {
          id: ctx.id(halo),
          type: "circle",
          source: ctx.id(src),
          paint: {
            "circle-radius": 9,
            "circle-blur": 1,
            "circle-opacity": ["*", 0.5, ["get", "fade"]],
          },
        },
        b,
      );
      ctx.map.addLayer(
        {
          id: ctx.id(dot),
          type: "circle",
          source: ctx.id(src),
          paint: {
            "circle-radius": 3.4,
            "circle-opacity": ["get", "fade"],
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fbf6ea",
            "circle-stroke-opacity": ["*", 0.8, ["get", "fade"]],
          },
        },
        b,
      );
      paint(ctx);
    },

    update(ctx, frame) {
      setSource(ctx, src, groundNoteFeatures(frame.notes, frame.date, group));
    },

    applyPalette(ctx) {
      paint(ctx);
    },

    setVisible(ctx, visible) {
      setVisibility(ctx, [halo, dot], visible);
    },

    remove(ctx) {
      removeAll(ctx, [halo, dot], [src]);
    },
  };
};
