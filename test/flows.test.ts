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
