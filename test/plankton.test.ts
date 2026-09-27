import { describe, expect, it } from "vitest";
import { isOcean, planktonAt, planktonField, planktonWords, sunState } from "../src/core/index.js";

const utc = (s: string) => new Date(s);

describe("the ocean mask", () => {
  it("knows sea from land", () => {
    expect(isOcean(0, -140)).toBe(true); // the open Pacific
    expect(isOcean(-30, 80)).toBe(true); // the Indian Ocean
    expect(isOcean(-25, 134)).toBe(false); // central Australia
    expect(isOcean(47, 2)).toBe(false); // France
    expect(isOcean(10, -40)).toBe(true); // the Atlantic
  });
});

describe("plankton's nightly rise (a model)", () => {
  const byron = { lng: 153.3, lat: -28.8 };
  it("rests in the deep by day and rises at dusk", () => {
    expect(planktonAt(byron, sunState(utc("2026-09-27T01:40:00Z"))).phase).toBe("deep"); // midday
    const dusk = planktonAt(byron, sunState(utc("2026-09-27T08:20:00Z"))); // just after sunset
    expect(dusk.phase).toBe("rising");
    expect(dusk.level).toBeGreaterThan(0);
    expect(dusk.level).toBeLessThan(1);
  });

  it("stays near the surface at night and sinks before dawn", () => {
    expect(planktonAt(byron, sunState(utc("2026-09-27T14:00:00Z"))).phase).toBe("night");
    expect(planktonAt(byron, sunState(utc("2026-09-27T19:10:00Z"))).phase).toBe("sinking");
  });

  it("glows only over the sea, and only on the dark side", () => {
    const sun = sunState(utc("2026-09-27T08:00:00Z"));
    const fc = planktonField(sun);
    expect(fc.features.length).toBeGreaterThan(1000);
    for (const f of fc.features.slice(0, 500)) {
      const [lng, lat] = f.geometry.coordinates;
      expect(isOcean(lat, lng)).toBe(true);
      expect(planktonAt({ lng, lat }, sun).phase).not.toBe("deep");
    }
    // Brightest along the dusk edge, where they are arriving.
    const max = (p: string) => Math.max(0, ...fc.features.filter((f) => f.properties.phase === p).map((f) => f.properties.w));
    expect(max("rising")).toBeGreaterThan(max("night"));
  });

  it("speaks of the sea without numbers", () => {
    expect(planktonWords(byron, sunState(utc("2026-09-27T08:20:00Z")))).toMatch(/rising/);
    expect(planktonWords(byron, sunState(utc("2026-09-27T01:40:00Z")))).not.toMatch(/\d/);
  });
});
