/**
 * Hearts Now: the inward view. The same engine as the globe, turned toward
 * one place and one moment: where the person stands on their own wheel, the
 * quality of the light, the moon's quality, one reflection question for this
 * point in the season, and an invitation to go outside and notice something.
 *
 * The questions and invitations are content, not code: one JSON file per
 * season and per turning, in content/turning/ (see its README). Each carries
 * a review status; a host shows only reviewed content to the public.
 *
 * Nothing a person thinks or writes here is stored. A private seasonal
 * record belongs with the individual journey (V4), with its own privacy
 * design and people owning their data: see SeasonalRecord below, which is a
 * placeholder only.
 */

import { type MoonQuality, moonQuality, moonState } from "./moon.js";
import { type LngLat, sunState } from "./sun.js";
import { type Season, type Turning, type WheelPlace, turningName, wheelAt } from "./wheel.js";

/** One file of seasonal content: a season, or a turning of the wheel. */
export type TurningContent = {
  /** "spring" for a season; the northern-wheel name for a turning ("beltane"). */
  id: string;
  kind: "season" | "turning";
  /** For a turning: the Celtic/European name it carries in the hemisphere where it falls. */
  name: string;
  /** A few words on the quality of this time. */
  description: string;
  /** One question to sit with. Never more than one. */
  reflection: string;
  /** A closing invitation to go outside and notice something of this season. */
  invitation: string;
  /** Who has reviewed it; only "reviewed" content goes live. */
  status: "draft" | "reviewed";
  reviewedBy: string | null;
};

/** The light's quality in words: lengthening or shortening, near or far from a solstice. Numberless. */
export function lightQuality(date: Date, at: LngLat): string {
  if (Math.abs(at.lat) < 8) return "Near the equator the days stay close to even all year; it is the sun's height at noon that turns.";
  // The year as this hemisphere lives it: 90 is its longest day, 270 its shortest.
  const lambda = sunState(date).eclipticLongitude;
  const t = (((at.lat >= 0 ? lambda : lambda + 180) % 360) + 360) % 360;
  const lengthening = t >= 270 || t < 90;
  const grow = lengthening ? "lengthening" : "shortening";
  if (t >= 270 && t < 278) return "The days have only just begun to lengthen, the shortest day barely behind.";
  if (t >= 90 && t < 98) return "The days have only just begun to shorten, the longest day barely behind.";
  if (t >= 82 && t < 90) return "The days are still lengthening, the longest day very near.";
  if (t >= 262 && t < 270) return "The days are still shortening, the shortest day very near.";
  // Near an equinox the length of the day changes fastest.
  if (t >= 345 || t < 15 || (t >= 165 && t < 195)) return `The days are ${grow} at their quickest, day and night near even.`;
  if (t < 90) return "The days are lengthening, the longest day drawing nearer.";
  if (t < 180) return "The days are shortening, the longest day behind.";
  if (t < 270) return "The days are shortening, the shortest day drawing nearer.";
  return "The days are lengthening, the shortest day behind.";
}

export type HeartsNow = {
  wheel: WheelPlace;
  /** The season on this wheel, and the turning nearest, in words. */
  where: string;
  light: string;
  moon: MoonQuality;
  /** The content chosen for this moment: the nearby turning's if near one, otherwise the season's. */
  content: TurningContent | null;
};

/** What Hearts Now says for a place and a moment, from the given content files. */
export function heartsNow(date: Date, at: LngLat, content: TurningContent[]): HeartsNow {
  const wheel = wheelAt(date, at.lat);
  const seasonName = (s: Season) => s.charAt(0).toUpperCase() + s.slice(1);
  const where = `${seasonName(wheel.season)} on your wheel: ${wheel.words}.`;
  const near = wheel.near ? turningName(wheel.near.turning as Turning, wheel.hemisphere) : null;
  const byTurning = near ? content.find((c) => c.kind === "turning" && c.name.toLowerCase() === near.name.toLowerCase()) : undefined;
  const bySeason = content.find((c) => c.kind === "season" && c.id === wheel.season);
  return {
    wheel,
    where,
    light: lightQuality(date, at),
    moon: moonQuality(moonState(date)),
    content: byTurning ?? bySeason ?? null,
  };
}

/** The closing line when no reviewed invitation is to hand: still, every moment ends outside. */
export const GO_OUTSIDE = "Now put the screen down for a while, and go and see the season for yourself.";

/**
 * PLACEHOLDER ONLY: a private seasonal record, for the individual journey
 * (V4). Not built, and nothing is stored in this version. It will need its
 * own privacy design: kept by the person, readable only by them, exportable
 * and deletable, never used to draw them back.
 */
export type SeasonalRecord = never;
