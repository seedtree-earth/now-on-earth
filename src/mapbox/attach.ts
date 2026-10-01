/**
 * attachNowOnEarth: put the clock's light onto a Mapbox map that already
 * exists. The standalone site makes its own globe and calls this; the
 * Landscape calls it from its map's `load` handler. Either way the host owns
 * the map, the token, the style and the projection. This only adds `noe-`
 * sources and layers, and takes every one of them away again on `destroy`.
 */

import type { Map as MapboxMap } from "mapbox-gl";
import { FALLBACK_VIEWER, type GroundNote, type LngLat, type Presence, type SeasonalEvent, moonState, sunState } from "../core/index.js";
import { type Palette, type PaletteTokens, TOKENS, readPalette } from "./palette.js";
import { partneredKnowledgeLayer, seasonalEventLayer } from "./layers/events.js";
import { migrationFlowLayer } from "./layers/flows.js";
import { magneticFieldLayer, magneticPolesLayer } from "./layers/magnetic.js";
import { type AuroraOptions, auroraLayer } from "./layers/aurora.js";
import { type HazardsOptions, earthquakesLayer, firesLayer, volcanoesLayer } from "./layers/hazards.js";
import { moonLayer } from "./layers/moon.js";
import { seaIceLayer } from "./layers/sea-ice.js";
import { peopleLayer } from "./layers/people.js";
import { groundNotesLayer } from "./layers/ground-notes.js";
import { dayLightLayer, hourNumbersLayer, hourRingsLayer, nightShadeLayer } from "./layers/rings.js";
import { dayLineLayer, laneLayer, sunTrackLayer } from "./layers/seasons.js";
import { LENSES, type LensId, lensOf } from "./lenses.js";
import { sunLayer } from "./layers/sun.js";
import { tidesLayer } from "./layers/tides.js";
import { twilightLayer } from "./layers/twilight.js";
import type { ClockLayer, Frame, LayerContext } from "./types.js";
import type { PresencePick } from "./layers/people.js";

export type Follow = "sun" | null;

export type NowOnEarthOptions = {
  /** A fixed moment to show. Leave unset to run live. */
  time?: Date | null;
  /** Where the viewer is. Defaults to the Northern Rivers, NSW. */
  viewer?: LngLat;
  /** 5° rings instead of 15°. */
  fine?: boolean;
  /** People and nodes who chose to be shown. Only `consent.shown` ones are drawn. */
  people?: Presence[];
  /** Ground notes: what people noticed where they are, shared by choice. */
  notes?: GroundNote[];
  /** Seasonal ecological events (built by scripts/ecology/), drawn under the lines. */
  events?: SeasonalEvent[];
  /** Earthquakes, volcanoes and fires: where the cached feed is served. */
  hazards?: HazardsOptions;
  /** The aurora: where its cached forecast is served, and a status callback. */
  aurora?: AuroraOptions;
  /** A person or node dot was hovered or tapped (null on leave). */
  onPick?: (pick: PresencePick | null) => void;
  /**
   * Layer modules, bottom to top. Defaults to every built layer (see
   * defaultLayers). Pass your own list to add, drop or reorder layers.
   */
  layers?: ClockLayer[];
  /** Layer keys whose own switch starts off. Defaults to tides and people. */
  hidden?: string[];
  /**
   * Which lenses start on. Defaults to Light only. A layer shows when its lens
   * is on and its own switch is on.
   */
  lenses?: Partial<Record<LensId, boolean>>;
  /**
   * Host layer to slot the clock beneath (the Landscape passes its pin layer,
   * e.g. "clusters"). Unset: beneath the style's first label layer. Null: on top.
   */
  beforeId?: string | null;
  /** Prefix for every source and layer id. */
  prefix?: string;
  /** Element whose CSS custom properties colour the light. */
  themeElement?: Element;
  /** Token names to read, if the host names them differently from SeedTree V2. */
  tokens?: Partial<PaletteTokens>;
  /** Fixed colours that win over the tokens. */
  palette?: Partial<Palette>;
  /** How often live mode redraws. The sun moves a quarter degree a minute. */
  liveIntervalMs?: number;
};

export type LayerState = {
  key: string;
  label: string;
  lens: LensId;
  /** The layer's own switch. */
  on: boolean;
  /** On and in an open lens: actually drawn. */
  visible: boolean;
};

export type NowOnEarth = {
  /** Show a fixed moment, or `null` to return to live. */
  setTime(date: Date | null): void;
  isLive(): boolean;
  setViewer(viewer: LngLat): void;
  setFine(fine: boolean): void;
  setPeople(people: Presence[]): void;
  setGroundNotes(notes: GroundNote[]): void;
  /** A layer's own switch. It shows only while its lens is on too. */
  setVisible(key: string, visible: boolean): void;
  layers(): LayerState[];
  setLens(lens: LensId, on: boolean): void;
  lensOn(lens: LensId): boolean;
  /** Keep the camera on the sun as it moves, or stop. */
  follow(mode: Follow): void;
  following(): Follow;
  faceSun(): void;
  faceMe(): void;
  /** The moment currently drawn. */
  frame(): Frame;
  /** Called after every redraw and on any state change. */
  subscribe(fn: (frame: Frame) => void): () => void;
  /** Re-read colours now (theme changes are picked up automatically). */
  refreshPalette(): void;
  destroy(): void;
};

export const defaultLayers = (
  opts: { onPick?: (pick: PresencePick | null) => void; events?: SeasonalEvent[]; aurora?: AuroraOptions; hazards?: HazardsOptions } = {},
): ClockLayer[] => [
  seaIceLayer(),
  tidesLayer(),
  nightShadeLayer(),
  dayLightLayer(),
  hourRingsLayer(),
  twilightLayer(),
  auroraLayer(opts.aurora),
  ...(opts.events ?? []).map((e) => (e.display === "flow" || e.display === "flyway" ? migrationFlowLayer(e) : seasonalEventLayer(e))),
  partneredKnowledgeLayer(),
  groundNotesLayer("weather"),
  groundNotesLayer("life"),
  laneLayer(),
  sunTrackLayer(),
  dayLineLayer(),
  hourNumbersLayer(),
  peopleLayer({ onPick: opts.onPick }),
  moonLayer(),
  sunLayer(),
  magneticFieldLayer(),
  magneticPolesLayer(),
  firesLayer(opts.hazards),
  volcanoesLayer(opts.hazards),
  earthquakesLayer(opts.hazards),
];

/** Quiet by default: tides and people are there to be switched on. */
export const DEFAULT_HIDDEN = ["tides", "people"];

function firstLabelLayer(map: MapboxMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find((l) => l.type === "symbol")?.id;
}

export function attachNowOnEarth(map: MapboxMap, options: NowOnEarthOptions = {}): NowOnEarth {
  const prefix = options.prefix ?? "noe-";
  const themeEl = options.themeElement ?? document.documentElement;
  const tokens = { ...TOKENS, ...options.tokens };
  const mods = options.layers ?? defaultLayers({ onPick: options.onPick, events: options.events, aurora: options.aurora, hazards: options.hazards });
  const hidden = options.hidden ?? DEFAULT_HIDDEN;
  const chosen = new Map(mods.map((m) => [m.key, !hidden.includes(m.key)]));
  const eventLens = Object.fromEntries((options.events ?? []).map((e) => [e.id, (e.lens ?? "life") as LensId]));
  const lensState = new Map(LENSES.map((l) => [l.id, options.lenses?.[l.id] ?? l.on]));
  const lensOfKey = (key: string) => lensOf(key, eventLens);
  /** Drawn: its own switch on, and its lens open. */
  const shows = (key: string) => (chosen.get(key) ?? true) && (lensState.get(lensOfKey(key)) ?? true);
  const listeners = new Set<(f: Frame) => void>();
  const reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  let fixed: Date | null = options.time ?? null;
  let viewer: LngLat = options.viewer ?? { ...FALLBACK_VIEWER };
  let fine = options.fine ?? false;
  let people: Presence[] = options.people ?? [];
  let notes: GroundNote[] = options.notes ?? [];
  let followMode: Follow = null;
  let added = false;
  let destroyed = false;
  let pending = 0;

  const ctx: LayerContext = {
    map,
    id: (name) => prefix + name,
    beforeId: undefined,
    palette: readPalette(themeEl, options.palette, tokens),
    reducedMotion: reduced,
  };

  const makeFrame = (): Frame => {
    const date = fixed ?? new Date();
    return { date, sun: sunState(date), moon: moonState(date), viewer, fine, people, notes };
  };
  let current = makeFrame();

  const emit = () => listeners.forEach((fn) => fn(current));

  function addAll() {
    if (destroyed) return;
    for (const m of mods) m.remove(ctx);
    ctx.beforeId = options.beforeId === null ? undefined : (options.beforeId ?? firstLabelLayer(map));
    current = makeFrame();
    for (const m of mods) {
      m.add(ctx, current);
      m.setVisible(ctx, shows(m.key));
    }
    added = true;
    emit();
  }

  function draw() {
    pending = 0;
    if (destroyed || !added) return;
    current = makeFrame();
    for (const m of mods) if (shows(m.key)) m.update(ctx, current);
    if (followMode === "sun") {
      map.jumpTo({ center: [current.sun.subsolar.lng, current.sun.subsolar.lat] });
    }
    emit();
  }

  /** Coalesce bursts (a slider drag) into one redraw per animation frame. */
  const schedule = () => {
    if (!pending) pending = requestAnimationFrame(draw);
  };

  // Live mode: redraw on an interval. Cheap: a few hundred points per ring.
  const live = setInterval(() => {
    if (!fixed) schedule();
  }, options.liveIntervalMs ?? 5000);

  // Per-frame hooks (the sun's breath), throttled to a gentle 20 fps.
  let raf = 0;
  let lastTick = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!added || now - lastTick < 50) return;
    lastTick = now;
    for (const m of mods) if (shows(m.key)) m.tick?.(ctx, now);
  };
  raf = requestAnimationFrame(loop);

  // Theme: V2 flips data-theme on <html>; re-read the tokens when it does.
  const refreshPalette = () => {
    ctx.palette = readPalette(themeEl, options.palette, tokens);
    if (added) for (const m of mods) m.applyPalette(ctx);
  };
  const themeWatch = new MutationObserver(refreshPalette);
  themeWatch.observe(themeEl, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
  const scheme = typeof matchMedia !== "undefined" ? matchMedia("(prefers-color-scheme: dark)") : null;
  scheme?.addEventListener("change", refreshPalette);

  function applyVisibility(keys: string[]) {
    if (added) {
      const frame = makeFrame();
      for (const key of keys) {
        const m = mods.find((x) => x.key === key);
        if (!m) continue;
        const v = shows(key);
        m.setVisible(ctx, v);
        if (v) m.update(ctx, frame);
      }
    }
    emit();
  }

  // A person dragging the globe has taken the camera; stop following.
  const release = () => {
    if (followMode) {
      followMode = null;
      emit();
    }
  };
  map.on("dragstart", release);

  // A style swap wipes custom layers; put ours back.
  map.on("style.load", addAll);
  if (map.isStyleLoaded()) addAll();

  return {
    setTime(date) {
      fixed = date ? new Date(date.getTime()) : null;
      schedule();
    },
    isLive: () => fixed === null,
    setViewer(v) {
      viewer = { lng: v.lng, lat: v.lat };
      schedule();
    },
    setFine(f) {
      fine = f;
      schedule();
    },
    setPeople(p) {
      people = p;
      schedule();
    },
    setGroundNotes(n) {
      notes = n;
      schedule();
    },
    setVisible(key, v) {
      chosen.set(key, v);
      applyVisibility([key]);
    },
    layers: () =>
      mods.map((m) => ({ key: m.key, label: m.label, lens: lensOfKey(m.key), on: chosen.get(m.key) ?? true, visible: shows(m.key) })),
    setLens(lens, on) {
      lensState.set(lens, on);
      applyVisibility(mods.filter((m) => lensOfKey(m.key) === lens).map((m) => m.key));
    },
    lensOn: (lens) => lensState.get(lens) ?? false,
    follow(mode) {
      followMode = mode;
      if (mode === "sun") {
        map.easeTo({
          center: [current.sun.subsolar.lng, current.sun.subsolar.lat],
          duration: reduced ? 0 : 1600,
          essential: true,
        });
      }
      emit();
    },
    following: () => followMode,
    faceSun() {
      this.follow("sun");
    },
    faceMe() {
      followMode = null;
      map.easeTo({ center: [viewer.lng, viewer.lat], duration: reduced ? 0 : 1600, essential: true });
      emit();
    },
    frame: () => current,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    refreshPalette,
    destroy() {
      destroyed = true;
      clearInterval(live);
      cancelAnimationFrame(raf);
      if (pending) cancelAnimationFrame(pending);
      themeWatch.disconnect();
      scheme?.removeEventListener("change", refreshPalette);
      map.off("dragstart", release);
      map.off("style.load", addAll);
      // The host may already have removed its map.
      try {
        for (const m of mods) m.remove(ctx);
      } catch {
        /* map gone */
      }
      listeners.clear();
    },
  };
}
