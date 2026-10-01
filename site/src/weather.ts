/**
 * The weather at one chosen place, from the site's own cached /api/weather
 * (MET Norway). Asked only for places someone tapped or stands, already
 * rounded to 0.1°, and remembered on the page until the forecast expires.
 */

import { type LngLat, type WeatherPayload, weatherWords } from "now-on-earth/core";

const cache = new Map<string, { until: number; words: string | null }>();

/** The weather in words, or null if there is none to give. */
export async function weatherAt(at: LngLat): Promise<string | null> {
  const lat = Math.round(at.lat * 10) / 10;
  const lng = Math.round(at.lng * 10) / 10;
  const key = `${lat},${lng}`;
  const known = cache.get(key);
  if (known && Date.now() < known.until) return known.words;
  try {
    const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as WeatherPayload;
    const words = weatherWords(body.now);
    cache.set(key, { until: Date.parse(body.expires) || Date.now() + 30 * 60 * 1000, words });
    return words;
  } catch {
    // Say nothing rather than guess; try again in a few minutes.
    cache.set(key, { until: Date.now() + 5 * 60 * 1000, words: null });
    return null;
  }
}

export const WEATHER_CREDIT = "Weather from MET Norway, CC BY 4.0";
