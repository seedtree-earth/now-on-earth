import { describe, expect, it } from "vitest";
import { eventFeatures, eventStory, monthBlend, type SeasonalEvent } from "../src/core/index.js";
import humpbacks from "../events/humpback-whales.json";

const utc = (s: string) => new Date(s);
const east = { lng: 153, lat: -28 };

describe("monthBlend", () => {
  it("sits wholly in a month at its middle", () => {
    const b = monthBlend(utc("2026-07-16T02:00:00Z"), east);
    expect(b.from).toBe(7);
    expect(b.t).toBeCloseTo(0, 1);
  });
  it("is halfway across at the turn of the month", () => {
    const b = monthBlend(utc("2026-07-31T14:00:00Z"), east); // local midnight, 1 August
    expect([b.from, b.to]).toEqual([7, 8]);
    expect(b.t).toBeCloseTo(0.5, 1);
  });
  it("wraps December into January", () => {
    const b = monthBlend(utc("2026-12-31T14:00:00Z"), east);
    expect([b.from, b.to]).toEqual([12, 1]);
  });
});

describe("the humpback dataset", () => {
  const event = humpbacks as unknown as SeasonalEvent;

  it("carries only open data and says so", () => {
    expect(humpbacks.licences).toMatch(/CC0 and CC BY/);
    const excluded = humpbacks.excluded.map((x: { name: string }) => x.name).join(" ");
    expect(excluded).toMatch(/Happywhale/);
    for (const r of humpbacks.sources.ala.resources) {
      expect(r.licence ?? "").not.toMatch(/(^|[^a-z])(nc|nd|sa)([^a-z]|$)/i);
    }
  });

  it("is aggregated to grid cells, never records", () => {
    for (const m of event.months) for (const c of m.cells) expect(c).toHaveLength(3);
    expect(JSON.stringify(humpbacks)).not.toMatch(/recordedBy|occurrenceID|"uuid"/);
  });

  it("peaks in the migration months and is faint in summer", () => {
    const n = (m: number) => event.months[m - 1].records;
    expect(Math.min(n(7), n(10))).toBeGreaterThan(20 * Math.max(n(1), n(2), n(3)));
  });

  it("weights every cell on one scale across the year", () => {
    const w = eventFeatures(event).features.map((f) => f.properties.w);
    expect(Math.max(...w)).toBeCloseTo(1, 6);
    expect(Math.min(...w)).toBeGreaterThan(0);
  });

  it("tells the general pattern, without numbers", () => {
    expect(eventStory(event, utc("2026-07-10T00:00:00Z"), east)).toMatch(/north along this coast in winter/);
    expect(eventStory(event, utc("2026-10-20T00:00:00Z"), east)).toMatch(/south/);
    for (const line of event.story ?? []) expect(line).not.toMatch(/\d/);
  });
});

import godwits from "../events/bar-tailed-godwits.json";

describe("the godwit dataset", () => {
  const event = godwits as unknown as SeasonalEvent;
  const where = (m: number, test: (lng: number, lat: number) => boolean) =>
    event.months[m - 1].cells.filter(([lng, lat]) => test(lng, lat)).reduce((s, c) => s + c[2], 0);
  const auNz = (_: number, lat: number) => lat < -10;
  const alaska = (lng: number, lat: number) => lat > 50 && lng < -140;

  it("is open data, credited", () => {
    expect(godwits.licences).toMatch(/CC0 and CC BY/);
    for (const d of godwits.sources.gbif.datasets) expect(d.licence).toMatch(/publicdomain|by\/4\.0/);
    expect(godwits.credit).toMatch(/GBIF/);
  });

  it("follows the flyway: south in January, Alaska in June", () => {
    expect(where(1, auNz)).toBeGreaterThan(10 * where(1, alaska) + 1000);
    expect(where(6, alaska)).toBeGreaterThan(1000);
  });

  it("tells the pattern without numbers", () => {
    expect(eventStory(event, new Date("2026-04-15T00:00:00Z"))).toMatch(/Yellow Sea/);
    for (const line of event.story ?? []) expect(line).not.toMatch(/\d/);
  });
});
