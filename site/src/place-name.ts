/**
 * A name for a place someone chose to stand: "Lisbon, Portugal", or "the open
 * ocean". Asked of Mapbox's reverse geocoding with the site's own token, only
 * for places picked on the globe, never for the viewer's real location (which
 * stays on the page). Cached, so standing in the same place again asks nothing.
 */

import { type LngLat, isOcean } from "now-on-earth/core";

const cache = new Map<string, string>();

export async function placeName(at: LngLat, token: string | undefined): Promise<string> {
  const key = `${at.lng.toFixed(1)},${at.lat.toFixed(1)}`;
  const known = cache.get(key);
  if (known) return known;
  const fallback = isOcean(at.lat, at.lng) ? "the open ocean" : "a quiet place";
  if (!token) return fallback;
  try {
    const p = new URLSearchParams({
      longitude: at.lng.toFixed(3),
      latitude: at.lat.toFixed(3),
      types: "place,locality,region,country",
      limit: "1",
      access_token: token,
    });
    const res = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${p}`);
    if (!res.ok) return fallback;
    const body = await res.json();
    const f = body.features?.[0]?.properties;
    const name = f ? [f.name, f.context?.country?.name].filter((x: unknown, i: number, a: unknown[]) => x && a.indexOf(x) === i).join(", ") : "";
    const result = name || fallback;
    cache.set(key, result);
    return result;
  } catch {
    return fallback;
  }
}
