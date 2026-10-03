import { describe, expect, it } from "vitest";
import { TURNINGS, turningsBetween, wheelAt } from "../src/core/index.js";

const utc = (s: string) => new Date(s);

describe("the wheel of the year", () => {
  it("finds all eight turnings from the sun, cross-quarters at the true midpoints", () => {
    const t = turningsBetween(utc("2026-01-01T00:00:00Z"), utc("2026-12-31T23:59:00Z"));
    expect(t.map((x) => x.turning.north.name)).toEqual(["Imbolc", "Ostara", "Beltane", "Litha", "Lughnasadh", "Mabon", "Samhain", "Yule"]);
    const day = (name: string) => t.find((x) => x.turning.north.name === name)!.date.toISOString().slice(5, 10);
    expect(day("Ostara")).toBe("03-20");
    expect(day("Litha")).toBe("06-21");
    // The astronomical Beltane and Samhain fall days after the calendar's 1 May and 31 October.
    expect(["05-04", "05-05", "05-06"]).toContain(day("Beltane"));
    expect(["11-06", "11-07", "11-08"]).toContain(day("Samhain"));
  });

  it("turns opposite in each hemisphere", () => {
    for (const t of TURNINGS) {
      const opposite = TURNINGS.find((o) => (o.longitude + 180) % 360 === t.longitude)!;
      expect(t.south.name).toBe(opposite.north.name);
    }
    const beltane = utc("2026-05-05T12:00:00Z");
    expect(wheelAt(beltane, 51).words).toMatch(/Beltane/);
    expect(wheelAt(beltane, -28.8).words).toMatch(/Samhain/);
  });

  it("speaks of nearness in words, never numbers", () => {
    const solstice = utc("2026-06-21T08:24:00Z");
    const before = new Date(solstice.getTime() - 4 * 86400000);
    const after = new Date(solstice.getTime() + 3 * 86400000);
    expect(wheelAt(before, -28.8).words).toBe("approaching Yule, the longest night");
    expect(wheelAt(after, 51).words).toBe("just past Litha, the longest day");
    expect(wheelAt(solstice, 51).near?.how).toBe("at");
    for (const d of [before, after, utc("2026-04-10T00:00:00Z"), utc("2026-10-02T00:00:00Z")]) expect(wheelAt(d, 0).words).not.toMatch(/\d/);
  });

  it("gives each hemisphere its own season", () => {
    const now = utc("2026-10-02T00:00:00Z");
    expect(wheelAt(now, -28.8).season).toBe("spring");
    expect(wheelAt(now, 51).season).toBe("autumn");
    expect(wheelAt(utc("2026-05-20T00:00:00Z"), 51).season).toBe("summer"); // past Beltane: summer on this wheel
  });
});

import { moonQuality, moonState } from "../src/core/index.js";

describe("the moon's qualities", () => {
  // 2026: new moon 11 October 03:50 UTC, full moon 26 October 04:12 UTC.
  const at = (s: string) => moonQuality(moonState(new Date(s)));
  it("keeps rest for the dark moon, intention as it grows, illumination at the full, release as it wanes", () => {
    expect(at("2026-10-10T00:00:00Z").kind).toBe("rest");
    expect(at("2026-10-11T04:00:00Z").kind).toBe("rest");
    expect(at("2026-10-13T00:00:00Z").kind).toBe("intention");
    expect(at("2026-10-13T00:00:00Z").part).toBe("the new moon");
    expect(at("2026-10-20T00:00:00Z").part).toBe("the waxing moon");
    expect(at("2026-10-26T04:00:00Z").kind).toBe("illumination");
    expect(at("2026-11-02T00:00:00Z").kind).toBe("release");
    for (const d of ["2026-10-10", "2026-10-20", "2026-10-26", "2026-11-02"]) expect(at(`${d}T00:00:00Z`).words).not.toMatch(/\d/);
  });
});
