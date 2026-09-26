/**
 * now-on-earth/core: the pure maths under the clock. No DOM, no Mapbox, no
 * network. Everything here takes a Date and returns numbers or GeoJSON, so the
 * standalone site, the Landscape and any future renderer share one source of
 * truth for where the light falls.
 */

export {
  type LngLat,
  type SunState,
  type SunSky,
  sunState,
  sunSky,
  angularDistance,
  dayLengthShare,
  litHalfArc,
  wrapLng,
  julianCentury,
} from "./sun.js";

export {
  type Cap,
  type Position,
  type PolygonCoords,
  type LineCoords,
  type RingKind,
  type RingFeature,
  type RingEdgeFeature,
  type FeatureCollection,
  cap,
  rings,
  stackedOpacity,
} from "./rings.js";

export {
  type SeasonLineKind,
  type SeasonLineFeature,
  type PointFeature,
  seasonLines,
  parallelArc,
} from "./seasons.js";

export {
  type LightWords,
  describeLight,
  phaseWord,
  skyWords,
  seasonWords,
  compassWord,
} from "./describe.js";

/** Northern Rivers, NSW: where the clock stands when it cannot ask. */
export const FALLBACK_VIEWER = { lng: 153.3, lat: -28.8 } as const;
