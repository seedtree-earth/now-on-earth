/**
 * Ground notes: what people notice where they are. The first frost, rain in
 * the gauge, the jacarandas flowering, the cicadas starting up. Small, dated,
 * placed coarsely, and given freely, so the seasons can be read from the
 * ground as well as from the sky.
 *
 * The line this module holds, like people.ts:
 *
 * - A note is given, never gathered: it exists only because someone wrote it
 *   and chose to share it (`consent.shared`).
 * - Coarse places only: every note is rounded here to 0.1° (about ten
 *   kilometres), whatever arrives. No device position is read.
 * - A date, never a time of day.
 * - Anonymous unless the writer gives a name for credit.
 * - Open licences only, matching the rest of the clock's data: CC0 or CC BY
 *   4.0, chosen by the writer. Never NC, ND or SA.
 *
 * Species seen up close (with a photo, to be identified) belong on
 * iNaturalist, where they can be checked; ground notes are for the season's
 * signs, the things a neighbour would mention over the fence.
 */

import { type LngLat, angularDistance } from "./sun.js";
import type { FeatureCollection, Position } from "./rings.js";

export type GroundNoteGroup = "weather" | "life";

export type GroundNoteKind =
  | "first-frost"
  | "last-frost"
  | "rainfall"
  | "first-snow"
  | "storm"
  | "heat"
  | "flowering"
  | "fruiting"
  | "leaves-turning"
  | "cicadas"
  | "frogs"
  | "birds-arriving"
  | "birds-leaving"
  | "insects"
  | "other";

export type GroundNoteKindInfo = {
  kind: GroundNoteKind;
  group: GroundNoteGroup;
  /** As offered in the form. */
  label: string;
  /** Asks "what?" (a plant, a bird). Required where `what` is "required". */
  what?: "required" | "optional";
  /** A hint for the "what?" field. */
  whatHint?: string;
  /** Takes an amount: millimetres of rain. */
  amount?: boolean;
};

export const GROUND_NOTE_KINDS: GroundNoteKindInfo[] = [
  { kind: "first-frost", group: "weather", label: "The first frost of the season" },
  { kind: "last-frost", group: "weather", label: "The last frost of the season" },
  { kind: "rainfall", group: "weather", label: "Rain in the gauge", amount: true },
  { kind: "first-snow", group: "weather", label: "The first snow" },
  { kind: "storm", group: "weather", label: "A storm", what: "optional", whatHint: "hail, a southerly buster" },
  { kind: "heat", group: "weather", label: "A heatwave" },
  { kind: "flowering", group: "life", label: "In flower", what: "required", whatHint: "jacarandas, wattle" },
  { kind: "fruiting", group: "life", label: "In fruit", what: "required", whatHint: "mulberries, figs" },
  { kind: "leaves-turning", group: "life", label: "Leaves turning or falling", what: "optional", whatHint: "the liquidambars" },
  { kind: "cicadas", group: "life", label: "Cicadas calling" },
  { kind: "frogs", group: "life", label: "Frogs calling", what: "optional" },
  { kind: "birds-arriving", group: "life", label: "Birds arriving", what: "optional", whatHint: "the koels are back" },
  { kind: "birds-leaving", group: "life", label: "Birds leaving", what: "optional" },
  { kind: "insects", group: "life", label: "Insects out", what: "optional", whatHint: "fireflies, Christmas beetles" },
  { kind: "other", group: "life", label: "Something else", what: "required", whatHint: "what you noticed" },
];

export const kindInfo = (kind: GroundNoteKind): GroundNoteKindInfo =>
  GROUND_NOTE_KINDS.find((k) => k.kind === kind) ?? GROUND_NOTE_KINDS[GROUND_NOTE_KINDS.length - 1];

export type GroundNoteLicence = "CC0-1.0" | "CC-BY-4.0";

export type GroundNote = {
  /** Opaque and stable. */
  id: string;
  kind: GroundNoteKind;
  /** The plant, bird or thing, in the writer's words. */
  what?: string;
  /** Millimetres of rain, for "rainfall". */
  amount?: number;
  /** The day it was noticed, YYYY-MM-DD. No time of day. */
  observedOn: string;
  /** Rounded to 0.1° on the way in. */
  place: LngLat;
  /** A few words more, if they like. */
  note?: string;
  /** A name for credit, only if they gave one. */
  by?: string;
  licence: GroundNoteLicence;
  consent: { shared: true; at: string };
  /** Where it was written: this site, the Landscape. */
  source: string;
};

export type GroundNoteInput = {
  kind: GroundNoteKind;
  what?: string;
  amount?: number | string;
  observedOn: string;
  place: LngLat;
  note?: string;
  by?: string;
  licence: GroundNoteLicence;
  /** Must be true: the writer chose to share it. */
  shared: boolean;
  source?: string;
  id?: string;
};

export const GROUND_NOTE_PRECISION = 0.1;
export const NOTE_MAX = 280;
export const WHAT_MAX = 60;
export const NAME_MAX = 40;

const round = (x: number) => Math.round(x / GROUND_NOTE_PRECISION) * GROUND_NOTE_PRECISION;
const tidy = (s: string | undefined, max: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return t || undefined;
};
const DAY = 86_400_000;

/** A place rounded to the notes' precision (about ten kilometres). */
export function coarsenNotePlace(p: LngLat): LngLat {
  return { lng: Number(round(p.lng).toFixed(1)), lat: Number(round(p.lat).toFixed(1)) };
}

const newId = () => `gn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Check and shape a note before it is kept. Returns the note, or the problems
 * in plain words for the form to show.
 */
export function makeGroundNote(
  input: GroundNoteInput,
  now = new Date(),
): { ok: true; note: GroundNote } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const info = GROUND_NOTE_KINDS.find((k) => k.kind === input.kind);
  if (!info) problems.push("Choose what you noticed.");
  if (!input.shared) problems.push("Notes are only kept if you choose to share them.");
  if (input.licence !== "CC0-1.0" && input.licence !== "CC-BY-4.0") problems.push("Choose how it may be shared.");
  const what = tidy(input.what, WHAT_MAX);
  if (info?.what === "required" && !what) problems.push(`Say what (${info.whatHint ?? "a few words"}).`);
  let amount: number | undefined;
  if (info?.amount) {
    amount = input.amount === "" || input.amount === undefined ? NaN : Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 2000) problems.push("Give the rain in millimetres.");
  }
  const day = Date.parse(`${input.observedOn}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.observedOn) || Number.isNaN(day)) problems.push("Give the day you noticed it.");
  else if (day > now.getTime() + DAY) problems.push("The day cannot be in the future.");
  else if (day < now.getTime() - 366 * DAY) problems.push("Notes go back a year at most.");
  const { lng, lat } = input.place ?? ({} as LngLat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) problems.push("Choose a place.");
  if (problems.length || !info) return { ok: false, problems };
  return {
    ok: true,
    note: {
      id: input.id ?? newId(),
      kind: info.kind,
      ...(what && info.what ? { what } : {}),
      ...(amount !== undefined ? { amount: Math.round(amount * 10) / 10 } : {}),
      observedOn: input.observedOn,
      place: coarsenNotePlace(input.place),
      ...(tidy(input.note, NOTE_MAX) ? { note: tidy(input.note, NOTE_MAX) } : {}),
      ...(tidy(input.by, NAME_MAX) ? { by: tidy(input.by, NAME_MAX) } : {}),
      licence: input.licence,
      consent: { shared: true, at: now.toISOString() },
      source: input.source ?? "now-on-earth",
    },
  };
}

/** Only notes given to share, each rounded again: what arrives from any store. */
export function sharedNotes(notes: GroundNote[]): GroundNote[] {
  return notes.filter((n) => n.consent?.shared === true).map((n) => ({ ...n, place: coarsenNotePlace(n.place) }));
}

/** Days between the note and a moment (positive: the note is in the past). */
export function noteAge(note: GroundNote, date: Date): number {
  return (date.getTime() - Date.parse(`${note.observedOn}T12:00:00Z`)) / DAY;
}

/** "today", "yesterday", "four days ago", "last week", "in March". */
export function whenWords(note: GroundNote, date: Date): string {
  const d = Math.round(noteAge(note, date));
  const n = ["no", "one", "two", "three", "four", "five", "six"];
  if (d < 0) return d === -1 ? "tomorrow" : "later on";
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${n[d]} days ago`;
  if (d < 14) return "last week";
  if (d < 28) return `${["", "", "two", "three"][Math.floor(d / 7)]} weeks ago`;
  return `in ${new Date(`${note.observedOn}T12:00:00Z`).toLocaleString("en-AU", { month: "long", timeZone: "UTC" })}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the note says, in a line: "Jacarandas in flower, three days ago." */
export function groundNoteWords(note: GroundNote, date: Date): string {
  const when = whenWords(note, date);
  const what = note.what;
  let head: string;
  switch (note.kind) {
    case "first-frost":
      head = "The first frost of the season";
      break;
    case "last-frost":
      head = "The last frost of the season";
      break;
    case "rainfall":
      head = `${note.amount ?? 0} mm of rain in the gauge`;
      break;
    case "first-snow":
      head = "The first snow";
      break;
    case "storm":
      head = what ? `A storm: ${what}` : "A storm";
      break;
    case "heat":
      head = "A heatwave";
      break;
    case "flowering":
      head = `${cap(what ?? "something")} in flower`;
      break;
    case "fruiting":
      head = `${cap(what ?? "something")} in fruit`;
      break;
    case "leaves-turning":
      head = what ? `${cap(what)} turning` : "Leaves turning";
      break;
    case "cicadas":
      head = "Cicadas calling";
      break;
    case "frogs":
      head = what ? `${cap(what)} calling` : "Frogs calling";
      break;
    case "birds-arriving":
      head = what ? cap(what) : "Birds arriving";
      break;
    case "birds-leaving":
      head = what ? cap(what) : "Birds leaving";
      break;
    case "insects":
      head = what ? `${cap(what)} out` : "Insects out";
      break;
    default:
      head = cap(what ?? "Something noticed");
  }
  const said = note.note ? ` “${note.note}”` : "";
  return `${head}, ${when}.${said}`;
}

/** Credit as the licence asks: a name if given, otherwise a plain "someone nearby". */
export function groundNoteCredit(note: GroundNote): string {
  const who = note.by ?? "someone nearby";
  return note.licence === "CC0-1.0" ? `Noted by ${who} · CC0` : `Noted by ${who} · CC BY 4.0`;
}

/** Notes near a place and a moment, nearest in time first. */
export function notesNear(
  notes: GroundNote[],
  at: LngLat,
  date: Date,
  opts: { km?: number; days?: number } = {},
): GroundNote[] {
  const deg = (opts.km ?? 60) / 111.2;
  const days = opts.days ?? 30;
  return sharedNotes(notes)
    .filter((n) => angularDistance(n.place, at) <= deg)
    .filter((n) => {
      const a = noteAge(n, date);
      return a >= -1 && a <= days;
    })
    .sort((a, b) => Math.abs(noteAge(a, date)) - Math.abs(noteAge(b, date)));
}

export type GroundNoteFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: Position };
  properties: { id: string; kind: GroundNoteKind; group: GroundNoteGroup; fade: number; words: string };
};

/**
 * Notes as dots for the moment shown: full while fresh, fading over `days`,
 * not yet there before the day they were noticed.
 */
export function groundNoteFeatures(
  notes: GroundNote[],
  date: Date,
  group: GroundNoteGroup,
  days = 30,
): FeatureCollection<GroundNoteFeature> {
  const features: GroundNoteFeature[] = [];
  for (const n of sharedNotes(notes)) {
    const info = kindInfo(n.kind);
    if (info.group !== group) continue;
    const age = noteAge(n, date);
    if (age < -0.5 || age > days) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [n.place.lng, n.place.lat] },
      properties: { id: n.id, kind: n.kind, group, fade: Math.max(0.15, 1 - Math.max(0, age) / days), words: groundNoteWords(n, date) },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * Where notes are kept. The standalone site keeps them in the browser; the
 * Landscape passes a store backed by its own accounts and moderation.
 */
export interface GroundNoteStore {
  /** Where notes are kept, in words, for the form ("in this browser only"). */
  readonly where: string;
  list(): Promise<GroundNote[]>;
  add(note: GroundNote): Promise<void>;
  remove?(id: string): Promise<void>;
}
