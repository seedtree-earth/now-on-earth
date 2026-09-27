import { describe, expect, it } from "vitest";
import { coefficientsAt, compass, compassWords, fieldAt, fieldLines, magneticPoleTrails } from "../src/core/index.js";

const y2025 = coefficientsAt(2025.0);

describe("the World Magnetic Model", () => {
  it("has the field's familiar strength: about 30,000 nT near the equator, 55,000 to 67,000 near the poles", () => {
    const equator = fieldAt(0, 0, 1, y2025).total;
    expect(equator).toBeGreaterThan(22000);
    expect(equator).toBeLessThan(42000);
    const south = fieldAt(-64, 135, 1, y2025).total;
    expect(south).toBeGreaterThan(55000);
    expect(south).toBeLessThan(70000);
  });

  it("points straight down at NCEI's 2025 north dip pole", () => {
    const { north } = magneticPoleTrails();
    const p = north[north.length - 1];
    const f = fieldAt(p.lat, p.lng, 1, y2025);
    // Horizontal field is a sliver of the total at the dip pole.
    expect(Math.hypot(f.north, f.east) / f.total).toBeLessThan(0.02);
    expect(f.down).toBeGreaterThan(0);
  });

  it("points straight up at the south dip pole", () => {
    const { south } = magneticPoleTrails();
    const p = south[south.length - 1];
    const f = fieldAt(p.lat, p.lng, 1, y2025);
    expect(Math.hypot(f.north, f.east) / f.total).toBeLessThan(0.02);
    expect(f.down).toBeLessThan(0);
  });

  it("gives the Northern Rivers an easterly declination of about eleven degrees", () => {
    const d = compass({ lng: 153.3, lat: -28.8 }, new Date("2026-01-01T00:00:00Z")).declination;
    expect(d).toBeGreaterThan(9);
    expect(d).toBeLessThan(14);
    expect(compassWords({ lng: 153.3, lat: -28.8 }, new Date("2026-01-01T00:00:00Z"))).toMatch(/well east of true north/);
  });

  it("traces field lines that leave the north and return in the south", () => {
    const lines = fieldLines(new Date("2026-01-01T00:00:00Z"));
    expect(lines.length).toBe(24);
    for (const l of lines) {
      const end = l.points[l.points.length - 1];
      const r = Math.hypot(...end);
      expect(r).toBeLessThan(1.001); // came back to the surface
      expect(end[2]).toBeLessThan(l.points[0][2]); // further south than it began
      expect(l.apex).toBeGreaterThan(1.1);
      expect(l.apex).toBeLessThan(4);
    }
  });

  it("walks the north pole about 1,000 km across the Arctic this last century", () => {
    const { north } = magneticPoleTrails();
    expect(north[0].year).toBe(1925);
    expect(north[0].lat).toBeLessThan(72);
    expect(north[north.length - 1].lat).toBeGreaterThan(85);
  });
});
