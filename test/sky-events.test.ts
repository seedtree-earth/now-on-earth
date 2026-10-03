import { describe, expect, it } from "vitest";
import { lookUp, planetMeetings, sunAt } from "../src/core/index.js";

const d = (s: string) => new Date(s);
const day = (x: Date) => x.toISOString().slice(0, 10);

describe("look up", () => {
  it("finds the planets' meetings: the great conjunction of 2020, Venus and Jupiter in 2025", () => {
    const great = planetMeetings(d("2020-12-10T00:00:00Z"), d("2020-12-31T00:00:00Z")).find((m) => m.a === "Jupiter" && m.b === "Saturn");
    expect(great).toBeTruthy();
    expect(["2020-12-21", "2020-12-22"]).toContain(day(great!.at));
    expect(great!.separation).toBeLessThan(0.3);
    expect(great!.evening).toBe(true);
    const vj = planetMeetings(d("2025-08-01T00:00:00Z"), d("2025-08-25T00:00:00Z")).find((m) => m.a === "Venus" && m.b === "Jupiter");
    expect(vj).toBeTruthy();
    expect(["2025-08-11", "2025-08-12", "2025-08-13"]).toContain(day(vj!.at));
    expect(vj!.evening).toBe(false);
  });

  it("times the showers by the sun, and offers them only where the radiant rises", () => {
    expect(["2026-08-12", "2026-08-13"]).toContain(day(sunAt(140.0, d("2026-07-01T00:00:00Z"))));
    expect(["2026-12-14"]).toContain(day(sunAt(262.2, d("2026-11-01T00:00:00Z"))));
    const perseidsNorth = lookUp(d("2026-08-10T12:00:00Z"), { lng: -3, lat: 55 });
    expect(perseidsNorth.some((l) => /Perseids/.test(l.words))).toBe(true);
    const perseidsSouth = lookUp(d("2026-08-10T12:00:00Z"), { lng: 151, lat: -40 });
    expect(perseidsSouth.some((l) => /Perseids/.test(l.words))).toBe(false);
  });

  it("offers an eclipse of the moon where the moon is up, in words only", () => {
    const sydney = lookUp(d("2026-03-01T00:00:00Z"), { lng: 151.2, lat: -33.9 });
    const eclipse = sydney.find((l) => l.kind === "lunar-eclipse");
    expect(eclipse?.words).toMatch(/total eclipse of the moon/);
    expect(eclipse?.words).not.toMatch(/[0-9]/);
    const london = lookUp(d("2026-03-01T00:00:00Z"), { lng: 0, lat: 51.5 });
    expect(london.some((l) => l.kind === "lunar-eclipse")).toBe(false);
    const solar = lookUp(d("2026-08-08T00:00:00Z"), { lng: -3.7, lat: 40.4 }).find((l) => l.kind === "solar-eclipse");
    expect(solar?.words).toMatch(/total eclipse of the sun.*Spain.*eclipse glasses/);
  });
});
