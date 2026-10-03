import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type TurningContent, heartsNow, lightQuality } from "../src/core/index.js";

const dir = new URL("../content/turning/", import.meta.url);
const content: TurningContent[] = ["seasons", "turnings"].flatMap((sub) =>
  readdirSync(new URL(`${sub}/`, dir)).map((f) => JSON.parse(readFileSync(new URL(`${sub}/${f}`, dir), "utf8"))),
);

describe("Hearts Now", () => {
  it("has a starter set: four seasons and eight turnings, all drafts awaiting review", () => {
    expect(content.filter((c) => c.kind === "season").map((c) => c.id).sort()).toEqual(["autumn", "spring", "summer", "winter"]);
    expect(content.filter((c) => c.kind === "turning")).toHaveLength(8);
    for (const c of content) {
      expect(c.status).toBe("draft");
      expect(c.reviewedBy).toBeNull();
      expect(c.reflection.trim().endsWith("?")).toBe(true);
      expect(c.invitation).toMatch(/^Go outside/);
      const words = `${c.description} ${c.reflection} ${c.invitation}`;
      expect(words).not.toMatch(/[0-9]/);
      expect(words).not.toContain(String.fromCharCode(8212)); // no em dashes
    }
  });

  it("speaks for the place: the same moment is spring in the south and autumn in the north", () => {
    const now = new Date("2026-10-02T00:00:00Z");
    const south = heartsNow(now, { lng: 153.3, lat: -28.8 }, content);
    const north = heartsNow(now, { lng: -3.2, lat: 55.9 }, content);
    expect(south.wheel.season).toBe("spring");
    expect(south.content?.id).toBe("spring");
    expect(north.content?.id).toBe("autumn");
  });

  it("uses a turning's words when the year is near it, in either hemisphere", () => {
    const beltaneSouth = heartsNow(new Date("2026-11-06T00:00:00Z"), { lng: 153.3, lat: -28.8 }, content);
    expect(beltaneSouth.content?.id).toBe("beltane");
    const beltaneNorth = heartsNow(new Date("2026-05-04T00:00:00Z"), { lng: -3.2, lat: 55.9 }, content);
    expect(beltaneNorth.content?.id).toBe("beltane");
  });

  it("describes the light without numbers, hemisphere-correct", () => {
    const june = new Date("2026-06-18T00:00:00Z");
    expect(lightQuality(june, { lng: 0, lat: 51 })).toMatch(/still lengthening, the longest day very near/);
    expect(lightQuality(june, { lng: 151, lat: -34 })).toMatch(/still shortening, the shortest day very near/);
    expect(lightQuality(june, { lng: 0, lat: 2 })).toMatch(/equator/);
    for (const d of ["2026-01-10", "2026-04-01", "2026-08-01", "2026-10-02"]) expect(lightQuality(new Date(`${d}T00:00:00Z`), { lng: 0, lat: -30 })).not.toMatch(/\d/);
  });
});
