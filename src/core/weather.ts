/**
 * The weather where you stand, in words: "Light rain. Cool, with a gentle
 * breeze from the south." Granular on purpose: one place at a time, the place
 * the viewer chose to look at, never a layer over the whole globe.
 *
 * The numbers come from MET Norway's Locationforecast (see api/weather.ts);
 * this file only turns them into words, so it stays pure and testable.
 */

/** The compact shape /api/weather serves. */
export type WeatherNow = {
  /** MET Norway's symbol, e.g. "lightrain_day", "clearsky_night". */
  symbol: string;
  /** Air temperature, °C. */
  temperature: number;
  /** Wind speed, m/s. */
  wind: number;
  /** Where the wind comes from, degrees clockwise from north. */
  windFrom: number;
  /** Rain in the coming hour, mm. */
  rain?: number;
  /** The next six hours, if the forecast gives them. */
  later?: { symbol: string; rain?: number };
};

export type WeatherPayload = {
  at: { lng: number; lat: number };
  now: WeatherNow;
  updated: string;
  expires: string;
  credit: string;
  stale?: boolean;
};

/** MET Norway symbol bases that are sky alone, in words. */
const SKY: Record<string, string> = {
  clearsky: "clear",
  fair: "fair",
  partlycloudy: "partly cloudy",
  cloudy: "cloudy",
  fog: "foggy",
};

/** "lightrainshowersandthunder_day" → "light rain showers, with thunder". */
export function skyWord(symbol: string): string {
  const base = symbol.split("_")[0] ?? "";
  if (SKY[base]) return SKY[base];
  const thunder = base.includes("thunder");
  const strength = base.startsWith("heavy") ? "heavy " : base.startsWith("light") ? "light " : "";
  const core = base.replace(/andthunder$/, "").replace(/^(heavy|light)/, "");
  const showers = core.endsWith("showers");
  const fall = core.replace(/showers$/, "");
  const words = `${strength}${fall}${showers ? " showers" : ""}`.trim();
  if (!fall) return "unsettled";
  return thunder ? `${words}, with thunder` : words;
}

/** How warm it is, in plain words. */
export function warmthWord(c: number): string {
  if (c < -10) return "bitterly cold";
  if (c < 0) return "freezing";
  if (c < 8) return "cold";
  if (c < 15) return "cool";
  if (c < 21) return "mild";
  if (c < 28) return "warm";
  if (c < 35) return "hot";
  return "very hot";
}

/** The Beaufort scale's words, by m/s. */
export function windWord(ms: number): string {
  const scale: Array<[number, string]> = [
    [0.5, "still"],
    [1.6, "barely a breath of air"],
    [3.4, "a light breeze"],
    [5.5, "a gentle breeze"],
    [8, "a moderate breeze"],
    [10.8, "a fresh breeze"],
    [13.9, "a strong breeze"],
    [17.2, "a near gale"],
    [20.8, "a gale"],
    [24.5, "a strong gale"],
  ];
  return scale.find(([max]) => ms < max)?.[1] ?? "a storm";
}

const POINTS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

/** Where the wind comes from: 180° → "the south". */
export function fromWord(deg: number): string {
  return `the ${POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The whole line: "Light rain. Cool, with a gentle breeze from the south." */
export function weatherWords(w: WeatherNow): string {
  const sky = cap(skyWord(w.symbol));
  const wind = windWord(w.wind);
  const warmth = cap(warmthWord(w.temperature));
  const air = wind === "still" ? `${warmth} and still.` : `${warmth}, with ${wind} from ${fromWord(w.windFrom)}.`;
  const turn = w.later && skyWord(w.later.symbol) !== skyWord(w.symbol) ? ` Turning ${skyWord(w.later.symbol)} later.` : "";
  return `${sky}. ${air}${turn}`;
}
