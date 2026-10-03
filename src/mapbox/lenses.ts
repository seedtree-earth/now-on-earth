/**
 * Lenses: the layers gathered into four ways of looking, so the clock stays
 * calm by default. Only Light is open at first; each other lens is switched
 * on as a whole, and opens to show its own layers. A layer shows when its
 * lens is on and its own switch is on. Every layer stays its own module.
 */

export type LensId = "light" | "wheel" | "life" | "earth" | "weather";

export type Lens = {
  id: LensId;
  label: string;
  /** Layer keys that belong to this lens, in the order they are listed. */
  layers: string[];
  /** Layers still to come, shown as quiet placeholders. */
  upcoming: string[];
  /** Open when the clock starts. */
  on: boolean;
};

export const LENSES: Lens[] = [
  {
    id: "light",
    label: "Light",
    layers: [
      "sun",
      "day-light",
      "night-shade",
      "hour-rings",
      "hour-numbers",
      "twilight",
      "moon",
      "tides",
      "lane",
      "sun-track",
      "day-line",
    ],
    upcoming: [],
    on: true,
  },
  {
    id: "wheel",
    label: "Wheel",
    layers: ["wheel-marks", "look-up", "zodiac", "chinese-calendar", "wheel-local"],
    upcoming: [],
    on: false,
  },
  {
    id: "life",
    label: "Life",
    layers: ["civilisations", "notes-life", "people", "partnered-knowledge"],
    upcoming: ["Migrations", "What people are seeing this season, via iNaturalist"],
    on: false,
  },
  {
    id: "earth",
    label: "Earth's body",
    layers: ["ancient-coasts", "magnetic-field", "magnetic-poles", "aurora", "earthquakes", "volcanoes"],
    upcoming: ["The axis's slow wobble"],
    on: false,
  },
  {
    id: "weather",
    label: "Weather and ice",
    layers: ["weather-here", "notes-weather", "sea-ice", "fires"],
    upcoming: ["The rain belt", "Carbon dioxide"],
    on: false,
  },
];

/**
 * Which lens a layer belongs to. Ecological event layers (keyed by their
 * dataset id) belong to Life unless they say otherwise.
 */
export function lensOf(key: string, eventLens?: Record<string, LensId>): LensId {
  if (eventLens?.[key]) return eventLens[key];
  return LENSES.find((l) => l.layers.includes(key))?.id ?? "life";
}
