#!/usr/bin/env node
// Civilisations through history: the states and empires historians have
// mapped, 3400 BCE to 2024 CE, from Cliopatria (Seshat Global History
// Databank, CC BY 4.0).
//
// Build-time only. Downloads the one zipped GeoJSON, reads it without any
// unzip tool, simplifies the borders, and writes:
//
//   site/public/data/polities.json   simplified borders, each with its years
//                                    and its polity's life (born, widest, gone)
//
// Changes made (as CC BY asks us to note): non-polity records dropped;
// borders simplified (Douglas-Peucker, about 0.15°) and rounded to 0.05°;
// tiny fragments dropped; each record given its polity's first year, last
// year and the year of its widest reach.
//
// Polite by design: one request, a User-Agent naming this project, cached on
// disk (a rerun fetches nothing), stop on any error, no retries.
//
// Usage:
//   node scripts/history/cliopatria.mjs --dry-run   show the request, fetch nothing
//   node scripts/history/cliopatria.mjs             fetch (or read cache) and write

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const CACHE = join(here, ".cache");
const OUT = join(root, "site", "public", "data", "polities.json");
const DRY = process.argv.includes("--dry-run");

const USER_AGENT = "now-on-earth/0.1 (+https://github.com/seedtree-earth/now-on-earth)";
const SOURCE = "https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/main/cliopatria.geojson.zip";
const TOLERANCE = 0.15; // degrees
const MIN_RING_AREA = 0.15; // square degrees: smaller islands of a realm are dropped

if (DRY) {
  console.log(`1 request (cached; a rerun makes none):\n  ${SOURCE}\nAbout 44 MB.`);
  process.exit(0);
}

mkdirSync(CACHE, { recursive: true });
const cached = join(CACHE, createHash("sha1").update(SOURCE).digest("hex") + ".zip");
let zip;
if (existsSync(cached)) zip = readFileSync(cached);
else {
  console.log("fetch " + SOURCE);
  const res = await fetch(SOURCE, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    console.error(`Stopped: ${res.status} ${res.statusText}. No retries.`);
    process.exit(1);
  }
  zip = Buffer.from(await res.arrayBuffer());
  writeFileSync(cached, zip);
}

// ----------------------------------------------------------------- read the zip (one deflated GeoJSON)

function unzipFirst(buf, want) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("not a zip");
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
    if (!name.endsWith(want) || name.startsWith("__MACOSX")) continue;
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const data = buf.subarray(local + 30 + lNameLen + lExtraLen, local + 30 + lNameLen + lExtraLen + size);
    return method === 8 ? inflateRawSync(data) : data;
  }
  throw new Error(`no ${want} in the zip`);
}

const geo = JSON.parse(unzipFirst(zip, ".geojson").toString("utf8"));
const polities = geo.features.filter((f) => f.properties?.Type === "POLITY" && f.geometry);
console.log(`read ${geo.features.length} records, ${polities.length} polity records`);

// ----------------------------------------------------------------- simplify

function simplify(points, tol) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const ringArea = (r) => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(s / 2);
};
const round = (r) => r.map(([x, y]) => [Math.round(x * 20) / 20, Math.round(y * 20) / 20]);

function shape(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  const out = [];
  for (const poly of polys) {
    const outer = poly[0];
    if (!outer || ringArea(outer) < MIN_RING_AREA) continue;
    // A ring starts and ends on the same point, so simplify it in two halves.
    const ring = (r) => {
      const mid = Math.floor(r.length / 2);
      return [...simplify(r.slice(0, mid + 1), TOLERANCE).slice(0, -1), ...simplify(r.slice(mid), TOLERANCE)];
    };
    const rings = poly.map((r) => round(ring(r))).filter((r) => r.length >= 4);
    if (rings.length) out.push(rings);
  }
  return out.length ? { type: "MultiPolygon", coordinates: out } : null;
}

// ----------------------------------------------------------------- each polity's life

// A name can belong to more than one state (two "Later Zhou"s, a thousand years
// apart), so a name's records are split into separate lives wherever they leave
// a gap of more than GAP years.
const GAP = 50;
const byName = new Map();
for (const f of polities) {
  const list = byName.get(f.properties.Name) ?? [];
  list.push(f);
  byName.set(f.properties.Name, list);
}
const lives = [];
const lifeOf = new Map(); // feature -> life index
for (const name of [...byName.keys()].sort()) {
  const list = byName.get(name).sort((a, b) => a.properties.FromYear - b.properties.FromYear);
  let l = null;
  for (const f of list) {
    const { FromYear, ToYear, Area } = f.properties;
    if (!l || FromYear > l.died + GAP) {
      l = { name, born: FromYear, died: ToYear, peak: FromYear, peakArea: -1, wiki: f.properties.Wikipedia ?? null };
      lives.push(l);
    }
    l.died = Math.max(l.died, ToYear);
    if ((Area ?? 0) > l.peakArea) {
      l.peakArea = Area ?? 0;
      l.peak = Math.round((FromYear + ToYear) / 2);
    }
    lifeOf.set(f, lives.length - 1);
  }
}

const features = [];
for (const f of polities) {
  const g = shape(f.geometry);
  if (!g) continue;
  const p = f.properties;
  features.push({ type: "Feature", geometry: g, properties: { i: lifeOf.get(f), f: p.FromYear, t: p.ToYear } });
}

// Merge back-to-back records of a polity whose simplified border has not changed.
features.sort((a, b) => a.properties.i - b.properties.i || a.properties.f - b.properties.f);
const merged = [];
for (const f of features) {
  const prev = merged[merged.length - 1];
  if (prev && prev.properties.i === f.properties.i && prev.properties.t + 1 >= f.properties.f && JSON.stringify(prev.geometry) === JSON.stringify(f.geometry)) {
    prev.properties.t = Math.max(prev.properties.t, f.properties.t);
  } else merged.push(f);
}
console.log(`merged ${features.length} border records into ${merged.length}`);
features.length = 0;
features.push(...merged);

const body = {
  source: "Cliopatria, Seshat Global History Databank (CC BY 4.0), https://github.com/Seshat-Global-History-Databank/cliopatria. Borders simplified; non-polity records dropped.",
  polities: lives.map((l) => ({ name: l.name, born: l.born, died: l.died, peak: l.peak, area: Math.round(l.peakArea), wiki: l.wiki })),
  type: "FeatureCollection",
  features,
};
mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify(body);
writeFileSync(OUT, json);
console.log(`polities: ${lives.length} lives of ${byName.size} names, ${features.length} border records, ${(json.length / 1e6).toFixed(1)} MB`);
