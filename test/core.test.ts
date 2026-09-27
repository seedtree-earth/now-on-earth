import { describe, expect, it } from "vitest";
import {
  angularDistance,
  cap,
  dayLengthShare,
  describeLight,
  rings,
  seasonLines,
  seasonWords,
  stackedOpacity,
  sunState,
  type Position,
} from "../src/core/index.js";

const utc = (s: string) => new Date(s);

describe("sunState", () => {
  it("puts the sun on the equator at the March equinox", () => {
    // 2024 March equinox: 03:06 UTC on 20 March.
    const s = sunState(utc("2024-03-20T03:06:00Z"));
    expect(Math.abs(s.declination)).toBeLessThan(0.02);
  });

  it("puts the sun on the Tropic of Cancer at the June solstice", () => {
    // 2024 June solstice: 20:51 UTC on 20 June.
    const s = sunState(utc("2024-06-20T20:51:00Z"));
    expect(s.declination).toBeCloseTo(23.44, 1);
    expect(s.declination).toBeCloseTo(s.obliquity, 2);
  });

  it("carries the equation of time", () => {
    // Early November the sundial runs about 16.4 minutes fast; mid February
    // about 14.2 minutes slow.
    expect(sunState(utc("2024-11-03T12:00:00Z")).equationOfTime).toBeCloseTo(16.4, 0);
    expect(sunState(utc("2024-02-11T12:00:00Z")).equationOfTime).toBeCloseTo(-14.2, 0);
  });

  it("places apparent noon west of Greenwich by the equation of time", () => {
    const s = sunState(utc("2024-11-03T12:00:00Z"));
    // 16.4 minutes fast means apparent noon already passed Greenwich: sun is
    // overhead about 4.1 degrees west of the prime meridian.
    expect(s.subsolar.lng).toBeCloseTo(-4.1, 0);
  });

  it("keeps the antisolar point opposite", () => {
    const s = sunState(utc("2026-09-26T05:00:00Z"));
    expect(angularDistance(s.subsolar, s.antisolar)).toBeCloseTo(180, 6);
  });
});

describe("dayLengthShare", () => {
  it("is half a day everywhere at an equinox", () => {
    expect(dayLengthShare(-28.8, 0)).toBeCloseTo(0.5, 6);
    expect(dayLengthShare(60, 0)).toBeCloseTo(0.5, 6);
  });
  it("gives midnight sun and polar night past the circles", () => {
    expect(dayLengthShare(80, 23.4)).toBe(1);
    expect(dayLengthShare(-80, 23.4)).toBe(0);
  });
});

const inRange = (p: Position) => p[0] >= -180 && p[0] <= 180 && p[1] >= -90 && p[1] <= 90;

/** Ray-cast point in polygon on plain lon/lat (valid because caps are cut). */
function inside(pt: Position, ring: Position[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
const insideCap = (pt: Position, c: ReturnType<typeof cap>) => c.polygons.some((poly) => inside(pt, poly[0]));

describe("cap", () => {
  it("cuts a cap that straddles the antimeridian into two clean pieces", () => {
    const c = cap({ lng: 175, lat: 10 }, 20);
    expect(c.polygons.length).toBe(2);
    for (const poly of c.polygons) for (const p of poly[0]) expect(inRange(p)).toBe(true);
    expect(insideCap([179, 10], c)).toBe(true);
    expect(insideCap([-175, 10], c)).toBe(true);
    expect(insideCap([0, 10], c)).toBe(false);
  });

  it("closes a cap that holds a pole along the pole", () => {
    const c = cap({ lng: 30, lat: 70 }, 40);
    expect(c.polygons.length).toBe(1);
    const ring = c.polygons[0][0];
    expect(ring.some((p) => Math.abs(p[1] - 84.8) < 1e-9)).toBe(true);
    for (const p of ring) expect(inRange(p)).toBe(true);
    expect(insideCap([-150, 84.5], c)).toBe(true); // across the pole
    expect(insideCap([30, 20], c)).toBe(false);
  });

  it("matches angular distance at sampled points", () => {
    const center = { lng: -40, lat: -15 };
    const c = cap(center, 45);
    for (let lng = -180; lng < 180; lng += 7) {
      for (let lat = -84; lat <= 84; lat += 7) {
        const d = angularDistance(center, { lng, lat });
        if (Math.abs(d - 45) < 1.5) continue; // too near the edge to judge
        expect(insideCap([lng, lat], c)).toBe(d < 45);
      }
    }
  });

  it("covers a lit hemisphere on any date, including near the equinox", () => {
    for (const iso of ["2026-03-20T14:46:00Z", "2026-06-21T08:24:00Z", "2026-12-21T20:50:00Z", "2026-09-26T23:59:00Z"]) {
      const s = sunState(utc(iso));
      const c = cap(s.subsolar, 90);
      expect(c.polygons.length).toBeGreaterThan(0);
      expect(insideCap([s.subsolar.lng, s.subsolar.lat], c)).toBe(true);
      expect(insideCap([s.antisolar.lng, s.antisolar.lat], c)).toBe(false);
    }
  });
});

describe("terminator seam", () => {
  // Day and night caps meet on one great circle. Every point on Earth, polar
  // regions included, must fall in exactly one of them: no gap, no overlap.
  const cases: Array<[string, { lng: number; lat: number }]> = [
    ["just past the September equinox", { lng: 61.3, lat: -1.5 }],
    ["a hair off the equinox, skimming both poles", { lng: -172.4, lat: 0.03 }],
    ["the June solstice, across the antimeridian", { lng: 178.9, lat: 23.44 }],
    ["the December solstice", { lng: -3.2, lat: -23.44 }],
  ];
  for (const [name, sun] of cases) {
    it(name, () => {
      const anti = { lng: sun.lng > 0 ? sun.lng - 180 : sun.lng + 180, lat: -sun.lat };
      const day = cap(sun, 90);
      const night = cap(anti, 90);
      for (const poly of [...day.polygons, ...night.polygons]) for (const p of poly[0]) expect(inRange(p)).toBe(true);
      for (let lng = -179; lng < 180; lng += 4) {
        for (let lat = -84.5; lat <= 84.5; lat += 2.5) {
          const d = angularDistance(sun, { lng, lat });
          if (Math.abs(d - 90) < 0.4) continue; // on the line itself
          const inDay = insideCap([lng, lat], day);
          const inNight = insideCap([lng, lat], night);
          expect(inDay !== inNight, `${lng},${lat}`).toBe(true);
          expect(inDay).toBe(d < 90);
        }
      }
    });
  }
});

describe("rings", () => {
  it("makes six hour-rings, largest first, and eighteen in fine mode", () => {
    const s = sunState(utc("2026-09-26T05:00:00Z"));
    const coarse = rings(s.subsolar, "day", 15);
    expect(coarse.fills.features.map((f) => f.properties.radius)).toEqual([90, 75, 60, 45, 30, 15]);
    expect(rings(s.antisolar, "night", 5).fills.features.length).toBe(18);
  });

  it("stacks to the same depth whatever the spacing", () => {
    for (const n of [6, 18]) expect(1 - Math.pow(1 - stackedOpacity(n, 0.5), n)).toBeCloseTo(0.5, 9);
  });
});

describe("seasonLines", () => {
  it("splits the viewer's parallel into lit and dark in the right proportion", () => {
    const s = sunState(utc("2026-06-21T02:00:00Z"));
    const fc = seasonLines(s, { lng: 153.3, lat: -28.8 });
    const len = (kind: string) =>
      fc.features
        .filter((f) => f.properties.kind === kind)
        .flatMap((f) => f.geometry.coordinates)
        .reduce((sum, line) => sum + (line[line.length - 1][0] - line[0][0]), 0);
    const lit = len("me-lit");
    const dark = len("me-dark");
    expect(lit / (lit + dark)).toBeCloseTo(dayLengthShare(-28.8, s.declination), 2);
    expect(lit).toBeLessThan(dark); // winter in the Northern Rivers
  });
});

describe("describeLight", () => {
  const byron = { lng: 153.3, lat: -28.8 };
  it("calls local solar noon midday, with the sun to the north in the south", () => {
    // Solar noon at 153.3E is about 01:47 UTC; pick a September day.
    const w = describeLight(utc("2026-09-26T01:40:00Z"), byron);
    expect(w.phase).toBe("around midday");
    expect(w.sky).toMatch(/north/);
    expect(w.season).toBe("early spring");
    expect(w.caption).not.toMatch(/\d/);
    expect(w.sentence).not.toMatch(/\d/);
  });

  it("knows late afternoon sun in the west", () => {
    const w = describeLight(utc("2026-09-26T06:30:00Z"), byron);
    expect(["late afternoon", "golden hour"]).toContain(w.phase);
    expect(w.sky).toMatch(/west/);
  });

  it("finds the middle of the night", () => {
    const w = describeLight(utc("2026-09-26T13:45:00Z"), byron);
    expect(w.phase).toBe("the middle of the night");
  });

  it("flips seasons by hemisphere", () => {
    expect(seasonWords(utc("2026-01-15T00:00:00Z"), { lng: 0, lat: 51 })).toBe("mid winter");
    expect(seasonWords(utc("2026-01-15T00:00:00Z"), byron)).toBe("mid summer");
  });
});
