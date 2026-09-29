import { describe, expect, it } from "vitest";
import { firesAt, quakesAt, quakeWords, volcanoesAt, volcanoWords, fireWords, placeWords } from "../src/core/index.js";
import { compactAlerts, compactQuakes } from "../api/hazards.js";

const quake = { id: "q", lng: 146, lat: -6, mag: 6.4, depth: 10, time: "2026-09-20T00:00:00Z", place: "49 km NNE of Kainantu, Papua New Guinea", url: "u", tsunami: false };
const fire = { id: "f", lng: -3, lat: 40, level: "Orange" as const, from: "2026-08-10T00:00:00Z", to: "2026-08-17T00:00:00Z", name: "Forest fires in Spain", country: "Spain", url: "u" };
const volcano = { ...fire, id: "v", name: "Eruption  Krakatau", from: "2026-09-04T21:00:00Z", to: "2026-09-04T21:00:00Z" };

describe("hazards in time", () => {
  it("shows nothing before an event, then fades it", () => {
    expect(quakesAt([quake], new Date("2026-09-19T00:00:00Z"))).toHaveLength(0);
    const fresh = quakesAt([quake], new Date("2026-09-20T06:00:00Z"))[0];
    const older = quakesAt([quake], new Date("2026-10-10T00:00:00Z"))[0];
    expect(fresh.strength).toBeGreaterThan(older.strength);
    expect(quakesAt([quake], new Date("2026-11-01T00:00:00Z"))).toHaveLength(0);
  });

  it("burns fires at full strength while they last, then lets them fade for a week", () => {
    expect(firesAt([fire], new Date("2026-08-12T00:00:00Z"))[0].strength).toBe(1);
    expect(firesAt([fire], new Date("2026-08-21T00:00:00Z"))[0].strength).toBeLessThan(1);
    expect(firesAt([fire], new Date("2026-09-05T00:00:00Z"))).toHaveLength(0);
  });

  it("keeps eruptions for a year", () => {
    expect(volcanoesAt([volcano], new Date("2027-03-01T00:00:00Z"))).toHaveLength(1);
  });

  it("speaks plainly", () => {
    expect(placeWords(quake.place)).toBe("Kainantu, Papua New Guinea");
    expect(quakeWords(quakesAt([quake], new Date("2026-09-24T00:00:00Z"))[0])).toBe(
      "a strong earthquake, magnitude 6.4, near Kainantu, Papua New Guinea, a few days ago",
    );
    expect(volcanoWords(volcanoesAt([volcano], new Date("2026-09-06T00:00:00Z"))[0])).toMatch(/^an eruption of Krakatau, a GDACS orange alert/);
    expect(fireWords(firesAt([fire], new Date("2026-08-12T00:00:00Z"))[0])).toMatch(/burning at this time/);
  });
});

describe("the hazards function", () => {
  it("keeps what the globe needs from USGS", () => {
    const [q] = compactQuakes({ features: [{ id: "us1", geometry: { coordinates: [146, -6, 12] }, properties: { mag: 6.4, time: Date.UTC(2026, 8, 20), place: "p", url: "u", tsunami: 1 } }] });
    expect(q).toMatchObject({ id: "us1", mag: 6.4, depth: 12, tsunami: true, time: "2026-09-20T00:00:00.000Z" });
  });
  it("keeps only orange and red GDACS alerts", () => {
    const out = compactAlerts({
      features: [
        { geometry: { coordinates: [1, 2] }, properties: { alertlevel: "Green", eventtype: "WF", eventid: 1, fromdate: "2026-08-01T00:00:00", todate: "2026-08-02T00:00:00" } },
        { geometry: { coordinates: [3, 4] }, properties: { alertlevel: "Red", eventtype: "WF", eventid: 2, fromdate: "2026-08-01T00:00:00", todate: "2026-08-02T00:00:00", name: "Fires", url: { report: "r" } } },
      ],
    });
    expect(out.map((a) => a.id)).toEqual(["WF-2"]);
    expect(out[0].url).toBe("r");
  });
});
