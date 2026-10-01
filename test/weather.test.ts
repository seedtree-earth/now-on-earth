import { describe, expect, it } from "vitest";
import { fromWord, skyWord, warmthWord, weatherWords, windWord } from "../src/core/index.js";
import { compactForecast } from "../api/weather.js";

describe("weather in words", () => {
  it("reads MET Norway symbols", () => {
    expect(skyWord("clearsky_day")).toBe("clear");
    expect(skyWord("partlycloudy_night")).toBe("partly cloudy");
    expect(skyWord("lightrain")).toBe("light rain");
    expect(skyWord("heavysnowshowers_polartwilight")).toBe("heavy snow showers");
    expect(skyWord("rainshowersandthunder_day")).toBe("rain showers, with thunder");
    expect(skyWord("sleet")).toBe("sleet");
  });

  it("gives warmth, wind and its direction", () => {
    expect(warmthWord(-3)).toBe("freezing");
    expect(warmthWord(14)).toBe("cool");
    expect(warmthWord(24)).toBe("warm");
    expect(windWord(0.2)).toBe("still");
    expect(windWord(4)).toBe("a gentle breeze");
    expect(windWord(30)).toBe("a storm");
    expect(fromWord(180)).toBe("the south");
    expect(fromWord(350)).toBe("the north");
    expect(fromWord(-45)).toBe("the northwest");
  });

  it("makes one line, and notes a change ahead", () => {
    expect(weatherWords({ symbol: "lightrain_day", temperature: 13, wind: 4, windFrom: 190 })).toBe(
      "Light rain. Cool, with a gentle breeze from the south.",
    );
    expect(
      weatherWords({ symbol: "fair_day", temperature: 22, wind: 0.1, windFrom: 0, later: { symbol: "rainshowers_day" } }),
    ).toBe("Fair. Warm and still. Turning rain showers later.");
  });

  it("takes the step nearest now from a forecast", () => {
    const step = (time: string, t: number, sym: string) => ({
      time,
      data: {
        instant: { details: { air_temperature: t, wind_speed: 3, wind_from_direction: 90 } },
        next_1_hours: { summary: { symbol_code: sym }, details: { precipitation_amount: 0.4 } },
        next_6_hours: { summary: { symbol_code: "cloudy" } },
      },
    });
    const raw = {
      properties: {
        meta: { updated_at: "2026-10-01T00:00:00Z" },
        timeseries: [step("2026-10-01T00:00:00Z", 10, "fog"), step("2026-10-01T01:00:00Z", 11, "lightrain"), step("2026-10-01T02:00:00Z", 12, "rain")],
      },
    };
    const c = compactForecast(raw, Date.parse("2026-10-01T01:10:00Z"));
    expect(c.now.temperature).toBe(11);
    expect(c.now.symbol).toBe("lightrain");
    expect(c.now.rain).toBe(0.4);
    expect(c.now.later?.symbol).toBe("cloudy");
  });
});
