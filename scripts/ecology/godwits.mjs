#!/usr/bin/env node
// Bar-tailed Godwits of the East Asian–Australasian Flyway, month by month.
//
// Build-time only, like humpbacks.mjs. From GBIF (which carries eBird's
// observations as the CC BY 4.0 "eBird Observation Dataset", with ALA and
// others): one binned count map per month, licence-filtered to CC0 and CC BY,
// cut to the flyway. The browser never calls GBIF.
//
// Polite by design: map tiles already binned into cells (never individual
// records), one request at a time at least THROTTLE_MS apart, a User-Agent
// naming this repo, every response cached, and any error stops the run.
//
// Usage:
//   node scripts/ecology/godwits.mjs --dry-run
//   node scripts/ecology/godwits.mjs

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const CACHE = join(here, ".cache");
const OUT = join(root, "events", "bar-tailed-godwits.json");
const DRY = process.argv.includes("--dry-run");

const USER_AGENT = "now-on-earth/0.1 (+https://github.com/seedtree-earth/now-on-earth)";
const THROTTLE_MS = 1500;
const TAXON_KEY = 2481681; // Limosa lapponica (GBIF backbone)
const SPECIES = "Limosa lapponica";
const LICENCES = ["CC0_1_0", "CC_BY_4_0"];
const CITE_SHARE = 0.01;
const CITE_MAX = 7;
/** Map bins: 16 of the tile's 4,096 units, about 1.4° of longitude. */
const SQUARE = 16;

/**
 * The flyway, as two boxes either side of the date line: Australia, New
 * Zealand, the Yellow Sea, East Asia and Siberia (90°E–180°), and Alaska
 * (180°–140°W).
 */
const BOXES = [
  { name: "west of the date line", lng: [90, 180], lat: [-50, 75] },
  { name: "east of the date line", lng: [-180, -140], lat: [-50, 75] },
];
const inFlyway = (lng, lat) => BOXES.some((b) => lng >= b.lng[0] && lng <= b.lng[1] && lat >= b.lat[0] && lat <= b.lat[1]);

const base = () => {
  const p = new URLSearchParams();
  p.append("taxonKey", String(TAXON_KEY));
  p.append("hasGeospatialIssue", "false");
  for (const l of LICENCES) p.append("license", l);
  return p;
};
const tileUrl = (month) => {
  const p = base();
  p.append("srs", "EPSG:3857");
  p.append("month", String(month));
  p.append("bin", "square");
  p.append("squareSize", String(SQUARE));
  return `https://api.gbif.org/v2/map/occurrence/adhoc/0/0/0.mvt?${p}`;
};
const searchUrl = (box) => {
  const p = base();
  p.append("decimalLongitude", box.lng.join(","));
  p.append("decimalLatitude", box.lat.join(","));
  p.append("limit", "0");
  p.append("facet", "month");
  p.append("facet", "datasetKey");
  p.append("facetLimit", "200");
  return `https://api.gbif.org/v1/occurrence/search?${p}`;
};

let network = 0;
let cached = 0;
let lastAt = 0;
const planned = [];

function stop(message) {
  console.error(`\n${message}\nMade ${network} network request(s) this run; ${cached} came from cache.`);
  process.exit(1);
}

async function get(url, label, binary = false) {
  const file = join(CACHE, createHash("sha1").update(url).digest("hex"));
  if (existsSync(file)) {
    cached++;
    const buf = readFileSync(file);
    return binary ? buf : JSON.parse(buf.toString("utf8"));
  }
  if (DRY) {
    planned.push(label);
    return null;
  }
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
  const buf = Buffer.from(await res.arrayBuffer());
  console.log("ok");
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, buf);
  return binary ? buf : JSON.parse(buf.toString("utf8"));
}

/** Tile units (0..extent) at zoom 0 in Web Mercator to longitude and latitude. */
function toLngLat(x, y, extent) {
  const lng = (x / extent) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / extent;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return [Math.round(lng * 100) / 100, Math.round(lat * 100) / 100];
}

const restrictive = (licence) => !!licence && /(^|[^a-z])(nc|nd|sa)([^a-z]|$)|custom/i.test(licence);

console.log(`Bar-tailed Godwits · ${DRY ? "dry run (nothing fetched)" : "building"}`);

// 1. One binned map per month.
const months = [];
for (let m = 1; m <= 12; m++) {
  const buf = await get(tileUrl(m), `GBIF month ${m} map`, true);
  const cells = [];
  if (buf) {
    const tile = new VectorTile(new Pbf(buf));
    const layer = tile.layers.occurrence;
    for (let i = 0; layer && i < layer.length; i++) {
      const f = layer.feature(i);
      const ring = f.loadGeometry()[0];
      const cx = ring.reduce((s, p) => s + p.x, 0) / ring.length;
      const cy = ring.reduce((s, p) => s + p.y, 0) / ring.length;
      const [lng, lat] = toLngLat(cx, cy, layer.extent);
      if (inFlyway(lng, lat)) cells.push([lng, lat, Number(f.properties.total ?? 0)]);
    }
  }
  months.push({ month: m, records: cells.reduce((s, c) => s + c[2], 0), cells });
}

// 2. The datasets behind the flyway's records, for credit and a licence check.
const byDataset = new Map();
const monthly = new Array(12).fill(0);
let total = 0;
for (const box of BOXES) {
  const body = await get(searchUrl(box), `GBIF sources ${box.name}`);
  if (!body) continue;
  total += body.count ?? 0;
  for (const f of body.facets ?? []) {
    for (const c of f.counts) {
      if (f.field === "DATASET_KEY") byDataset.set(c.name, (byDataset.get(c.name) ?? 0) + c.count);
      if (f.field === "MONTH") monthly[Number(c.name) - 1] += c.count;
    }
  }
}
const datasets = [...byDataset.entries()].map(([key, records]) => ({ key, records })).sort((a, b) => b.records - a.records);

// 3. Citation and licence for the datasets that carry the weight.
const cite = datasets.filter((d) => total && d.records / total >= CITE_SHARE).slice(0, CITE_MAX);
for (const d of cite) {
  const meta = await get(`https://api.gbif.org/v1/dataset/${d.key}`, `GBIF dataset ${d.key.slice(0, 8)}`);
  if (meta) {
    d.title = meta.title ?? null;
    d.doi = meta.doi ?? null;
    d.licence = meta.license ?? null;
    d.citation = meta.citation?.text ?? null;
    d.url = `https://www.gbif.org/dataset/${d.key}`;
  }
}

if (DRY) {
  console.log(`\nWould make ${planned.length} request(s) now, plus up to ${CITE_MAX} dataset lookups once the source list is known.`);
  for (const p of planned) console.log(`  · ${p}`);
  process.exit(0);
}

// GBIF sets an occurrence's licence from its dataset, so these should agree;
// if a restrictive dataset ever appears, stop rather than ship it.
const bad = cite.filter((d) => restrictive(d.licence));
if (bad.length) stop(`Restrictive dataset licence found: ${bad.map((d) => `${d.title} (${d.licence})`).join("; ")}. Not writing.`);

// ----------------------------------------------------------------- words

const STORY = [
  "godwits feed on the mudflats of Australia and New Zealand, fattening for the flight north",
  "godwits feed on the mudflats of Australia and New Zealand, fattening for the flight north",
  "godwits leave Australia and New Zealand, flying north toward the Yellow Sea",
  "godwits rest and feed on the shores of the Yellow Sea",
  "godwits fly on to Alaska and Siberia to breed",
  "godwits nest on the tundra of Alaska and Siberia",
  "godwits raise their young on the tundra",
  "godwits gather on Alaska's coast, fattening for the longest flight",
  "godwits cross the Pacific south, some without once stopping",
  "godwits are back on the mudflats of Australia and New Zealand",
  "godwits are back on the mudflats of Australia and New Zealand",
  "godwits feed on the mudflats of Australia and New Zealand through the southern summer",
];

const leading = cite.slice(0, 3).map((d) => d.title).filter(Boolean);
const out = {
  id: "bar-tailed-godwits-eaaf",
  name: "Bar-tailed Godwits",
  species: SPECIES,
  region: "The East Asian–Australasian Flyway, from Australia and New Zealand to Alaska",
  lens: "life",
  hue: "flight",
  glow: 2.4,
  generated: new Date().toISOString(),
  grid: 1.4,
  licences: "CC0 and CC BY records only",
  story: STORY,
  credit: `Sightings via GBIF.org, from ${leading.join(", ")} and others · CC0 and CC BY records`,
  note: "A general seasonal pattern along the flyway, not tracks. Sightings gather where people watch: estuaries, shorebird sites and survey routes.",
  sourcesUrl: "https://github.com/seedtree-earth/now-on-earth/blob/main/DATA_SOURCES.md",
  months,
  crossCheck: { gbifMonthly: monthly, total, note: "Record counts per month from GBIF search over the same flyway boxes." },
  sources: { gbif: { provider: "GBIF.org", url: "https://www.gbif.org", datasets: cite } },
  requests: { network, cached },
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`\nWrote ${OUT}`);
console.log(`Flyway records ${total}; cells per month: ${months.map((m) => m.cells.length).join(" ")}`);
console.log(`Made ${network} network request(s) this run; ${cached} came from cache.`);
