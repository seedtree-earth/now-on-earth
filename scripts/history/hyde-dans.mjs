#!/usr/bin/env node
// Fetch HYDE 3.2.1 population grids from the DANS Data Station (CC0), without
// downloading the whole 5 GB baseline zip.
//
// A zip keeps its table of contents at the end, so this reads only:
//   1. the dataset's file list from the Dataverse API (1 request);
//   2. the tail of HYDE3_2_1-baseline.zip, holding its table of contents (1 request);
//   3. each wanted year's population density grid (popd_<year>.asc), by byte range (1 request each, 21 years).
// Then it writes those small zips into scripts/history/hyde/, where hyde.mjs
// reads them.
//
// Polite by design: one request at a time, THROTTLE_MS apart, a User-Agent
// naming this project, cached on disk, stop on any error, no retries. If the
// server will not serve byte ranges, it stops rather than fetch 5 GB.
//
// Citation: Klein Goldewijk, K. (2017): Anthropogenic land use estimates for
// the Holocene; HYDE 3.2. DANS. https://doi.org/10.17026/dans-25g-gez3
//
// Usage:
//   node scripts/history/hyde-dans.mjs --dry-run   list the plan, fetch nothing
//   node scripts/history/hyde-dans.mjs

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { inflate } from "./inflate64.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const CACHE = join(here, ".cache");
const OUT = join(here, "hyde");
const DRY = process.argv.includes("--dry-run");

const USER_AGENT = "now-on-earth/0.1 (+https://github.com/seedtree-earth/now-on-earth)";
const THROTTLE_MS = 3000;
const HOST = "https://archaeology.datastations.nl";
const DOI = "doi:10.17026/DANS-25G-GEZ3";
const TAIL = 8 * 1024 * 1024;
const YEARS = ["10000BC", "8000BC", "6000BC", "5000BC", "4000BC", "3000BC", "2000BC", "1000BC", "0AD", "500AD", "1000AD", "1200AD", "1400AD", "1500AD", "1600AD", "1700AD", "1800AD", "1900AD", "1950AD", "2000AD", "2015AD"];

if (DRY) {
  console.log(`Plan: 1 API request, 1 range read of the zip's last ${TAIL / 1024 / 1024} MB, then ${YEARS.length} range reads (one per year): ${2 + YEARS.length} requests.`);
  process.exit(0);
}

mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });
let count = 0;
let last = 0;
async function get(url, range) {
  const key = createHash("sha1").update(url + (range ?? "")).digest("hex");
  const file = join(CACHE, key + ".bin");
  if (existsSync(file)) return readFileSync(file);
  const wait = last + THROTTLE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  count++;
  console.log(`fetch ${count}: ${url}${range ? ` [${range}]` : ""}`);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...(range ? { Range: `bytes=${range}` } : {}) } });
  if (range && res.status !== 206) {
    console.error(`Stopped: the server answered ${res.status} to a byte-range request, so it would send the whole file. Not fetching 5 GB.`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Stopped: ${res.status} ${res.statusText} from ${url}. No retries.`);
    process.exit(1);
  }
  const body = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, body);
  return body;
}

// ----------------------------------------------------------------- 1. the file list

const meta = JSON.parse((await get(`${HOST}/api/datasets/:persistentId/?persistentId=${DOI}`)).toString("utf8"));
const files = meta.data.latestVersion.files;
const baseline = files.find((f) => /baseline\.zip$/i.test(f.dataFile.filename));
if (!baseline) {
  console.error(`Stopped: no baseline zip among ${files.map((f) => f.dataFile.filename).join(", ")}`);
  process.exit(1);
}
const size = baseline.dataFile.filesize;
const url = `${HOST}/api/access/datafile/${baseline.dataFile.id}`;
console.log(`baseline: ${baseline.dataFile.filename}, ${(size / 1e9).toFixed(2)} GB, id ${baseline.dataFile.id}`);

// ----------------------------------------------------------------- 2. the table of contents

const tailStart = Math.max(0, size - TAIL);
const tail = await get(url, `${tailStart}-${size - 1}`);
const at = (abs) => abs - tailStart;
const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (eocd < 0) throw new Error("no end of central directory in the tail");
let cdOffset = tail.readUInt32LE(eocd + 16);
let cdSize = tail.readUInt32LE(eocd + 12);
// ZIP64: the real offset and size are in the ZIP64 end record.
const loc = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]));
if (loc >= 0 && (cdOffset === 0xffffffff || cdSize === 0xffffffff)) {
  const z64 = Number(tail.readBigUInt64LE(loc + 8));
  cdSize = Number(tail.readBigUInt64LE(at(z64) + 40));
  cdOffset = Number(tail.readBigUInt64LE(at(z64) + 48));
}
if (cdOffset < tailStart) {
  console.error(`Stopped: the table of contents (${(cdSize / 1e6).toFixed(1)} MB) begins before the tail read; widen TAIL.`);
  process.exit(1);
}

const entries = [];
for (let p = at(cdOffset); p < at(cdOffset) + cdSize && tail.readUInt32LE(p) === 0x02014b50; ) {
  const method = tail.readUInt16LE(p + 10);
  let comp = tail.readUInt32LE(p + 20);
  let uncomp = tail.readUInt32LE(p + 24);
  const nameLen = tail.readUInt16LE(p + 28);
  const extraLen = tail.readUInt16LE(p + 30);
  const commentLen = tail.readUInt16LE(p + 32);
  let local = tail.readUInt32LE(p + 42);
  const name = tail.toString("utf8", p + 46, p + 46 + nameLen);
  // ZIP64 extra field: the 0xFFFFFFFF values follow in order.
  let e = p + 46 + nameLen;
  while (e < p + 46 + nameLen + extraLen) {
    const id = tail.readUInt16LE(e);
    const len = tail.readUInt16LE(e + 2);
    if (id === 0x0001) {
      let q = e + 4;
      if (uncomp === 0xffffffff) (uncomp = Number(tail.readBigUInt64LE(q))), (q += 8);
      if (comp === 0xffffffff) (comp = Number(tail.readBigUInt64LE(q))), (q += 8);
      if (local === 0xffffffff) local = Number(tail.readBigUInt64LE(q));
    }
    e += 4 + len;
  }
  entries.push({ name, method, comp, uncomp, local });
  p += 46 + nameLen + extraLen + commentLen;
}
console.log(`table of contents: ${entries.length} entries`);

// ----------------------------------------------------------------- 3. each year's population zip

let got = 0;
for (const year of YEARS) {
  const entry = entries.find((x) => x.name.toLowerCase().endsWith(`/popd_${year.toLowerCase()}.asc`));
  if (!entry) {
    console.warn(`no popd_${year}.asc in the archive; skipped`);
    continue;
  }
  // The local header is 30 bytes plus its own name and extra field; allow room for those.
  const slack = 30 + entry.name.length + 1024;
  const chunk = await get(url, `${entry.local}-${entry.local + slack + entry.comp - 1}`);
  if (chunk.readUInt32LE(0) !== 0x04034b50) throw new Error(`no local header for ${entry.name}`);
  const start = 30 + chunk.readUInt16LE(26) + chunk.readUInt16LE(28);
  const data = chunk.subarray(start, start + entry.comp);
  // HYDE's zip uses Deflate64 (method 9), which zlib cannot read.
  const inner = entry.method === 9 ? inflate(data, entry.uncomp) : entry.method === 8 ? inflateRawSync(data) : data;
  writeFileSync(join(OUT, `popd_${year}.asc`), inner);
  got++;
  console.log(`  popd_${year}.asc: ${(inner.length / 1e6).toFixed(1)} MB (${(entry.comp / 1e6).toFixed(1)} MB fetched)`);
}
console.log(`done: ${got} years written to ${OUT}, ${count} requests made`);
