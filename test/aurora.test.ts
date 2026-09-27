import { describe, expect, it } from "vitest";
import { auroraWords, darkness, sunState, typicalAurora, typicalOvalEdges } from "../src/core/index.js";
import { compactOvation } from "../api/aurora.js";

const utc = (s: string) => new Date(s);

describe("the typical oval", () => {
  const date = utc("2026-12-01T06:00:00Z");
  const sun = sunState(date);
  const pts = typicalAurora(date, sun);

  it("rings both geomagnetic poles, at auroral latitudes", () => {
    expect(pts.some((p) => p[1] > 55)).toBe(true);
    expect(pts.some((p) => p[1] < -55)).toBe(true);
    for (const [, lat] of pts) expect(Math.abs(lat)).toBeGreaterThan(45);
  });

  it("is brightest toward midnight", () => {
    // Midnight is opposite the sun's longitude.
    const midnight = ((sun.subsolar.lng + 360) % 360) - 180;
    const near = (lng: number, target: number) => Math.abs(((lng - target + 540) % 360) - 180) < 30;
    const max = (target: number) => Math.max(0, ...pts.filter((p) => p[1] > 0 && near(p[0], target)).map((p) => p[2]));
    expect(max(midnight)).toBeGreaterThan(max(sun.subsolar.lng));
  });

  it("has two edges in each hemisphere", () => {
    expect(typicalOvalEdges(date, sun).length).toBe(4);
  });
});

describe("aurora words and darkness", () => {
  it("speak only in the dark and where the oval is", () => {
    const date = utc("2026-12-01T22:00:00Z"); // night in Tromsø
    const sun = sunState(date);
    expect(darkness({ lng: 19, lat: 69.6 }, sun)).toBe(1);
    const points: Array<[number, number, number]> = [[19, 70, 15]];
    expect(auroraWords({ lng: 19, lat: 69.6 }, points, sun)).toMatch(/overhead/);
    expect(auroraWords({ lng: 153.3, lat: -28.8 }, points, sun)).toBeUndefined();
  });
});

describe("the aurora function", () => {
  it("keeps only cells worth drawing, in -180..180", () => {
    const raw = {
      "Observation Time": "t",
      "Forecast Time": "f",
      coordinates: [
        [0, 70, 0],
        [200, 65, 9],
        [359, -68, 3],
        [10, 10, 2],
      ] as Array<[number, number, number]>,
    };
    const out = compactOvation(raw);
    expect(out.points).toEqual([
      [-160, 65, 9],
      [-1, -68, 3],
    ]);
  });

});
