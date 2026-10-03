#!/usr/bin/env node
// Look-up invitations: eclipses (NASA) and the planets' places (JPL), at build time.
//
// Writes src/core/data/sky.ts, which the browser loads; it never calls NASA
// or JPL itself.
//
//   · Eclipses 2021-2040: NASA's eclipse catalogue, decade tables for solar and
//     lunar eclipses. "Eclipse Predictions by Fred Espenak, NASA's GSFC".
//   · The planets: JPL's "Approximate Positions of the Planets", Table 1
//     (Keplerian elements and their rates, valid 1800-2050). U.S. government
//     work, public domain.
//
// Polite by design: one request at a time, THROTTLE_MS apart, a User-Agent
// naming this project, cached on disk (a rerun fetches nothing), and any
// error stops the run at once. No retries.
//
// Usage:
//   node scripts/sky/events.mjs --dry-run   list the requests, fetch nothing
//   node scripts/sky/events.mjs             fetch (or read cache) and write

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const CACHE = join(here, ".cache");
const OUT = join(root, "src", "core", "data", "sky.ts");
const DRY = process.argv.includes("--dry-run");
const PARSE_ONLY = process.argv.includes("--inspect");

const USER_AGENT = "now-on-earth/0.1 (+https://github.com/seedtree-earth/now-on-earth)";
const THROTTLE_MS = 3000;

const SOLAR = ["https://eclipse.gsfc.nasa.gov/SEdecade/SEdecade2021.html", "https://eclipse.gsfc.nasa.gov/SEdecade/SEdecade2031.html"];
const LUNAR = ["https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html", "https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2031.html"];
const JPL = "https://ssd.jpl.nasa.gov/planets/approx_pos.html";
const requests = [...SOLAR, ...LUNAR, JPL];

if (DRY) {
  console.log(`${requests.length} requests (each cached; a rerun makes none):`);
  for (const u of requests) console.log("  " + u);
  process.exit(0);
}

mkdirSync(CACHE, { recursive: true });
let last = 0;
async function fetchCached(url) {
  const file = join(CACHE, createHash("sha1").update(url).digest("hex") + ".html");
  if (existsSync(file)) return readFileSync(file, "utf8");
  const wait = last + THROTTLE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  console.log("fetch " + url);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    console.error(`Stopped: ${res.status} ${res.statusText} from ${url}. No retries.`);
    process.exit(1);
  }
  const body = await res.text();
  writeFileSync(file, body);
  return body;
}

const pages = {};
for (const u of requests) pages[u] = await fetchCached(u);

if (PARSE_ONLY) {
  // Show a slice of each page, to write the parsers against.
  for (const u of requests) {
    const text = pages[u].replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ");
    const i = u === JPL ? text.indexOf("Mercury") : text.search(/20[23]\d\s+[A-Z][a-z]{2}\s+\d{1,2}/);
    console.log(`\n==== ${u}\n${text.slice(Math.max(0, i - 300), i + 1500)}`);
  }
  process.exit(0);
}

// ----------------------------------------------------------------- eclipses

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const clean = (h) =>
  h
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function eclipses(html, kind) {
  const out = [];
  for (const row of html.split(/<tr[\s>]/i).slice(1)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => clean(m[1]));
    const date = cells[0]?.match(/^(\d{4}) ([A-Z][a-z]{2}) (\d{1,2})$/);
    if (!date || cells.length < 7) continue;
    const time = cells[1].match(/^(\d\d):(\d\d):(\d\d)$/);
    if (!time) continue;
    // Times are TD, about a minute ahead of UT: close enough for an invitation to look up.
    const at = new Date(Date.UTC(+date[1], MONTHS[date[2]], +date[3], +time[1], +time[2], +time[3]));
    const last = cells[cells.length - 1];
    const path = last.match(/\[([^\]]+)\]/)?.[1];
    const region = last.replace(/\[[^\]]*\]/g, "").trim();
    out.push({ kind, type: cells[2], at: at.toISOString(), region, ...(path ? { path } : {}) });
  }
  return out;
}

const all = [...SOLAR.flatMap((u) => eclipses(pages[u], "solar")), ...LUNAR.flatMap((u) => eclipses(pages[u], "lunar"))].sort((x, y) =>
  x.at.localeCompare(y.at),
);
if (all.length < 80) {
  console.error(`Stopped: only ${all.length} eclipses read; the page layout may have changed.`);
  process.exit(1);
}

// ----------------------------------------------------------------- the planets' elements

const jpl = pages[JPL];
const table = clean(jpl.slice(jpl.indexOf("Table 1"), jpl.indexOf("Table 2a")));
const elements = {};
for (const name of ["Mercury", "Venus", "EM Bary", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]) {
  const i = table.indexOf(name + " ");
  const nums = table
    .slice(i + name.length)
    .trim()
    .split(" ")
    .slice(0, 12)
    .map(Number);
  if (i < 0 || nums.length !== 12 || nums.some((n) => !Number.isFinite(n))) {
    console.error(`Stopped: could not read the elements for ${name}.`);
    process.exit(1);
  }
  elements[name === "EM Bary" ? "Earth" : name] = { base: nums.slice(0, 6), rate: nums.slice(6, 12) };
}

writeFileSync(
  OUT,
  `// Generated by scripts/sky/events.mjs. Do not edit.
// Eclipses: "Eclipse Predictions by Fred Espenak, NASA's GSFC" (eclipse.gsfc.nasa.gov), 2021-2040.
// Planets: JPL, "Approximate Positions of the Planets", Table 1 (E. M. Standish), valid 1800-2050.
// U.S. government works.

export type Eclipse = { kind: "solar" | "lunar"; type: string; at: string; region: string; path?: string };

export const ECLIPSES: Eclipse[] = ${JSON.stringify(all)};

/** Keplerian elements at J2000 and their rates per century: a (au), e, I, L, longitude of perihelion, longitude of node (degrees). "Earth" is the Earth/Moon barycentre. */
export const PLANET_ELEMENTS: Record<string, { base: number[]; rate: number[] }> = ${JSON.stringify(elements)};
`,
);
console.log(`sky: ${all.length} eclipses (${all.filter((e) => e.kind === "solar").length} solar), ${Object.keys(elements).length} planets`);
