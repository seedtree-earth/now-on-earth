/**
 * MOCK DATA · for the standalone demo only.
 *
 * Fictional nodes at coarse, well-known regions, so the people layer has
 * something to show before it reads from the Landscape. None of these are real
 * people or organisations. On the Landscape this list is replaced by listings
 * people have chosen to share (see `fromLandscapeRows` in now-on-earth/core).
 */

import type { Presence } from "now-on-earth/core";

const node = (id: string, placeName: string, lng: number, lat: number): Presence => ({
  id: `mock-${id}`,
  kind: "node",
  name: `Mock node · ${placeName}`,
  place: { lng, lat },
  placeName,
  consent: { shown: true, since: "2026-09-01" },
});

export const MOCK_PEOPLE: Presence[] = [
  node("northern-rivers", "the Northern Rivers", 153.3, -28.8),
  node("tasmania", "lutruwita / Tasmania", 146.8, -42.0),
  node("perth", "Boorloo / Perth", 115.9, -31.9),
  node("aotearoa", "Te Whanganui-a-Tara / Wellington", 174.8, -41.3),
  node("bali", "Bali", 115.2, -8.5),
  node("kyoto", "Kyoto", 135.8, 35.0),
  node("kerala", "Kerala", 76.3, 10.0),
  node("nairobi", "Nairobi", 36.8, -1.3),
  node("cape", "the Western Cape", 18.9, -33.9),
  node("lisbon", "Lisbon", -9.1, 38.7),
  node("hebrides", "the Outer Hebrides", -7.0, 57.8),
  node("oaxaca", "Oaxaca", -96.7, 17.1),
  node("salish", "the Salish Sea", -123.1, 48.5),
  node("amazonia", "the Amazon basin", -60.0, -3.1),
  node("patagonia", "Patagonia", -71.3, -41.1),
  node("hawaii", "Hawaiʻi", -155.5, 19.6),
  // One who has not chosen to be shown: the layer must never draw it.
  { ...node("hidden", "Nowhere", 0, 0), consent: { shown: false } },
];
