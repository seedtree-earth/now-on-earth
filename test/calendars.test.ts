import { describe, expect, it } from "vitest";
import { chineseNewYear, chineseYear, solarTerm, zodiacAt } from "../src/core/index.js";

const day = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);

describe("calendars of the world", () => {
  it("finds Chinese New Year from the second new moon after the winter solstice", () => {
    const known: Record<number, string> = { 2020: "2020-01-25", 2023: "2023-01-22", 2024: "2024-02-10", 2025: "2025-01-29", 2026: "2026-02-17", 2027: "2027-02-06", 2028: "2028-01-26", 2030: "2030-02-03" };
    for (const [y, d] of Object.entries(known)) expect(day(chineseNewYear(Number(y)))).toBe(d);
  });

  it("names the year's element and animal, turning at the new year", () => {
    expect(chineseYear(new Date("2026-10-03T00:00:00Z")).words).toBe("the Year of the Fire Horse");
    expect(chineseYear(new Date("2026-02-10T00:00:00Z")).words).toBe("the Year of the Wood Snake");
    expect(chineseYear(new Date("2024-03-01T00:00:00Z")).animal).toBe("Dragon");
  });

  it("follows the sun through the zodiac and the solar terms", () => {
    expect(zodiacAt(new Date("2026-10-03T00:00:00Z")).name).toBe("Libra");
    expect(zodiacAt(new Date("2026-03-22T00:00:00Z")).words).toBe("the sun newly in Aries");
    expect(solarTerm(new Date("2026-10-03T00:00:00Z")).english).toBe("the Autumn Equinox");
    expect(solarTerm(new Date("2026-10-10T00:00:00Z")).english).toBe("Cold Dew");
    expect(solarTerm(new Date("2026-02-06T00:00:00Z")).english).toBe("the Start of Spring");
  });
});

import { GREAT_YEAR, greatYearWords, poleStar } from "../src/core/index.js";

describe("the great year", () => {
  it("carries the pole from Polaris to Thuban, near Vega, and back", () => {
    expect(poleStar(0).name).toBe("Polaris");
    expect(poleStar(4_800).name).toBe("Thuban");
    expect(poleStar(4_800).distance).toBeLessThan(1);
    expect(poleStar(14_000).name).toBe("Vega");
    expect(poleStar(GREAT_YEAR).name).toBe("Polaris");
    expect(greatYearWords(4_800)).toMatch(/Thuban in the Dragon the pole star/);
    expect(greatYearWords(13_000)).toMatch(/summer nights shine in winter/);
    expect(greatYearWords(60_000)).not.toMatch(/[0-9]/);
  });
});
