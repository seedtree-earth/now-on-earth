import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HISTORY_REACH, type PolityLife, civilisationsAt, historyMoment, historyPosition, historyYears, historyYearsWords, polityStage } from "../src/core/index.js";

const data = JSON.parse(readFileSync(new URL("../site/public/data/polities.json", import.meta.url), "utf8")) as { polities: PolityLife[] };

describe("History", () => {
  it("reaches back to people in Sahul, with the recent centuries given room", () => {
    expect(historyYears(0)).toBe(0);
    expect(historyYears(1)).toBeCloseTo(HISTORY_REACH, 0);
    expect(historyYears(0.5)).toBeLessThan(5000); // half the scale for the last five thousand years
    expect(historyMoment(65_000)?.id).toBe("sahul");
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

describe("History words", () => {
  it("folds a bracketed name into the plain one, once", () => {
    const life = (name: string): PolityLife => ({ name, born: -700, died: -300, peak: -500, area: 1000, wiki: null });
    const at = civilisationsAt([life("(Macedonian Empire)"), life("Macedonian Empire")], -500);
    expect(at.flourishing).toEqual(["Macedonian Empire"]);
  });
});

import { arrivalRegion, presenceWords } from "../src/core/index.js";

describe("people before the first farms", () => {
  it("places first arrivals by region", () => {
    expect(arrivalRegion(133.5, -23.7).id).toBe("sahul");
    expect(arrivalRegion(145, -6).id).toBe("sahul"); // New Guinea
    expect(arrivalRegion(-99, 19).id).toBe("americas");
    expect(arrivalRegion(2, 48).id).toBe("europe");
    expect(arrivalRegion(31, 30).id).toBe("africa");
    expect(arrivalRegion(116, 40).id).toBe("east-asia");
  });

  it("says who lived where, and who had not yet arrived", () => {
    expect(presenceWords(62_000)).toMatch(/Sahul/);
    expect(presenceWords(62_000)).toMatch(/Not yet reached: .*Europe.*the Americas/);
    expect(presenceWords(15_000)).not.toMatch(/Not yet/);
    expect(presenceWords(62_000)).not.toMatch(/[0-9]/);
  });
});
