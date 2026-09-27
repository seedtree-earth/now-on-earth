/**
 * now-on-earth/mapbox: the clock's light as layers on any Mapbox GL v3 map.
 * Imports only Mapbox *types*; the host brings mapbox-gl, its token and its map.
 */

export {
  attachNowOnEarth,
  defaultLayers,
  DEFAULT_HIDDEN,
  type NowOnEarth,
  type NowOnEarthOptions,
  type Follow,
  type LayerState,
} from "./attach.js";
export { dayLightLayer, nightShadeLayer, hourRingsLayer, hourNumbersLayer, hourNumberPoints } from "./layers/rings.js";
export { laneLayer, sunTrackLayer, dayLineLayer } from "./layers/seasons.js";
export { LENSES, lensOf, type Lens, type LensId } from "./lenses.js";
export { sunLayer } from "./layers/sun.js";
export { twilightLayer } from "./layers/twilight.js";
export { moonLayer } from "./layers/moon.js";
export { tidesLayer } from "./layers/tides.js";
export { magneticFieldLayer, magneticPolesLayer } from "./layers/magnetic.js";
export { planktonLayer } from "./layers/plankton.js";
export { auroraLayer, type AuroraOptions, type AuroraStatus } from "./layers/aurora.js";
export { seaIceLayer, productDate, SNOW, ICE, GIBS_ACKNOWLEDGEMENT } from "./layers/sea-ice.js";
export { seasonalEventLayer, partneredKnowledgeLayer, type EventLayerOptions } from "./layers/events.js";
export { peopleLayer, type PeopleLayerOptions, type PresencePick } from "./layers/people.js";
export { readPalette, isDark, TOKENS, type Palette, type PaletteTokens } from "./palette.js";
export type { ClockLayer, Frame, LayerContext } from "./types.js";
