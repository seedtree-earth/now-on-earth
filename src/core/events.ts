/**
 * Ecological events: seasonal patterns built from dated, located records.
 *
 * A SeasonalEvent is what the build scripts write (see scripts/ecology/):
 * counts per grid cell per month, never individual sightings. It is shown as
 * a general seasonal pattern, softened and blended month to month, not as
 * tracks. Records gather where people look (coasts, headlands, whale-watching
 * towns), so the pattern says where a thing is seen in a season, not a census.
 */

import type { LngLat } from "./sun.js";
import type { FeatureCollection, Position } from "./rings.js";

export type EventMonth = {
  /** 1 = January. */
  month: number;
  records: number;
  /** [lng, lat, count] per grid cell. */
  cells: Array<[number, number, number]>;
};

export type SeasonalEvent = {
  id: string;
  name: string;
  species?: string;
  region: string;
  /** Grid cell size in degrees. */
  grid: number;
  months: EventMonth[];
  /** Twelve phrases, January first: the general pattern in words. */
  story?: string[];
  /** A short credit line for the UI. */
  credit?: string;
  /** What the pattern can and cannot say. */
  note?: string;
  /** Where the full source list and licences live. */
  sourcesUrl?: string;
  licences?: string;
  sources?: unknown;
};

export type EventFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: Position };
  /** `w` is the cell's weight, 0..1, on one scale across the whole year. */
  properties: { month: number; w: number };
};

/**
 * Every cell of every month as weighted points. Weights are log-scaled against
 * the busiest cell of the year, so quiet months stay faint rather than being
 * stretched to look as full as the peak.
 */
export function eventFeatures(event: SeasonalEvent): FeatureCollection<EventFeature> {
  const max = Math.max(1, ...event.months.flatMap((m) => m.cells.map((c) => c[2])));
  const norm = Math.log1p(max);
  return {
    type: "FeatureCollection",
    features: event.months.flatMap((m) =>
      m.cells.map(([lng, lat, n]) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [lng, lat] as Position },
        properties: { month: m.month, w: Math.log1p(n) / norm },
      })),
    ),
  };
}

/**
 * Where a date sits between two months' patterns: `from` and `to` (1..12) and
 * how far across, so the layer can blend smoothly as the year slider turns.
 * Each month's pattern is centred mid-month. Taken at the region's own solar
 * day, so the turn of the month is local.
 */
export function monthBlend(date: Date, at: LngLat = { lng: 150, lat: -30 }): { from: number; to: number; t: number } {
  const local = new Date(date.getTime() + (at.lng / 15) * 3600000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth(); // 0..11
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const pos = m + (local.getUTCDate() - 0.5 + local.getUTCHours() / 24) / days - 0.5; // months since mid-January
  const base = Math.floor(pos);
  const t = pos - base;
  const from = (((base % 12) + 12) % 12) + 1;
  const to = (from % 12) + 1;
  return { from, to, t };
}

/** The event's words for a date: the phrase of whichever month is nearer. */
export function eventStory(event: SeasonalEvent, date: Date, at?: LngLat): string | undefined {
  if (!event.story?.length) return undefined;
  const { from, to, t } = monthBlend(date, at);
  return event.story[(t < 0.5 ? from : to) - 1];
}

// ------------------------------------------------------------ placeholders

/**
 * PLACEHOLDER · partnered seasonal knowledge. Not built, and never scraped.
 *
 * Local and Indigenous seasonal calendars belong to their holders. They will
 * come in only through partnership, with permission, on the holders' terms
 * (following Indigenous Cultural and Intellectual Property principles). This
 * shape records who shared what and how it may be shown; nothing fills it yet.
 */
export type PartneredKnowledge = {
  id: string;
  /** Who holds and shared this knowledge, in their own words. */
  heldBy: string;
  /** Country or place it belongs to, as the holders name it. */
  country: string;
  /** The seasons or signs, as the holders chose to share them. */
  seasons: Array<{ name: string; description: string; signs?: string[] }>;
  /** The permission given: by whom, when, and for what. */
  permission: { grantedBy: string; date: string; scope: string };
  /** How it may be shown (e.g. only on this Country, never translated). */
  displayTerms: string;
  /** How it may be withdrawn; honoured without question. */
  withdrawal: string;
};

/**
 * PLANNED · community ground-truthing. Not built.
 *
 * People confirm what they actually see by logging it on iNaturalist (in a
 * SeedTree project), and a build-time script pulls those observations back:
 * research grade, CC0 or CC BY only, coarsened, aggregated by month and cell
 * exactly like the event data, so "what people are seeing this season" can sit
 * beside the long-run pattern. We do not run our own sightings database.
 */
export type GroundTruthObservation = {
  source: "inaturalist";
  /** Links back to https://www.inaturalist.org/observations/<id>. */
  observationId: number;
  taxon: { name: string; inaturalistTaxonId: number };
  /** Date only; no time of day is kept. */
  observedOn: string;
  /** Coarsened to 0.1°; iNaturalist's obscured locations are respected. */
  place: LngLat;
  qualityGrade: "research";
  /** Per observation; only CC0 and CC BY are kept. */
  licence: string;
  /** iNaturalist's own attribution string for the observation. */
  attribution: string;
  /** The SeedTree iNaturalist project it was logged to, if any. */
  project?: string;
};

/** What the layer would draw: confirmations per month and cell, never people. */
export type GroundTruthMonth = {
  eventId: string;
  month: number;
  year: number;
  confirmed: number;
  cells: Array<[number, number, number]>;
};
