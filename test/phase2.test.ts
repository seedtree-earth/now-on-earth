import { describe, expect, it } from "vitest";
import {
  angularDistance,
  band,
  coarsen,
  consenting,
  describeLight,
  fromLandscapeRows,
  gmst,
  moonState,
  presenceFeatures,
  sunState,
  twilightBands,
  type Position,
  type Presence,
} from "../src/core/index.js";

const utc = (s: string) => new Date(s);

function inRing(pt: Position, ring: Position[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
/** Inside a polygon with holes: in the outer ring, in none of the holes. */
const inPolys = (pt: Position, polys: Position[][][]) =>
  polys.some(([outer, ...holes]) => inRing(pt, outer) && !holes.some((h) => inRing(pt, h)));

describe("moonState", () => {
  it("gmst matches J2000", () => {
    expect(gmst(utc("2000-01-01T12:00:00Z"))).toBeCloseTo(280.46, 1);
  });

  it("stands the full moon opposite the sun during the September 2024 eclipse", () => {
    const d = utc("2024-09-18T02:44:00Z");
    const m = moonState(d);
    expect(m.illumination).toBeGreaterThan(0.995);
    expect(m.phase).toBe("full");
    expect(angularDistance(m.sublunar, sunState(d).antisolar)).toBeLessThan(1.5);
  });

  it("puts the new moon on the sun during the April 2024 total eclipse", () => {
    const d = utc("2024-04-08T18:18:00Z");
    const m = moonState(d);
    expect(m.illumination).toBeLessThan(0.005);
    expect(m.phase).toBe("new");
    expect(angularDistance(m.sublunar, sunState(d).subsolar)).toBeLessThan(1.5);
  });

  it("knows a first quarter", () => {
    const m = moonState(utc("2024-09-11T06:06:00Z"));
    expect(m.illumination).toBeCloseTo(0.5, 1);
    expect(m.waxing).toBe(true);
    expect(m.phase).toBe("first quarter");
  });

  it("keeps the two tidal bulges opposite", () => {
    const m = moonState(utc("2026-09-27T00:00:00Z"));
    expect(angularDistance(m.sublunar, m.antisublunar)).toBeCloseTo(180, 6);
  });
});

describe("band", () => {
  const cases: Array<[string, { lng: number; lat: number }, number, number]> = [
    ["open ocean", { lng: 20, lat: 10 }, 30, 45],
    ["across the antimeridian", { lng: 176, lat: -5 }, 20, 40],
    ["holding a pole on the outside only", { lng: 40, lat: 60 }, 20, 40],
    ["both edges round the pole", { lng: -100, lat: 70 }, 30, 50],
  ];
  for (const [name, c, a, b] of cases) {
    it(name, () => {
      const polys = band(c, a, b);
      for (let lng = -178; lng < 180; lng += 6) {
        for (let lat = -84; lat <= 84; lat += 3) {
          const d = angularDistance(c, { lng, lat });
          if (Math.abs(d - a) < 0.8 || Math.abs(d - b) < 0.8) continue;
          expect(inPolys([lng, lat], polys), `${lng},${lat} d=${d.toFixed(1)}`).toBe(d > a && d < b);
        }
      }
    });
  }
});

describe("twilightBands", () => {
  const d = utc("2026-09-27T06:00:00Z");
  const sun = sunState(d);
  const fc = twilightBands(sun);
  // A point at a chosen sun altitude, east of the sun along its parallel
  // (the sun is near the equator, so this is within a hair of a great circle).
  const at = (alt: number): Position => {
    const lng = sun.subsolar.lng + (90 - alt);
    return [lng > 180 ? lng - 360 : lng, sun.subsolar.lat];
  };
  const kindsAt = (alt: number) =>
    fc.features.filter((f) => inPolys(at(alt), f.geometry.coordinates)).map((f) => f.properties.kind);

  it("places golden hour, the three twilights, and neither day nor night", () => {
    expect(kindsAt(3)).toEqual(["golden"]);
    expect(kindsAt(-3)).toEqual(["civil"]);
    expect(kindsAt(-9)).toEqual(["nautical"]);
    expect(kindsAt(-15)).toEqual(["astronomical"]);
    expect(kindsAt(30)).toEqual([]);
    expect(kindsAt(-30)).toEqual([]);
  });

  it("grades depth outward from the terminator", () => {
    const civil = fc.features.filter((f) => f.properties.kind !== "golden").map((f) => f.properties.depth);
    expect(civil).toEqual([...civil].sort((x, y) => x - y));
    expect(Math.max(...civil)).toBeLessThanOrEqual(1);
  });
});

describe("describeLight with the moon", () => {
  it("names the phase and speaks without numbers", () => {
    const d = utc("2024-09-18T12:00:00Z");
    const w = describeLight(d, { lng: 153.3, lat: -28.8 }, sunState(d), moonState(d));
    expect(w.moon).toMatch(/full moon/);
    expect(w.sentence).toMatch(/full moon/i);
    expect(w.sentence).not.toMatch(/\d/);
  });
});

describe("people", () => {
  const base: Presence = {
    id: "a",
    kind: "person",
    name: "Someone",
    place: { lng: 153.2871, lat: -28.6474 },
    consent: { shown: true },
  };

  it("shows only those who chose to be shown", () => {
    const out = consenting([base, { ...base, id: "b", consent: { shown: false } }, { ...base, id: "c", consent: undefined as never }]);
    expect(out.map((p) => p.id)).toEqual(["a"]);
  });

  it("never lets a precise point through", () => {
    expect(coarsen(base.place, "person")).toEqual({ lng: 153.5, lat: -28.5 });
    const [p] = consenting([base]);
    expect(p.place).toEqual({ lng: 153.5, lat: -28.5 });
  });

  it("gives each dot its own light", () => {
    const d = utc("2026-09-27T02:00:00Z"); // around midday in eastern Australia
    const fc = presenceFeatures(
      [base, { ...base, id: "lisbon", place: { lng: -9.1, lat: 38.7 } }],
      sunState(d),
    );
    const [byron, lisbon] = fc.features.map((f) => f.properties);
    expect(byron.altitude).toBeGreaterThan(40);
    expect(lisbon.altitude).toBeLessThan(-18);
    expect(lisbon.phase).not.toMatch(/\d/);
  });

  it("reads Landscape rows as public organisation listings", () => {
    const [p] = fromLandscapeRows([{ slug: "rainforest-rescue", kind: "tree", lat: -28.3, lng: 153.4, name: "Rainforest Rescue", location: "Mullumbimby" }]);
    expect(p.kind).toBe("organisation");
    expect(p.href).toBe("/landscape/rainforest-rescue");
    expect(p.consent.shown).toBe(true);
  });
});

import { PULL_RIM, seasonMarkWords, seasonMarks, springNeap, tidalPull, tideFeatures, tideWords } from "../src/core/index.js";

describe("seasonMarks", () => {
  it("finds the 2026 solstices and equinoxes to within half an hour", () => {
    const marks = seasonMarks(utc("2026-01-01T00:00:00Z"), utc("2026-12-31T23:59:00Z"));
    const expected: Array<[string, string]> = [
      ["march-equinox", "2026-03-20T14:46:00Z"],
      ["june-solstice", "2026-06-21T08:24:00Z"],
      ["september-equinox", "2026-09-23T00:05:00Z"],
      ["december-solstice", "2026-12-21T20:50:00Z"],
    ];
    expect(marks.map((m) => m.kind)).toEqual(expected.map((e) => e[0]));
    marks.forEach((m, i) => expect(Math.abs(m.date.getTime() - utc(expected[i][1]).getTime())).toBeLessThan(30 * 60000));
  });

  it("speaks for the hemisphere", () => {
    expect(seasonMarkWords("december-solstice", -28.8)).toMatch(/longest day/);
    expect(seasonMarkWords("december-solstice", 51)).toMatch(/shortest day/);
    expect(seasonMarkWords("september-equinox", -28.8)).toMatch(/spring equinox/);
  });
});

describe("tides", () => {
  it("swells under the moon and opposite, ebbs between", () => {
    expect(tidalPull(0)).toBeCloseTo(1, 9);
    expect(tidalPull(180)).toBeCloseTo(1, 9);
    expect(tidalPull(90)).toBeCloseTo(-0.5, 9);
    expect(tidalPull(PULL_RIM)).toBeCloseTo(0, 9);
  });

  it("is strongest at full moon and weakest at the quarter", () => {
    expect(springNeap(moonState(utc("2024-09-18T02:44:00Z")))).toBeGreaterThan(0.99);
    expect(springNeap(moonState(utc("2024-09-11T06:06:00Z")))).toBeLessThan(0.45);
  });

  it("draws swells, a low-water belt and a rim, and speaks of the pull only", () => {
    const m = moonState(utc("2024-09-18T02:44:00Z"));
    const kinds = new Set(tideFeatures(m).features.map((f) => f.properties.kind));
    expect([...kinds].sort()).toEqual(["ebb", "rim", "swell"]);
    expect(tideWords(m.sublunar, m)).toMatch(/lifting the seas here, in spring tides/);
    expect(tideWords(m.sublunar, m)).not.toMatch(/\d|high tide|low tide/);
  });
});

import { LENSES, lensOf } from "../src/mapbox/lenses.js";

describe("lenses", () => {
  it("opens only Light by default", () => {
    expect(LENSES.filter((l) => l.on).map((l) => l.id)).toEqual(["light"]);
  });
  it("places every layer in exactly one lens, and events in Life", () => {
    const all = LENSES.flatMap((l) => l.layers);
    expect(new Set(all).size).toBe(all.length);
    expect(lensOf("moon")).toBe("light");
    expect(lensOf("sea-ice")).toBe("weather");
    expect(lensOf("aurora")).toBe("earth");
    expect(lensOf("humpback-whales-east-australia")).toBe("life");
  });
});

import { ICE, SNOW, productDate } from "../src/mapbox/layers/sea-ice.js";

describe("sea ice and snow months", () => {
  it("uses the month's own year when GIBS holds it", () => {
    expect(productDate(SNOW, 3, 2026)).toBe("2026-03-01");
    expect(productDate(ICE, 3, 2025)).toBe("2025-03-15");
  });
  it("steps back to the latest year it holds", () => {
    expect(productDate(SNOW, 11, 2026)).toBe("2025-11-01");
    expect(productDate(ICE, 9, 2026)).toBe("2024-09-15");
    expect(productDate(ICE, 3, 2027)).toBe("2025-03-15");
  });
  it("skips known gaps", () => {
    expect(productDate(SNOW, 10, 2022)).toBe("2021-10-01");
  });
});

import { hourNumberPoints } from "../src/mapbox/layers/rings.js";

describe("hour numbers", () => {
  for (const iso of ["2026-03-20T12:00:00Z", "2026-06-21T03:00:00Z", "2026-12-21T18:00:00Z"]) {
    it(`sit inside their own hour band (${iso.slice(0, 10)})`, () => {
      const date = utc(iso);
      const sun = sunState(date);
      const fc = hourNumberPoints({ date, sun, moon: moonState(date), viewer: { lng: 0, lat: 0 }, fine: false, people: [], notes: [], deep: 0 });
      expect(fc.features.length).toBe(24); // every hour, both sides of the sun
      for (const f of fc.features) {
        const [lng, lat] = f.geometry.coordinates as [number, number];
        const n = Number(f.properties.n);
        const d = angularDistance(sun.subsolar, { lng, lat });
        expect(d).toBeGreaterThan((n - 1) * 15);
        expect(d).toBeLessThan(n * 15);
      }
    });
  }
});
