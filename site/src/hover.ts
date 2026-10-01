/**
 * What is under the pointer: worked out from the same maths that draws the
 * globe (not read back from pixels), so it can speak for the exact place.
 * Point things first (the sun, the moon, the poles), then lines, then the
 * areas the place sits in, most specific first.
 */

import type mapboxgl from "mapbox-gl";
import {
  type AuroraPoint,
  type MigrationFlow,
  corridorDistance,
  deriveFlow,
  flowWords,
  type GroundNote,
  groundNoteWords,
  kindInfo,
  sharedNotes,
  noteAge,
  type LngLat,
  type MoonState,
  type SeasonalEvent,
  type SunState,
  angularDistance,
  compassWords,
  darkness,
  firesAt,
  fireWords,
  isOcean,
  quakesAt,
  quakeWords,
  volcanoesAt,
  volcanoWords,
  magneticPoleTrails,
  monthBlend,
  skyWords,
  sunSky,
  tideWords,
} from "now-on-earth/core";
import { guideFor } from "./guide";
import { hazardsFor } from "now-on-earth/mapbox";

export type HoverItem = { key: string; title: string; detail: string };

export type HoverContext = {
  map: mapboxgl.Map;
  point: { x: number; y: number };
  at: LngLat;
  date: Date;
  sun: SunState;
  moon: MoonState;
  viewer: LngLat;
  shows: (key: string) => boolean;
  events: SeasonalEvent[];
  aurora: { live: boolean; points: AuroraPoint[] };
  /** Ground notes, shared by choice. */
  notes: GroundNote[];
  /** How many items to return; the hover pop-up keeps it short. */
  limit?: number;
};

const poles = magneticPoleTrails();
const flows = new Map<string, MigrationFlow>();
const flowFor = (e: SeasonalEvent) => {
  let f = flows.get(e.id);
  if (!f) flows.set(e.id, (f = deriveFlow(e, { axis: e.flowAxis })));
  return f;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Screen distance from the pointer to a point on the globe, if it is on the near side. */
function pixelsTo(ctx: HoverContext, p: LngLat): number {
  if (angularDistance(p, ctx.map.getCenter()) > 88) return Infinity;
  const s = ctx.map.project([p.lng, p.lat]);
  return Math.hypot(s.x - ctx.point.x, s.y - ctx.point.y);
}

/** Screen distance from the pointer to a line of latitude, measured straight up or down at the pointer's longitude. */
const pixelsToLatitude = (ctx: HoverContext, lat: number) => pixelsTo(ctx, { lng: ctx.at.lng, lat });

export function hoverItems(ctx: HoverContext): HoverItem[] {
  const items: HoverItem[] = [];
  const add = (key: string, detail: string) => {
    const g = guideFor(key);
    items.push({ key, title: g?.title ?? key, detail });
  };
  const { at, sun } = ctx;
  const sky = sunSky(at, sun);
  const alt = sky.altitude;

  // Points.
  if (ctx.shows("sun") && pixelsTo(ctx, sun.subsolar) < 14) add("sun", "The sun is straight overhead here.");
  if (ctx.shows("moon") && pixelsTo(ctx, ctx.moon.sublunar) < 14) {
    add("moon", `${cap(ctx.moon.phase === "full" ? "a full moon" : `a ${ctx.moon.phase} moon`)}, straight overhead here.`);
  }
  if (ctx.shows("magnetic-poles")) {
    const n = poles.north[poles.north.length - 1];
    const s = poles.south[poles.south.length - 1];
    if (pixelsTo(ctx, n) < 14) add("magnetic-poles", "Magnetic north today. A compass needle points here, not to the geographic pole.");
    else if (pixelsTo(ctx, s) < 14) add("magnetic-poles", "Magnetic south today.");
    else if (pixelsTo(ctx, { lng: 0, lat: 90 }) < 14) add("magnetic-poles", "The geographic North Pole, where the Earth's axis comes through.");
  }

  // Earthquakes, eruptions and fires: real events, said plainly.
  const hz = hazardsFor();
  if (hz) {
    const near = <T extends LngLat>(list: T[]) => list.find((x) => pixelsTo(ctx, x) < 12);
    const q = ctx.shows("earthquakes") ? near(quakesAt(hz.quakes, ctx.date)) : undefined;
    if (q) add("earthquakes", `${cap(quakeWords(q))}. Tap for the USGS report.`);
    const v = ctx.shows("volcanoes") ? near(volcanoesAt(hz.volcanoes, ctx.date)) : undefined;
    if (v) add("volcanoes", `${cap(volcanoWords(v))}. Tap for the GDACS report.`);
    const f = ctx.shows("fires") ? near(firesAt(hz.fires, ctx.date)) : undefined;
    if (f) add("fires", `${cap(fireWords(f))}. Tap for the GDACS report.`);
  }

  // Ground notes: what someone noticed there.
  for (const n of sharedNotes(ctx.notes)) {
    const key = kindInfo(n.kind).group === "weather" ? "notes-weather" : "notes-life";
    const age = noteAge(n, ctx.date);
    if (!ctx.shows(key) || age < -0.5 || age > 30 || pixelsTo(ctx, n.place) >= 10) continue;
    add(key, groundNoteWords(n, ctx.date));
  }

  // Lines.
  if (ctx.shows("day-line") && pixelsToLatitude(ctx, ctx.viewer.lat) < 7) add("day-line", "Your latitude. The bright part is your day.");
  if (ctx.shows("sun-track") && pixelsToLatitude(ctx, sun.declination) < 7) add("sun-track", "The sun passes straight overhead somewhere along this line today.");
  if (ctx.shows("lane") && (pixelsToLatitude(ctx, sun.obliquity) < 7 || pixelsToLatitude(ctx, -sun.obliquity) < 7)) {
    add("lane", at.lat > 0 ? "The Tropic of Cancer: the sun's northern limit, reached at the June solstice." : "The Tropic of Capricorn: the sun's southern limit, reached at the December solstice.");
  }

  // Areas: life first, then the sky and the sea.
  const { from, to, t } = monthBlend(ctx.date);
  const month = t < 0.5 ? from : to;
  for (const e of ctx.events) {
    if (!ctx.shows(e.id)) continue;
    if (e.display === "flow") {
      // A migration drawn as a flow: near its corridor, say where it stands in the season.
      const flow = flowFor(e);
      if (corridorDistance(flow, at) > 1.2) continue;
      const moving = flowWords(flow, ctx.date);
      add(e.id, `${cap(e.story?.[month - 1] ?? "their corridor")}${moving ? `. Now ${moving}.` : ". Out of season now."}`);
      continue;
    }
    const cells = e.months[month - 1]?.cells ?? [];
    const near = cells.some(([lng, lat]) => Math.abs(lat - at.lat) <= Math.max(1, e.grid) && Math.abs(lng - at.lng) <= Math.max(1, e.grid));
    if (near) add(e.id, cap(e.story?.[month - 1] ?? "seen here in this month"));
  }
  if (ctx.shows("aurora") && darkness(at, sun) > 0.3) {
    const cell = ctx.aurora.points.find((p) => Math.abs(p[1] - at.lat) <= 1 && Math.abs(p[0] - at.lng) <= 1);
    if (cell && cell[2] >= 4) {
      add("aurora", ctx.aurora.live ? (cell[2] >= 12 ? "It may be dancing overhead here now." : "It may be glowing low in the sky here now.") : "On a typical night, it would show about here. Not tonight's forecast.");
    }
  }
  if (ctx.shows("sea-ice") && Math.abs(at.lat) >= 55) add("sea-ice", "Where white shows, ice or snow lay in this month of a recent year.");
  if (ctx.shows("tides") && isOcean(at.lat, at.lng)) add("tides", `${cap(tideWords(at, ctx.moon))}.`);
  if (ctx.shows("magnetic-field")) add("magnetic-field", `${cap(compassWords(at, ctx.date))}.`);

  // The light itself.
  const band = Math.min(12, Math.max(1, Math.ceil(angularDistance(sun.subsolar, at) / 15)));
  const twilight =
    alt > 0 && alt < 6
      ? "golden hour"
      : alt <= 0 && alt > -6
        ? "civil twilight"
        : alt <= -6 && alt > -12
          ? "nautical twilight"
          : alt <= -12 && alt > -18
            ? "astronomical twilight"
            : null;
  if (twilight && ctx.shows("twilight")) add("twilight", `${cap(twilight)} here. ${cap(skyWords(alt, sky.azimuth, sky.hourAngle))}.`);
  if (alt > 0 && ctx.shows("day-light")) add("day-light", `Hour band ${band} from the sun. ${cap(skyWords(alt, sky.azimuth, sky.hourAngle))}.`);
  if (alt <= 0 && ctx.shows("night-shade")) {
    add("night-shade", `Hour band ${band} from the sun${band === 12 ? ", around midnight" : ""}. ${cap(skyWords(alt, sky.azimuth, sky.hourAngle))}.`);
  }
  return items.slice(0, ctx.limit ?? 4);
}
