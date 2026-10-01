import { describe, expect, it } from "vitest";
import {
  type GroundNote,
  groundNoteCredit,
  groundNoteFeatures,
  groundNoteWords,
  makeGroundNote,
  notesNear,
  sharedNotes,
} from "../src/core/index.js";

const now = new Date("2026-10-01T03:00:00Z");
const base = {
  kind: "flowering" as const,
  what: "  jacarandas ",
  observedOn: "2026-09-28",
  place: { lng: 153.28431, lat: -28.81377 },
  licence: "CC-BY-4.0" as const,
  shared: true,
};

describe("ground notes", () => {
  it("rounds the place, tidies the words and keeps no time of day", () => {
    const r = makeGroundNote(base, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.note.place).toEqual({ lng: 153.3, lat: -28.8 });
    expect(r.note.what).toBe("jacarandas");
    expect(r.note.observedOn).toBe("2026-09-28");
    expect(r.note.by).toBeUndefined();
    expect(r.note.consent.shared).toBe(true);
  });

  it("keeps nothing unless it is shared, and only open licences", () => {
    const r = makeGroundNote({ ...base, shared: false }, now);
    expect(r.ok).toBe(false);
    const nc = makeGroundNote({ ...base, licence: "CC-BY-NC-4.0" as never }, now);
    expect(nc.ok).toBe(false);
  });

  it("asks for what is needed, and nothing from the future", () => {
    const noWhat = makeGroundNote({ ...base, what: " " }, now);
    expect(noWhat.ok).toBe(false);
    const rain = makeGroundNote({ ...base, kind: "rainfall", what: undefined, amount: "" }, now);
    expect(rain.ok).toBe(false);
    const future = makeGroundNote({ ...base, observedOn: "2026-10-09" }, now);
    expect(future.ok).toBe(false);
    const ok = makeGroundNote({ ...base, kind: "rainfall", what: "ignored", amount: "18.25" }, now);
    expect(ok.ok && ok.note.amount).toBe(18.3);
    expect(ok.ok && ok.note.what).toBeUndefined();
  });

  it("says it in a line, with the right credit", () => {
    const r = makeGroundNote({ ...base, by: "Moss", note: "the whole street is purple" }, now);
    if (!r.ok) throw new Error("expected a note");
    expect(groundNoteWords(r.note, now)).toBe("Jacarandas in flower, three days ago. “the whole street is purple”");
    expect(groundNoteCredit(r.note)).toBe("Noted by Moss · CC BY 4.0");
    const frost = makeGroundNote({ ...base, kind: "first-frost", what: undefined, licence: "CC0-1.0", observedOn: "2026-09-30" }, now);
    if (!frost.ok) throw new Error("expected a note");
    expect(groundNoteWords(frost.note, now)).toBe("The first frost of the season, yesterday.");
    expect(groundNoteCredit(frost.note)).toBe("Noted by someone nearby · CC0");
  });

  it("drops unshared notes and re-rounds whatever a store hands back", () => {
    const precise = { ...(makeGroundNote(base, now) as { note: GroundNote }).note, place: { lng: 10.123456, lat: 20.987 } };
    const unshared = { ...precise, id: "x", consent: { shared: false } } as unknown as GroundNote;
    const out = sharedNotes([precise, unshared]);
    expect(out).toHaveLength(1);
    expect(out[0].place).toEqual({ lng: 10.1, lat: 21 });
  });

  it("finds notes near a place and a moment, and fades them over a month", () => {
    const r = makeGroundNote(base, now);
    if (!r.ok) throw new Error("expected a note");
    expect(notesNear([r.note], { lng: 153.5, lat: -28.6 }, now)).toHaveLength(1);
    expect(notesNear([r.note], { lng: 151.2, lat: -33.9 }, now)).toHaveLength(0);
    expect(notesNear([r.note], { lng: 153.3, lat: -28.8 }, new Date("2026-12-01T00:00:00Z"))).toHaveLength(0);
    const fresh = groundNoteFeatures([r.note], now, "life").features[0].properties.fade;
    const later = groundNoteFeatures([r.note], new Date("2026-10-20T00:00:00Z"), "life").features[0].properties.fade;
    expect(fresh).toBeGreaterThan(later);
    expect(groundNoteFeatures([r.note], new Date("2026-09-20T00:00:00Z"), "life").features).toHaveLength(0);
    expect(groundNoteFeatures([r.note], now, "weather").features).toHaveLength(0);
  });
});
