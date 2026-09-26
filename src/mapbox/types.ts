import type { Map as MapboxMap } from "mapbox-gl";
import type { LngLat, SunState } from "../core/index.js";
import type { Palette } from "./palette.js";

/** Everything a layer needs to draw one moment. */
export type Frame = {
  date: Date;
  sun: SunState;
  viewer: LngLat;
  /** 5° rings instead of 15°. */
  fine: boolean;
};

export type LayerContext = {
  map: MapboxMap;
  /** Namespaces every source and layer id, so nothing collides with the host. */
  id: (name: string) => string;
  /** Host layer to slot beneath (e.g. the Landscape's pins). */
  beforeId: string | undefined;
  palette: Palette;
  reducedMotion: boolean;
};

/**
 * One self-contained layer of the clock. Each module owns its sources and
 * Mapbox layers outright: it adds them, feeds them each frame, recolours them
 * when the theme turns, and removes every trace on `remove`.
 */
export interface ClockLayer {
  /** Stable key used to toggle the layer, e.g. "rings". */
  readonly key: string;
  /** Plain-words name for UI toggles and screen readers. */
  readonly label: string;
  add(ctx: LayerContext, frame: Frame): void;
  update(ctx: LayerContext, frame: Frame): void;
  applyPalette(ctx: LayerContext): void;
  setVisible(ctx: LayerContext, visible: boolean): void;
  remove(ctx: LayerContext): void;
  /** Optional per-animation-frame hook (breathing, twinkle). */
  tick?(ctx: LayerContext, now: number): void;
}
