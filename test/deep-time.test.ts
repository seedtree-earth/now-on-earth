import { describe, expect, it } from "vitest";
import { DEEP_MOMENTS, deepPosition, deepWords, deepYears, nearestMoment, yearsWords } from "../src/core/index.js";

describe("deep time", () => {
  it("starts at now and reaches back about 400 million years, logarithmically", () => {
    expect(deepYears(0)).toBe(0);
    expect(deepYears(1)).toBeGreaterThan(390e6);
    expect(deepYears(0.5)).toBeGreaterThan(1e5);
    expect(deepYears(0.5)).toBeLessThan(1e6);
    for (const y of [1_000, 21_000, 66e6]) expect(deepYears(deepPosition(y))).toBeCloseTo(y, -1);
  });

  it("names moments, and keeps the years to words", () => {
    expect(nearestMoment(21_500)?.id).toBe("ice-age");
    expect(nearestMoment(60_000)).toBeNull();
    expect(deepWords(60_000).when).toBe("tens of thousands of years ago");
    expect(yearsWords(21_340)).toBe("about 21,000 years ago");
    expect(yearsWords(2_640_000)).toBe("about 2.6 million years ago");
    expect(yearsWords(251_000_000)).toBe("about 250 million years ago");
    expect(deepWords(0).when).toBe("now");
  });

  it("keeps its moments in order along the scale", () => {
    const at = DEEP_MOMENTS.map((m) => deepPosition(m.yearsAgo));
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(DEEP_MOMENTS.filter((m) => m.labelled).map((m) => m.label)).toEqual(["Now", "Last Ice Age", "Our species", "Dinosaurs", "Pangaea"]);
  });
});

import { seaLevelAt, seaWords } from "../src/core/index.js";

describe("the sea through deep time", () => {
  it("stands at today's level now and far lower in the Last Ice Age", () => {
    expect(seaLevelAt(0)).toBe(0);
    expect(seaLevelAt(21_000)!).toBeLessThan(-115);
    expect(seaLevelAt(900_000)).toBeNull();
  });

  it("names the lands it joined", () => {
    expect(seaWords(21_000)).toMatch(/New Guinea joined to Australia/);
    expect(seaWords(21_000)).toMatch(/Beringia/);
    expect(seaWords(0)).toMatch(/as high as today/);
  });
});
