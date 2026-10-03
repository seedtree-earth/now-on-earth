import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HISTORY_REACH, type PolityLife, civilisationsAt, historyMoment, historyPosition, historyYears, historyYearsWords, polityStage } from "../src/core/index.js";

const data = JSON.parse(readFileSync(new URL("../site/public/data/polities.json", import.meta.url), "utf8")) as { polities: PolityLife[] };

describe("History", () => {
  it("reaches back to the last cold snap, with the recent centuries given room", () => {
    expect(historyYears(0)).toBe(0);
    expect(historyYears(1)).toBeCloseTo(HISTORY_REACH, 0);
    expect(historyYears(0.5)).toBeLessThan(2500); // half the scale for the last two and a half thousand years
    for (const y of [220, 2000, 11_500]) expect(historyYears(historyPosition(y))).toBeCloseTo(y, 0);
    expect(historyMoment(2_050)?.id).toBe("classical");
    expect(historyMoment(1_400)).toBeNull();
    expect(historyYearsWords(2_034)).toBe("about 2,000 years ago");
  });

  it("names the states flourishing and fading at a time", () => {
    const at = civilisationsAt(data.polities, 117);
    expect(at.flourishing).toContain("Roman Empire");
    const rome = data.polities.find((p) => p.name === "Roman Empire")!;
    expect(polityStage(rome, rome.born + 10)).toBe("rising");
    expect(polityStage(rome, rome.died - 5)).toBe("fading");
  });

  it("keeps one name's separate states apart", () => {
    const zhou = data.polities.filter((p) => p.name === "Later Zhou");
    expect(zhou.length).toBeGreaterThanOrEqual(2);
    expect(civilisationsAt(data.polities, 226).flourishing).not.toContain("Later Zhou");
  });
});
