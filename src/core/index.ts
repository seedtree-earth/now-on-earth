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
  skyOf,
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
  band,
  rings,
  stackedOpacity,
} from "./rings.js";

export {
  type SeasonLineKind,
  type SeasonLineFeature,
  type PointFeature,
  type SeasonMark,
  type SeasonMarkKind,
  seasonLines,
  parallelArc,
  seasonMarks,
  seasonMarkWords,
} from "./seasons.js";

export {
  type LightWords,
  describeLight,
  phaseWord,
  skyWords,
  seasonWords,
  compassWord,
  moonWords,
} from "./describe.js";

export { type TwilightKind, type TwilightFeature, TWILIGHT_STEP, twilightBands } from "./twilight.js";

export { type MoonState, type MoonPhase, type MoonQuality, type MoonQualityKind, moonState, phaseName, gmst, moonQuality } from "./moon.js";

export {
  type Presence,
  type PresenceKind,
  type PresenceFeature,
  type LandscapeRow,
  PRESENCE_PRECISION,
  coarsen,
  consenting,
  presenceFeatures,
  fromLandscapeRows,
} from "./people.js";

/** Northern Rivers, NSW: where the clock stands when it cannot ask. */
export const FALLBACK_VIEWER = { lng: 153.3, lat: -28.8 } as const;

export {
  type SeasonalEvent,
  type EventMonth,
  type EventFeature,
  type PartneredKnowledge,
  type GroundTruthObservation,
  type GroundTruthMonth,
  eventFeatures,
  eventStory,
  monthBlend,
} from "./events.js";

export {
  type TideFeature,
  SOLAR_TIDE_RATIO,
  PULL_RIM,
  tidalPull,
  pullRadius,
  springNeap,
  tideFeatures,
  tideWords,
} from "./tides.js";

export {
  type Vec3,
  type FieldComponents,
  type FieldLine,
  type PolePosition,
  decimalYear,
  coefficientsAt,
  fieldAt,
  compass,
  compassWords,
  toXYZ,
  dipoleAxis,
  fieldLines,
  magneticPoleTrails,
} from "./magnetic.js";

export {
  type AuroraPoint,
  darkness,
  typicalAurora,
  typicalOvalEdges,
  auroraWords,
} from "./aurora.js";

export { isOcean } from "./ocean.js";

export {
  type Quake,
  type HazardAlert,
  type Hazards,
  type Placed,
  LINGER,
  quakesAt,
  firesAt,
  volcanoesAt,
  agoWords,
  magnitudeWords,
  placeWords,
  quakeWords,
  fireWords,
  volcanoWords,
  nearest,
} from "./hazards.js";

export {
  type WeatherNow,
  type WeatherPayload,
  skyWord,
  warmthWord,
  windWord,
  fromWord,
  weatherWords,
} from "./weather.js";

export {
  type GroundNote,
  type GroundNoteInput,
  type GroundNoteKind,
  type GroundNoteKindInfo,
  type GroundNoteGroup,
  type GroundNoteLicence,
  type GroundNoteFeature,
  type GroundNoteStore,
  GROUND_NOTE_KINDS,
  GROUND_NOTE_PRECISION,
  NOTE_MAX,
  WHAT_MAX,
  NAME_MAX,
  kindInfo,
  coarsenNotePlace,
  makeGroundNote,
  sharedNotes,
  noteAge,
  whenWords,
  groundNoteWords,
  groundNoteCredit,
  notesNear,
  groundNoteFeatures,
} from "./ground-notes.js";

export {
  type FlowMonth,
  type MigrationFlow,
  type FlowParticle,
  deriveFlow,
  flowAt,
  pointAlong,
  flowParticles,
  corridorDistance,
  flowWords,
  greatCircle,
  deriveFlyway,
} from "./flows.js";

export {
  type DeepMoment,
  type DeepWords,
  DEEP_MIN,
  DEEP_MAX,
  DEEP_MOMENTS,
  deepYears,
  deepPosition,
  nearestMoment,
  yearsWords,
  deepWords,
} from "./deep-time.js";

export { SEA_LEVEL_REACH, LAND_BRIDGES, seaLevelAt, seaWords } from "./sea-level.js";

export {
  type Hemisphere,
  type Season,
  type TurningKind,
  type TurningName,
  type Turning,
  type WheelPlace,
  WHEEL_TRADITION,
  TURNINGS,
  hemisphereOf,
  turningName,
  turningsBetween,
  wheelAt,
  turningDeclination,
} from "./wheel.js";

export { type FieldReading, type FieldSource, FIELD_REACH, armAngle, fieldWords } from "./field.js";

export { type TurningContent, type HeartsNow, type SeasonalRecord, lightQuality, heartsNow, GO_OUTSIDE } from "./hearts.js";

export {
  ZODIAC,
  ZODIAC_TRADITION,
  zodiacAt,
  ANIMALS,
  newMoonsBetween,
  chineseNewYear,
  chineseYear,
  SOLAR_TERMS,
  solarTerm,
  CHINESE_TRADITION,
} from "./calendars.js";

export {
  GREAT_YEAR,
  TILT_CYCLE,
  ORBIT_CYCLE,
  LONG_ORBIT_CYCLE,
  GALACTIC_YEAR,
  poleAt,
  poleStar,
  greatYearWords,
} from "./cycles.js";

export {
  type LookUp,
  type Shower,
  type Meeting,
  type Eclipse,
  ECLIPSES,
  MAJOR_SHOWERS,
  heliocentric,
  geocentric,
  planetMeetings,
  sunAt,
  soonWords,
  lookUp,
} from "./sky-events.js";
