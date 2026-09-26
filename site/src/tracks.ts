/**
 * The slider tracks are drawn from the light itself, so they need no ticks.
 * The day track is the sky over the viewer across the twenty-four hours the
 * slider spans; the year track is how long their days run across the year.
 */

import { type LngLat, dayLengthShare, sunSky, sunState } from "now-on-earth/core";
import type { Palette } from "now-on-earth/mapbox";

/**
 * Blend night into day through oklch on the shorter hue path, so the violet
 * turns to gold by way of a dusky rose, the way a real sky does, instead of
 * the brown an RGB blend of the two would give.
 */
function mix(night: string, day: string, t: number): string {
  return `color-mix(in oklch shorter hue, ${night}, ${day} ${(t * 100).toFixed(1)}%)`;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function gradient(stops: string[]): string {
  const n = stops.length - 1;
  return `linear-gradient(90deg, ${stops.map((c, i) => `${c} ${((i / n) * 100).toFixed(2)}%`).join(", ")})`;
}

const MIN = 60000;
const DAY = 86400000;

/** Sky over the viewer from 12 hours before `centre` to 12 hours after. */
export function dayTrack(centre: Date, viewer: LngLat, palette: Palette): string {
  const { night, day } = palette;
  const stops: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = new Date(centre.getTime() + (i * 30 - 720) * MIN);
    const alt = sunSky(viewer, sunState(t)).altitude;
    // Astronomical night up to full day at 8° of altitude, eased.
    stops.push(mix(night, day, Math.pow(clamp01((alt + 18) / 26), 1.4)));
  }
  return gradient(stops);
}

/** Day length at the viewer's latitude across half a year either side. */
export function yearTrack(centre: Date, viewer: LngLat, palette: Palette): string {
  const { night, day } = palette;
  // Stretch to this latitude's own shortest and longest days, so a gentle
  // subtropical year still reads from dusk to gold. At the equator, where day
  // length barely moves, the track stays an even half-light.
  const ob = sunState(centre).obliquity;
  const shortest = dayLengthShare(viewer.lat, viewer.lat >= 0 ? -ob : ob);
  const longest = dayLengthShare(viewer.lat, viewer.lat >= 0 ? ob : -ob);
  const range = longest - shortest;
  const stops: string[] = [];
  for (let i = 0; i <= 52; i++) {
    const t = new Date(centre.getTime() + (i * 7 - 182) * DAY);
    const share = dayLengthShare(viewer.lat, sunState(t).declination);
    const k = range < 0.02 ? 0.5 : clamp01((share - shortest) / range);
    stops.push(mix(night, day, 0.15 + 0.85 * k));
  }
  return gradient(stops);
}
