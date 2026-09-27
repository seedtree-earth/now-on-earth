import { describe, expect, it } from "vitest";
import { dayLengthShare, sunState } from "../src/core/index.js";
import {
  SPOTLIGHT_REACH,
  describeFlat,
  flatDayShare,
  flatSky,
  sunPlan,
  toPlan,
} from "../site/src/flat/model.js";

const utc = (s: string) => new Date(s);
const equinox = sunState(utc("2026-03-20T14:46:00Z"));
const december = sunState(utc("2026-12-21T20:50:00Z"));
const june = sunState(utc("2026-06-21T08:24:00Z"));

describe("the flat model's geometry", () => {
  it("puts the North Pole at the centre and the South Pole on the rim", () => {
    expect(toPlan({ lng: 0, lat: 90 })).toEqual({ x: 0, y: -0 });
    expect(Math.hypot(toPlan({ lng: 37, lat: -90 }).x, toPlan({ lng: 37, lat: -90 }).y)).toBeCloseTo(180, 9);
  });

  it("stands the sun over the real subsolar point, on today's tropic", () => {
    const s = sunPlan(december);
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(90 - december.declination, 9);
  });

  it("is calibrated to twelve hours on the equator at the equinox", () => {
    expect(SPOTLIGHT_REACH).toBeCloseTo(127.28, 2);
    expect(flatDayShare(0, 0)).toBeCloseTo(0.5, 9);
    expect(flatDayShare(0, equinox.declination)).toBeCloseTo(0.5, 2);
  });

  it("keeps the sun above the horizon everywhere, lit or not", () => {
    for (const lat of [80, 40, 0, -40, -80]) {
      for (let lng = -180; lng < 180; lng += 30) expect(flatSky({ lng, lat }, december).elevation).toBeGreaterThan(0);
    }
  });
});

describe("what it predicts, beside the globe", () => {
  it("agrees with the globe on the equator at the equinox", () => {
    expect(flatDayShare(0, 0)).toBeCloseTo(dayLengthShare(0, 0), 9);
  });

  it("gives the Arctic its midnight sun in June", () => {
    expect(flatDayShare(80, june.declination)).toBe(1);
    expect(dayLengthShare(80, june.declination)).toBe(1);
  });

  it("differs for Antarctica in December: part of a day, not the midnight sun", () => {
    expect(dayLengthShare(-80, december.declination)).toBe(1);
    expect(flatDayShare(-80, december.declination)).toBeLessThan(0.5);
  });

  it("differs for southern summer days", () => {
    // Sydney at the December solstice.
    expect(dayLengthShare(-33.9, december.declination)).toBeGreaterThan(0.58);
    expect(flatDayShare(-33.9, december.declination)).toBeLessThan(0.45);
  });

  it("speaks without numbers", () => {
    const w = describeFlat(utc("2026-12-21T12:00:00Z"), { lng: 153.3, lat: -28.8 });
    expect(w.sentence).not.toMatch(/\d/);
    expect(w.phase).toBeTruthy();
  });
});

describe("the flat model's own turning points", () => {
  it("names its longest or shortest day at a solstice rather than a standstill", () => {
    const w = describeFlat(utc("2026-12-21T20:50:00Z"), { lng: 153.3, lat: -28.8 });
    expect(w.days).toMatch(/shortest day|longest day/);
  });
});
