#!/usr/bin/env node
// Ancient coastlines: the shallow seabed that was land when the sea stood
// lower, and the curve of the sea level through time.
//
// Build-time only. Writes two files the browser loads; it never calls GEBCO
// or NOAA itself:
//
//   site/public/data/shelf-depth.png   the seabed from 0 to 150 m deep, as a
//                                      grey Web Mercator image (one byte per
//                                      pixel: 0 = land or deeper water,
//                                      1..151 = depth in metres + 1)
//   src/core/data/sea-level.ts         the global sea level, 0 to 800,000
//                                      years ago, one value per thousand years
//
// Sources (see DATA_SOURCES.md):
//   · GEBCO_2025 Grid (public domain), read through CEDA's OPeNDAP server as
//     a strided sample: every 24th point of the 15 arc-second grid, a 0.1°
//     grid, in six bands of latitude. The 7 GB file is never downloaded.
//   · Spratt & Lisiecki (2016) sea level stack, from NOAA NCEI Paleoclimatology
//     (cite as asked; the paper is CC BY 3.0).
//
// Polite by design: one request at a time, THROTTLE_MS apart, a User-Agent
// naming this project, every response cached on disk (a rerun fetches
// nothing), and any error stops the run at once. No retries.
//
// Usage:
//   node scripts/earth/coastlines.mjs --dry-run   list the requests, fetch nothing
//   node scripts/earth/coastlines.mjs             fetch (or read cache) and write

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const CACHE = join(here, ".cache");
const OUT_PNG = join(root, "site", "public", "data", "shelf-depth.png");
const OUT_CURVE = join(root, "src", "core", "data", "sea-level.ts");
const DRY = process.argv.includes("--dry-run");

const USER_AGENT = "now-on-earth/0.1 (+https://github.com/seedtree-earth/now-on-earth)";
const THROTTLE_MS = 3000;

const GEBCO = "https://dap.ceda.ac.uk/thredds/dodsC/bodc/gebco/global/gebco_2025/ice_surface_elevation/netcdf/GEBCO_2025.nc";
const ROWS = 43200;
const COLS = 86400;
const STRIDE = 24; // 15″ × 24 = 6′ = 0.1°
const BANDS = 6;
const SPRATT = "https://www.ncei.noaa.gov/pub/data/paleo/contributions_by_author/spratt2016/spratt2016-noaa.txt";

/** Depths kept, in metres: the deepest the sea has fallen in 800,000 years is about 130 m. */
const MAX_DEPTH = 150;
/** The output image, Web Mercator, square. */
const SIZE = 3600;

// ----------------------------------------------------------------- requests

const outRows = ROWS / STRIDE; // 1800
const perBand = outRows / BANDS; // 300
const gebcoUrls = Array.from({ length: BANDS }, (_, b) => {
  const r0 = b * perBand * STRIDE;
  const r1 = r0 + (perBand - 1) * STRIDE;
  return `${GEBCO}.dods?elevation[${r0}:${STRIDE}:${r1}][0:${STRIDE}:${COLS - 1}]`;
});
const requests = [SPRATT, ...gebcoUrls];

if (DRY) {
  console.log(`${requests.length} requests (each cached; a rerun makes none):`);
  for (const u of requests) console.log("  " + u);
  console.log(`About ${((outRows * (COLS / STRIDE) * 4) / 1e6).toFixed(0)} MB from CEDA in ${BANDS} parts, and about 0.1 MB from NOAA.`);
  process.exit(0);
}

mkdirSync(CACHE, { recursive: true });
let last = 0;
async function fetchCached(url, binary) {
  const file = join(CACHE, createHash("sha1").update(url).digest("hex") + (binary ? ".bin" : ".txt"));
  if (existsSync(file)) return binary ? readFileSync(file) : readFileSync(file, "utf8");
  const wait = last + THROTTLE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  console.log("fetch " + url);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    console.error(`Stopped: ${res.status} ${res.statusText} from ${url}. No retries.`);
    process.exit(1);
  }
  const body = binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
  writeFileSync(file, body);
  return body;
}

// ----------------------------------------------------------------- sea level

const spratt = await fetchCached(SPRATT, false);
// Data rows: age (ka) then the stack's sea level (m) first among the columns.
const header = spratt.split("\n").findIndex((l) => /^age_calkaBP/i.test(l.trim()) || /^age\b/i.test(l.trim()));
if (header < 0) {
  console.error("Stopped: could not find the column header in the Spratt & Lisiecki file.");
  process.exit(1);
}
const cols = spratt.split("\n")[header].trim().split(/\t+|\s{2,}/);
// The short stack (seven records, 0-430 ka) where it reaches; the long one (five records, 0-798 ka) beyond.
const shortCol = cols.indexOf("SeaLev_shortPC1");
const longCol = cols.indexOf("SeaLev_longPC1");
if (shortCol < 0 || longCol < 0) {
  console.error(`Stopped: expected SeaLev_shortPC1 and SeaLev_longPC1 among: ${cols.join(", ")}`);
  process.exit(1);
}
const curve = [];
for (const line of spratt.split("\n").slice(header + 1)) {
  const v = line.trim().split(/\s+/);
  if (v.length <= longCol) continue;
  const age = Number(v[0]);
  const short = Number(v[shortCol]);
  const sl = Number.isFinite(short) ? short : Number(v[longCol]);
  if (Number.isFinite(age) && Number.isFinite(sl)) curve.push([age, sl]);
}
curve.sort((a, b) => a[0] - b[0]);
if (curve.length < 700) {
  console.error(`Stopped: only ${curve.length} rows read from the sea level stack.`);
  process.exit(1);
}
// The stack's present-day value is not exactly zero; measure from it so "now" is now.
const zero = curve[0][1];
writeFileSync(
  OUT_CURVE,
  `// Generated by scripts/earth/coastlines.mjs. Do not edit.
// Spratt, R.M. and Lisiecki, L.E. (2016): A Late Pleistocene sea level stack.
// Climate of the Past 12: 1079-1092 (CC BY 3.0). Data: NOAA NCEI Paleoclimatology,
// https://doi.org/10.25921/rd66-5820. The scaled first principal component: the
// short stack (seven records) to 430 ka, the long stack (five records) beyond;
// metres relative to today, measured from the stack's own present value.

/** [thousands of years ago, sea level in metres relative to today]. */
export const SEA_LEVEL: ReadonlyArray<readonly [number, number]> = ${JSON.stringify(curve.map(([a, s]) => [a, Math.round((s - zero) * 10) / 10]))};
`,
);
console.log(`sea level: ${curve.length} points, lowest ${Math.min(...curve.map((c) => c[1] - zero)).toFixed(0)} m`);

// ----------------------------------------------------------------- the seabed

/** The first array in a DAP2 .dods response: Int16 travels as big-endian Int32. */
function readDods(buf) {
  const marker = buf.indexOf("\nData:\n");
  if (marker < 0) throw new Error("no Data section in the OPeNDAP response");
  let o = marker + 7;
  const n = buf.readUInt32BE(o);
  o += 8; // the length is sent twice
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt32BE(o + i * 4);
  return out;
}

const W = COLS / STRIDE; // 3600
const grid = new Int16Array(outRows * W);
for (let b = 0; b < BANDS; b++) {
  const part = readDods(await fetchCached(gebcoUrls[b], true));
  if (part.length !== perBand * W) {
    console.error(`Stopped: band ${b} has ${part.length} values, expected ${perBand * W}.`);
    process.exit(1);
  }
  grid.set(part, b * perBand * W);
}
// Row 0 is the far south (GEBCO's latitudes run upward from -90).
const elevAt = (lat, lng) => {
  const r = Math.min(outRows - 1, Math.max(0, Math.floor((lat + 90) * 10)));
  const c = Math.min(W - 1, Math.max(0, Math.floor((lng + 180) * 10)));
  return grid[r * W + c];
};

// Resample to Web Mercator, so a Mapbox image source lays it down true.
const px = new Uint8Array(SIZE * SIZE);
let shelf = 0;
for (let y = 0; y < SIZE; y++) {
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / SIZE))) * 180) / Math.PI;
  for (let x = 0; x < SIZE; x++) {
    const lng = ((x + 0.5) / SIZE) * 360 - 180;
    const e = elevAt(lat, lng);
    if (e <= 0 && e >= -MAX_DEPTH) {
      px[y * SIZE + x] = Math.round(-e) + 1;
      shelf++;
    }
  }
}

// A plain greyscale PNG, written by hand (no image library needed).
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 0; // greyscale
const raw = Buffer.alloc(SIZE * (SIZE + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE + 1)] = 0; // no filter
  Buffer.from(px.buffer, y * SIZE, SIZE).copy(raw, y * (SIZE + 1) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
mkdirSync(dirname(OUT_PNG), { recursive: true });
writeFileSync(OUT_PNG, png);
console.log(`shelf image: ${SIZE}×${SIZE}, ${((100 * shelf) / (SIZE * SIZE)).toFixed(1)}% shallow seabed, ${(png.length / 1024).toFixed(0)} KB`);
