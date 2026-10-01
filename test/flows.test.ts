import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type SeasonalEvent, corridorDistance, deriveFlow, flowParticles, flowWords } from "../src/core/index.js";

const humpbacks = JSON.parse(readFileSync(new URL("../events/humpback-whales.json", import.meta.url), "utf8")) as SeasonalEvent;
const flow = deriveFlow(humpbacks);

describe("migration flows", () => {
  it("derives a corridor down the east coast, south to north", () => {
    const first = flow.corridor[0];
    const last = flow.corridor[flow.corridor.length - 1];
    expect(first[1]).toBeLessThan(-40);
    expect(last[1]).toBeGreaterThan(-21);
    for (const [lng] of flow.corridor) expect(lng).toBeGreaterThan(147);
    expect(corridorDistance(flow, { lng: 153.7, lat: -28.6 })).toBeLessThan(1); // off Byron Bay
    expect(corridorDistance(flow, { lng: 115.8, lat: -32 })).toBeGreaterThan(20); // Perth: another coast
  });

  it("runs north in winter, south in spring, and fades in the summer", () => {
    const m = (n: number) => flow.months[n - 1];
    expect(m(6).direction).toBeGreaterThan(0.3);
    expect(m(7).direction).toBeGreaterThan(0.3);
    expect(m(10).direction).toBeLessThan(-0.3);
    expect(m(11).direction).toBeLessThan(-0.3);
    expect(m(10).intensity).toBe(1);
    expect(m(2).intensity).toBeLessThan(0.12);
  });

  it("streams particles in season and none out of it", () => {
    const winter = flowParticles(flow, new Date("2026-07-10T00:00:00Z"), 12);
    const summer = flowParticles(flow, new Date("2026-02-10T00:00:00Z"), 12);
    expect(winter.features.length).toBeGreaterThan(30);
    expect(summer.features.length).toBeLessThan(10);
    expect(flowWords(flow, new Date("2026-07-10T00:00:00Z"))).toMatch(/heading north/);
    expect(flowWords(flow, new Date("2026-10-20T00:00:00Z"))).toMatch(/heading south/);
    expect(flowWords(flow, new Date("2026-02-15T00:00:00Z"))).toBeNull();
  });
});

import { deriveFlyway, flowWords as words } from "../src/core/index.js";

const godwits = JSON.parse(readFileSync(new URL("../events/bar-tailed-godwits.json", import.meta.url), "utf8")) as SeasonalEvent;

describe("the godwit flyway", () => {
  const legs = deriveFlyway(godwits);
  const leg = (id: string) => legs.find((l) => l.id.endsWith(id))!;

  it("joins the stopovers in order, with the long leg straight across the Pacific", () => {
    expect(legs.map((l) => l.name)).toEqual(["New Zealand to the Yellow Sea", "the Yellow Sea to Alaska", "Alaska to New Zealand"]);
    const south = leg("alaska-nz").corridor;
    const mid = south[Math.floor(south.length / 2)];
    const lng = ((mid[0] + 540) % 360) - 180;
    expect(Math.abs(lng)).toBeGreaterThan(160); // mid-Pacific, near the date line
    expect(mid[1]).toBeGreaterThan(-5);
    expect(mid[1]).toBeLessThan(25);
  });

  it("flies each leg in its own season, from the stopovers filling and emptying", () => {
    const peak = (id: string) => leg(id).months.reduce((b, m, i, a) => (m.intensity > a[b].intensity ? i : b), 0) + 1;
    expect([2, 3]).toContain(peak("nz-yellow-sea"));
    expect([4, 5]).toContain(peak("yellow-sea-alaska"));
    expect([8, 9]).toContain(peak("alaska-nz"));
    expect(words(leg("alaska-nz"), new Date("2026-09-15T00:00:00Z"))).toMatch(/heading for New Zealand/);
    expect(words(leg("alaska-nz"), new Date("2026-01-15T00:00:00Z"))).toBeNull();
  });
});
