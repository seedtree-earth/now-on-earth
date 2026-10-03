/**
 * Civilisations through history: the states historians have mapped, each
 * appearing, spreading and fading as the History scale moves.
 *
 * - Flourishing: a state glows warmer and fuller as it grows toward its
 *   widest reach.
 * - Declining: past its height it pales toward dusk and thins, and is gone
 *   when it ends.
 *
 * The borders (Cliopatria, Seshat Global History Databank, CC BY 4.0,
 * simplified at build time by scripts/history/cliopatria.mjs) are loaded
 * only when the clock first looks back in history. Shows only in history;
 * at now, today's map speaks for itself.
 */

import type { ExpressionSpecification, GeoJSONSource } from "mapbox-gl";
import { type PolityLife, yearOf } from "../../core/index.js";
import type { ClockLayer, Frame, LayerContext } from "../types.js";
import { before, removeAll, setSource, setVisibility } from "./util.js";

export type CivilisationsOptions = {
  /** Where the simplified borders are served. The standalone site serves them at /data/polities.json. */
  url?: string;
  /** Told when the borders have loaded, with each state's life (for words and hover). */
  onLoad?: (polities: PolityLife[]) => void;
};

type Loaded = { polities: PolityLife[]; features: unknown[] };

/**
 * Twelve earthy, distinct colours, one per state (by its index), clear on
 * satellite imagery by day and by night: terracotta, saffron, sage, teal,
 * indigo, plum, rose, olive, lapis, copper, jade, coral.
 */
const HUES = ["#d2643c", "#e8a92a", "#8fbf6a", "#2fa59a", "#5a67c8", "#9b5bb5", "#e06a8a", "#a8a13a", "#3f86d0", "#c8823a", "#3fbf8a", "#f08060"];
/** Where a fading state's colour drains to. */
const STONE = "#8a8478";

export const civilisationsLayer = (options: CivilisationsOptions = {}): ClockLayer => {
  const SOURCE = "civilisations";
  const FILL = "civ-fill";
  const EDGE = "civ-edge";
  const LAYERS = [FILL, EDGE];
  let loading: Promise<Loaded | null> | null = null;
  let loaded = false;
  let lastYear = NaN;
  let visible = true;
  let inHistory = false;

  async function load(ctx: LayerContext) {
    loading ??= fetch(options.url ?? "/data/polities.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const body = (await loading) as (Loaded & { polities: PolityLife[] }) | null;
    if (!body || loaded) return;
    loaded = true;
    // Give each border its state's life, so the paint can read flourishing or fading.
    for (const f of body.features as Array<{ properties: Record<string, number> }>) {
      const life = body.polities[f.properties.i];
      f.properties.born = life.born;
      f.properties.died = life.died;
      f.properties.peak = life.peak;
    }
    (ctx.map.getSource(ctx.id(SOURCE)) as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: body.features } as never);
    options.onLoad?.(body.polities);
  }

  function paint(ctx: LayerContext, year: number) {
    const m = ctx.map;
    const Y = year;
    const alive: ExpressionSpecification = ["all", ["<=", ["get", "f"], Y], [">=", ["get", "t"], Y]];
    m.setFilter(ctx.id(FILL), alive);
    m.setFilter(ctx.id(EDGE), alive);
    // 0 at birth, 1 at the widest reach, back to 0 at the end.
    const life: ExpressionSpecification = [
      "case",
      ["<=", Y, ["get", "peak"]],
      ["/", ["-", Y, ["get", "born"]], ["max", 1, ["-", ["get", "peak"], ["get", "born"]]]],
      ["/", ["-", ["get", "died"], Y], ["max", 1, ["-", ["get", "died"], ["get", "peak"]]]],
    ];
    const rising: ExpressionSpecification = ["<=", Y, ["get", "peak"]];
    // Each state its own colour, so neighbours read apart.
    const hue: ExpressionSpecification = ["to-color", ["at", ["%", ["get", "i"], HUES.length], ["literal", HUES]]];
    // Flourishing: full colour, filling in as the state grows. Declining: the colour drains to stone grey as it fades.
    m.setPaintProperty(ctx.id(FILL), "fill-color", ["case", rising, hue, ["interpolate-lab", ["linear"], life, 0, STONE, 0.75, hue]] as never);
    m.setPaintProperty(ctx.id(FILL), "fill-opacity", ["interpolate", ["linear"], life, 0, 0.22, 1, 0.66] as never);
    m.setPaintProperty(ctx.id(EDGE), "line-color", ["case", rising, hue, STONE] as never);
    m.setPaintProperty(ctx.id(EDGE), "line-opacity", ["interpolate", ["linear"], life, 0, 0.35, 1, 0.95] as never);
  }

  function apply(ctx: LayerContext, frame: Frame) {
    inHistory = frame.deep > 0;
    setVisibility(ctx, LAYERS, visible && inHistory);
    if (!inHistory) return;
    if (!loaded) void load(ctx);
    const year = yearOf(frame.deep, new Date());
    if (year !== lastYear) {
      lastYear = year;
      paint(ctx, year);
    }
  }

  return {
    key: "civilisations",
    label: "Civilisations through history",

    add(ctx, frame) {
      lastYear = NaN;
      setSource(ctx, SOURCE, { type: "FeatureCollection", features: [] });
      const b = before(ctx);
      ctx.map.addLayer({ id: ctx.id(FILL), type: "fill", source: ctx.id(SOURCE), paint: { "fill-opacity": 0.3, "fill-antialias": true } }, b);
      ctx.map.addLayer({ id: ctx.id(EDGE), type: "line", source: ctx.id(SOURCE), paint: { "line-width": 1.2 } }, b);
      // Borders already fetched (a style change): put them back.
      if (loaded && loading) {
        loaded = false;
        void load(ctx);
      }
      apply(ctx, frame);
    },

    update(ctx, frame) {
      apply(ctx, frame);
    },

    applyPalette(ctx) {
      if (Number.isFinite(lastYear)) paint(ctx, lastYear);
    },

    setVisible(ctx, v) {
      visible = v;
      setVisibility(ctx, LAYERS, visible && inHistory);
    },

    remove(ctx) {
      removeAll(ctx, LAYERS, [SOURCE]);
    },
  };
};
