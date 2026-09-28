/**
 * What is under the pointer on the Flat model's disc, as the flat model has
 * it: inside or beyond the spotlight, where its sun stands in the sky there,
 * how much of the day its light reaches, and the circles and rim. Neutral
 * words only, like the rest of the Flat model; the globe's pop-ups speak for
 * the globe.
 */

import type { LngLat, SunState } from "now-on-earth/core";
import { SPOTLIGHT_REACH, flatDayShare, flatPhaseWord, flatSky, flatSkyWords } from "./model";
import type { FlatView } from "./view";
import type { HoverItem } from "../hover";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A share of the day, in words. */
function shareWords(share: number): string {
  if (share >= 0.999) return "all day";
  if (share <= 0.001) return "not at all today";
  if (share < 0.4) return "for less than half the day";
  if (share <= 0.6) return "for about half the day";
  return "for more than half the day";
}

export function flatHoverItems(
  view: FlatView,
  point: { x: number; y: number },
  at: LngLat,
  sun: SunState,
  viewer: LngLat,
  shows: (key: string) => boolean,
): HoverItem[] {
  const items: HoverItem[] = [];
  const add = (key: string, title: string, detail: string) => items.push({ key, title, detail });
  const { cx, cy, pxPerDegree } = view.geometry();
  const r = Math.hypot(point.x - cx, point.y - cy); // pixels from the centre
  const nearCircle = (lat: number) => Math.abs(r - (90 - lat) * pxPerDegree) < 7;

  // The sun and the viewer.
  const s = view.screenOf(sun.subsolar);
  if (s && Math.hypot(s.x - point.x, s.y - point.y) < 14) {
    add("flat-sun", "The sun", "A spotlight about 3,000 miles above the disc, over this point, circling the centre once a day.");
  }
  const v = view.screenOf(viewer);
  if (shows("day-line") && v && Math.hypot(v.x - point.x, v.y - point.y) < 10) add("flat-me", "You", "Where you are on the disc.");

  // The circles.
  if (shows("day-line") && nearCircle(viewer.lat)) add("day-line", "Your day line", "Your circle round the centre; the bright part is where the spotlight reaches it today.");
  if (shows("sun-track") && nearCircle(sun.declination)) add("sun-track", "Today's sun track", "The circle the spotlight travels today.");
  if (shows("lane") && (nearCircle(sun.obliquity) || nearCircle(-sun.obliquity))) {
    add("lane", "The sun's lane", at.lat > 0 ? "The inner tropic: the spotlight's circle in June." : "The outer tropic: the spotlight's circle in December.");
  }
  if (at.lat < -78) add("flat-rim", "The rim", "In this model, Antarctica runs all the way round the edge of the disc.");

  // The light here.
  const sky = flatSky(at, sun);
  const share = flatDayShare(at.lat, sun.declination);
  const phase = cap(flatPhaseWord(sky, share));
  const inside = sky.distance <= SPOTLIGHT_REACH;
  add(
    inside ? "flat-lit" : "flat-dark",
    inside ? "Inside the spotlight" : "Beyond the spotlight",
    `${phase}. ${cap(flatSkyWords(sky))}. Its light reaches here ${shareWords(share)}.`,
  );
  return items.slice(0, 4);
}
