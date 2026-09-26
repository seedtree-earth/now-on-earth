/**
 * now-on-earth/mapbox: the clock's light as layers on any Mapbox GL v3 map.
 * Imports only Mapbox *types*; the host brings mapbox-gl, its token and its map.
 */

export {
  attachNowOnEarth,
  defaultLayers,
  type NowOnEarth,
  type NowOnEarthOptions,
  type Follow,
  type LayerState,
} from "./attach.js";
export { ringsLayer } from "./layers/rings.js";
export { seasonsLayer } from "./layers/seasons.js";
export { sunLayer } from "./layers/sun.js";
export { readPalette, isDark, TOKENS, type Palette, type PaletteTokens } from "./palette.js";
export type { ClockLayer, Frame, LayerContext } from "./types.js";
