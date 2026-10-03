#!/usr/bin/env node
// Where people lived: HYDE 3.3 population density (Utrecht University and
// PBL, CC BY 4.0), 10,000 BCE to now, coarsened to a 1° grid.
//
// HYDE's data vault is behind bot protection, so this script does not fetch
// anything. Download the population density grids by hand from the HYDE
// portal (https://hyde-portal.geo.uu.nl/) into scripts/history/hyde/ (kept
// out of git): ESRI ASCII grids (.asc), loose or zipped, one per time step,
// with the year in the file name ("10000BC", "2000AD", "popd_1500AD" ...).
//
// Writes site/public/data/people.json: the time steps, the 1° cells where
// anyone lived at any step, and each cell's density per step as a class
// 0..9 on a log scale (0 is nobody; 9 is the densest cities).
//
// Usage:
//   node scripts/history/hyde.mjs            read the folder and write

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const IN = join(here, "hyde");
const OUT = join(root, "site", "public", "data", "people.json");

if (!existsSync(IN) || !readdirSync(IN).length) {
  console.error(`No HYDE files in ${IN}. Download the population density grids by hand from https://hyde-portal.geo.uu.nl/ (see the top of this script).`);
  process.exit(1);
}

/** The year (CE; negative for BCE) in a file name, or null. */
function yearIn(name) {
  const m = name.match(/(\d{1,5})\s*(BC|BCE|AD|CE)/i);
  if (!m) return null;
  const y = Number(m[1]);
  return /^BC/i.test(m[2]) ? -y : y;
}

/** Each .asc in a zip (stored or deflated). */
function* ascInZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.asc$/i.test(name) || name.includes("__MACOSX")) continue;
    const off = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(off, off + size);
    yield { name, text: (method === 8 ? inflateRawSync(data) : data).toString("latin1") };
  }
}

/** An ESRI ASCII grid, summed onto a 1° grid of mean density (people per km²). */
function readGrid(text) {
  const lines = text.split(/\r?\n/);
  const head = {};
  let i = 0;
  for (; i < 8 && i < lines.length; i++) {
    const [k, v] = lines[i].trim().split(/\s+/);
    if (!k || !/^[a-z_]+$/i.test(k)) break;
    head[k.toLowerCase()] = Number(v);
  }
  const { ncols, nrows, cellsize } = head;
  const xll = head.xllcorner ?? head.xllcenter - cellsize / 2;
  const yll = head.yllcorner ?? head.yllcenter - cellsize / 2;
  const nodata = head.nodata_value ?? -9999;
  if (!ncols || !nrows || !cellsize) throw new Error("not an ESRI ASCII grid");
  const sum = new Float64Array(360 * 180);
  const n = new Uint32Array(360 * 180);
  for (let r = 0; r < nrows; r++) {
    const row = lines[i + r]?.trim().split(/\s+/);
    if (!row) break;
    const lat = yll + (nrows - r - 0.5) * cellsize;
    const R = Math.min(179, Math.max(0, Math.floor(90 - lat)));
    for (let c = 0; c < ncols; c++) {
      const v = Number(row[c]);
      if (!Number.isFinite(v) || v === nodata) continue;
      const lng = xll + (c + 0.5) * cellsize;
      const C = Math.min(359, Math.max(0, Math.floor(lng + 180)));
      sum[R * 360 + C] += Math.max(0, v);
      n[R * 360 + C]++;
    }
  }
  const mean = new Float64Array(360 * 180);
  for (let k = 0; k < mean.length; k++) mean[k] = n[k] ? sum[k] / n[k] : 0;
  return mean;
}

const steps = [];
for (const file of readdirSync(IN).sort()) {
  const path = join(IN, file);
  const sources = /\.zip$/i.test(file) ? [...ascInZip(readFileSync(path))] : /\.asc$/i.test(file) ? [{ name: file, text: readFileSync(path, "latin1") }] : [];
  for (const s of sources) {
    if (!/popd|pop_?dens|density/i.test(s.name + file)) continue;
    const year = yearIn(s.name) ?? yearIn(file);
    if (year === null) {
      console.warn(`skipped ${s.name}: no year in its name`);
      continue;
    }
    steps.push({ year, grid: readGrid(s.text) });
    console.log(`read ${s.name} (${year})`);
  }
}
if (steps.length < 2) {
  console.error("Stopped: fewer than two population density grids found.");
  process.exit(1);
}
steps.sort((a, b) => a.year - b.year);

// Density classes on a log scale: 0 nobody; then about 0.01, 0.1, 1, 3, 10, 30, 100, 300, 1000+ people per km².
const BOUNDS = [0.01, 0.1, 1, 3, 10, 30, 100, 300, 1000];
const cls = (d) => (d <= 0 ? 0 : BOUNDS.filter((b) => d >= b).length);

const cells = [];
const values = [];
for (let k = 0; k < 360 * 180; k++) {
  const v = steps.map((s) => cls(s.grid[k]));
  if (v.every((x) => x === 0)) continue;
  cells.push([(k % 360) - 180 + 0.5, 90 - Math.floor(k / 360) - 0.5]);
  values.push(v.join(""));
}

const body = {
  source: "HYDE 3.3, Utrecht University and PBL Netherlands Environmental Assessment Agency (CC BY 4.0). Population density coarsened to 1° and banded on a log scale.",
  bounds: BOUNDS,
  years: steps.map((s) => s.year),
  cells,
  /** For each cell, one digit 0-9 per year. */
  values,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(body));
console.log(`people: ${steps.length} steps, ${cells.length} cells, ${(JSON.stringify(body).length / 1e6).toFixed(1)} MB`);
