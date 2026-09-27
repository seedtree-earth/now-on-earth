#!/usr/bin/env node
// The Earth's magnetic field and its wandering poles, fetched once at build
// time and written as source files the core reads. The browser never calls
// these services.
//
//   · World Magnetic Model 2025 (NOAA NCEI and BGS): the spherical harmonic
//     coefficients, from the official WMM2025COF.zip. Public domain.
//   · Magnetic (dip) pole positions from NCEI's "Wandering of the Geomagnetic
//     Poles", computed from IGRF: NP.xy and SP.xy. U.S. government data.
//
// Polite by design, as the other build scripts: one request at a time, at
// least THROTTLE_MS apart, a User-Agent naming this repo, every response
// cached on disk, and any error stops the run with no retries.
//
// Usage:
//   node scripts/earth/magnetic.mjs --dry-run
//   node scripts/earth/magnetic.mjs

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const CACHE = join(here, ".cache");
const OUT_WMM = join(root, "src", "core", "data", "wmm2025.ts");
const OUT_POLES = join(root, "src", "core", "data", "magnetic-poles.ts");
const DRY = process.argv.includes("--dry-run");

const USER_AGENT = "now-on-earth/0.1 (+https://github.com/seedtree-earth/now-on-earth)";
const THROTTLE_MS = 1500;
/** Roughly the last century of the poles' wandering. */
const FROM_YEAR = 1925;

const SOURCES = [
  { key: "wmm", label: "WMM2025 coefficients", url: "https://www.ncei.noaa.gov/sites/default/files/2024-12/WMM2025COF.zip" },
  { key: "np", label: "North dip pole positions", url: "https://www.ngdc.noaa.gov/geomag/data/poles/NP.xy" },
  { key: "sp", label: "South dip pole positions", url: "https://www.ngdc.noaa.gov/geomag/data/poles/SP.xy" },
];

let network = 0;
let cached = 0;
let lastAt = 0;

function stop(message) {
  console.error(`\n${message}\nMade ${network} network request(s) this run; ${cached} came from cache.`);
  process.exit(1);
}

async function get({ url, label }) {
  const file = join(CACHE, createHash("sha1").update(url).digest("hex"));
  if (existsSync(file)) {
    cached++;
    return readFileSync(file);
  }
  if (DRY) return null;
  const wait = lastAt + THROTTLE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastAt = Date.now();
  network++;
  process.stdout.write(`  ${label} ... `);
  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  } catch (err) {
    console.log("failed");
    stop(`Network error on ${label}: ${err.message}`);
  }
  if (res.status === 429) stop(`Rate limited (429) on ${label}. Stopping; nothing retried.`);
  if (!res.ok) {
    console.log(res.status);
    stop(`HTTP ${res.status} on ${label}. Stopping; nothing retried.\n  ${url}`);
  }
  const body = Buffer.from(await res.arrayBuffer());
  console.log("ok");
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, body);
  return body;
}

/** The first file in a zip whose name ends with `suffix` (stored or deflated). */
function unzip(buf, suffix) {
  let p = 0;
  while (p < buf.length - 30 && buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8);
    const size = buf.readUInt32LE(p + 18);
    const nameLen = buf.readUInt16LE(p + 26);
    const extraLen = buf.readUInt16LE(p + 28);
    const name = buf.toString("utf8", p + 30, p + 30 + nameLen);
    const start = p + 30 + nameLen + extraLen;
    const data = buf.subarray(start, start + size);
    if (name.toUpperCase().endsWith(suffix.toUpperCase())) {
      return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    }
    p = start + size;
  }
  stop(`No ${suffix} found in the WMM zip.`);
}

console.log(`Magnetic field and poles · ${DRY ? "dry run (nothing fetched)" : "building"}`);
const bodies = {};
for (const s of SOURCES) bodies[s.key] = await get(s);

if (DRY) {
  const todo = SOURCES.filter((s) => !bodies[s.key]);
  console.log(`\nWould make ${todo.length} request(s), at least ${THROTTLE_MS / 1000}s apart:`);
  for (const s of todo) console.log(`  · ${s.label}  ${s.url}`);
  process.exit(0);
}

// ----------------------------------------------------------------- WMM

const cof = unzip(bodies.wmm, "WMM.COF");
const lines = cof.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const [epochStr, model, released] = lines[0].split(/\s+/);
const coefficients = [];
for (const l of lines.slice(1)) {
  if (/^9{6,}/.test(l)) break;
  const [n, m, g, h, dg, dh] = l.split(/\s+/).map(Number);
  if ([n, m, g, h, dg, dh].some((x) => Number.isNaN(x))) stop(`Unreadable WMM line: ${l}`);
  coefficients.push([n, m, g, h, dg, dh]);
}
if (coefficients.length !== 90) stop(`Expected 90 WMM coefficient rows (degree 12), found ${coefficients.length}.`);

mkdirSync(dirname(OUT_WMM), { recursive: true });
writeFileSync(
  OUT_WMM,
  `// Generated by scripts/earth/magnetic.mjs from the official WMM2025COF.zip. Do not edit.
// World Magnetic Model 2025, NOAA NCEI and the British Geological Survey. Public domain.
// Citation: NOAA NCEI Geomagnetic Modeling Team; British Geological Survey. 2024: World Magnetic Model 2025.

/** [n, m, g, h, dg/dt, dh/dt] in nT and nT per year, Schmidt semi-normalised. */
export const WMM2025 = {
  model: ${JSON.stringify(model)},
  epoch: ${Number(epochStr)},
  released: ${JSON.stringify(released)},
  coefficients: ${JSON.stringify(coefficients)} as Array<[number, number, number, number, number, number]>,
};
`,
);

// ----------------------------------------------------------------- poles

/** Lines of "longitude latitude year" (whitespace separated); tolerant of either order of lon/lat by range. */
function poles(text, label) {
  const rows = [];
  for (const l of text.toString("utf8").split(/\r?\n/)) {
    const parts = l.trim().split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some((x) => Number.isNaN(x))) continue;
    const [a, b, year] = parts;
    rows.push({ lng: a, lat: b, year });
  }
  if (rows.length < 50) stop(`Too few rows in ${label}: ${rows.length}.`);
  if (rows.some((r) => Math.abs(r.lat) > 90 || Math.abs(r.lng) > 360)) stop(`Unexpected values in ${label}.`);
  return rows
    .filter((r) => r.year >= FROM_YEAR)
    .map((r) => [Math.round(((((r.lng + 180) % 360) + 360) % 360 - 180) * 1000) / 1000, Math.round(r.lat * 1000) / 1000, r.year]);
}

const north = poles(bodies.np, "NP.xy");
const south = poles(bodies.sp, "SP.xy");

writeFileSync(
  OUT_POLES,
  `// Generated by scripts/earth/magnetic.mjs from NCEI's "Wandering of the Geomagnetic Poles"
// (dip pole positions computed from IGRF), NP.xy and SP.xy. U.S. government data. Do not edit.

/** [longitude, latitude, year], from ${FROM_YEAR}. */
export const MAGNETIC_POLES = {
  source: "NOAA NCEI, Wandering of the Geomagnetic Poles (IGRF)",
  north: ${JSON.stringify(north)} as Array<[number, number, number]>,
  south: ${JSON.stringify(south)} as Array<[number, number, number]>,
};
`,
);

console.log(`\nWrote ${OUT_WMM} (${coefficients.length} rows, epoch ${epochStr}, ${model})`);
console.log(`Wrote ${OUT_POLES} (north ${north.length}, south ${south.length} positions from ${FROM_YEAR})`);
console.log(`Latest north: ${JSON.stringify(north[north.length - 1])}; latest south: ${JSON.stringify(south[south.length - 1])}`);
console.log(`Made ${network} network request(s) this run; ${cached} came from cache.`);
