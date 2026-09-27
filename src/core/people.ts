/**
 * People and nodes on the globe, each in their own light.
 *
 * The ethical line is built into the shape, not left to the caller:
 *
 * - Someone appears only by their own choice: a Presence without
 *   `consent.shown === true` is dropped before it is drawn.
 * - Only a coarse place they set themselves. Whatever arrives is rounded again
 *   here (people to about 55 km, organisations to about 11 km), so a precise
 *   point can never reach the globe by accident.
 * - No tracking and no live location: a Presence is a place someone chose,
 *   not a device position, and nothing here reads one.
 * - No search: the layer shows what is shared, it does not look anyone up.
 *
 * Organisations on the Landscape are public listings, placed by the people who
 * run them; `fromLandscapeRows` reads them in the same shape.
 */

import { type LngLat, type SunState, sunSky, dayLengthShare } from "./sun.js";
import { phaseWord } from "./describe.js";
import type { FeatureCollection, Position } from "./rings.js";

export type PresenceKind = "person" | "node" | "organisation";

export type Presence = {
  /** Opaque and stable. Never an email, handle or device id. */
  id: string;
  kind: PresenceKind;
  /** The name they chose to be shown by. */
  name: string;
  /** A coarse place they set. Rounded again on the way in. */
  place: LngLat;
  /** The place in words, as they chose to give it ("the Northern Rivers"). */
  placeName?: string;
  /** Where to read more, e.g. a Landscape profile ("/landscape/<slug>"). */
  href?: string;
  /** Present only because they asked to be. */
  consent: { shown: boolean; since?: string };
};

/** Rounding step in degrees for each kind of presence. */
export const PRESENCE_PRECISION: Record<PresenceKind, number> = {
  person: 0.5,
  node: 0.5,
  organisation: 0.1,
};

const round = (x: number, step: number) => Math.round(x / step) * step;

/** Coarsen a place to its kind's precision. */
export function coarsen(place: LngLat, kind: PresenceKind): LngLat {
  const step = PRESENCE_PRECISION[kind];
  return { lng: round(place.lng, step), lat: round(place.lat, step) };
}

/** Only those who chose to be seen, each at a coarse place. */
export function consenting(people: Presence[]): Presence[] {
  return people
    .filter((p) => p.consent?.shown === true)
    .map((p) => ({ ...p, place: coarsen(p.place, p.kind) }));
}

export type PresenceFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: Position };
  properties: {
    id: string;
    kind: PresenceKind;
    name: string;
    placeName: string;
    href: string;
    /** Sun altitude where they are, degrees. Drives the dot's colour. */
    altitude: number;
    /** Their part of the day, in words. */
    phase: string;
  };
};

export function presenceFeatures(people: Presence[], sun: SunState): FeatureCollection<PresenceFeature> {
  return {
    type: "FeatureCollection",
    features: consenting(people).map((p) => {
      const sky = sunSky(p.place, sun);
      const halfDay = dayLengthShare(p.place.lat, sun.declination) * 180;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.place.lng, p.place.lat] },
        properties: {
          id: p.id,
          kind: p.kind,
          name: p.name,
          placeName: p.placeName ?? "",
          href: p.href ?? "",
          altitude: sky.altitude,
          phase: phaseWord(sky.altitude, sky.hourAngle, halfDay),
        },
      };
    }),
  };
}

/** The shape of a Landscape row in SeedTree V2 (components/Landscape.tsx). */
export type LandscapeRow = {
  slug: string;
  kind: string;
  lat: number;
  lng: number;
  name: string;
  location: string;
};

/**
 * Landscape listings as presences. Listings are public by their makers'
 * choice, so they arrive consenting; the place is still coarsened.
 */
export function fromLandscapeRows(rows: LandscapeRow[]): Presence[] {
  return rows.map((r, i) => ({
    id: `landscape-${r.slug}-${i}`,
    kind: "organisation",
    name: r.name,
    place: { lng: r.lng, lat: r.lat },
    placeName: r.location,
    href: `/landscape/${r.slug}`,
    consent: { shown: true },
  }));
}
