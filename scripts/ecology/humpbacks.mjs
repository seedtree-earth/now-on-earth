#!/usr/bin/env node
// Humpback whales on Australia's east coast, month by month.
//
// Build-time only: fetches aggregated counts from the Atlas of Living
// Australia (ALA) and GBIF, and writes one static JSON file the browser loads.
// The browser never calls these APIs.
//
// Polite by design:
//   · asks for counts already binned into 0.1° grid cells (facets), never pages
//     through individual records;
//   · one request at a time, at least THROTTLE_MS apart, with a User-Agent that
//     says who we are;
//   · every response is cached on disk, so a rerun makes no requests at all;
//   · any rate limit (429) or error stops the run at once. No retries.
//
// Usage:
//   node scripts/ecology/humpbacks.mjs --dry-run   list the requests, fetch nothing
//   node scripts/ecology/humpbacks.mjs             fetch (or read cache) and write JSON
//
// Licences: only CC0 and CC BY records are counted (no NonCommercial,
// NoDerivatives, ShareAlike, unspecified or custom terms). See DATA_SOURCES.md.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const CACHE = join(here, ".cache");
const OUT = join(root, "events", "humpback-whales.json");
const DRY = process.argv.includes("--dry-run");

const USER_AGENT = "now-on-earth/0.1 (+https://github.com/seedtree-earth/now-on-earth)";
const THROTTLE_MS = 1500;
/** Look up citation metadata only for sources carrying at least this share. */
const CITE_SHARE = 0.01;
const CITE_MAX = 8;

const SPECIES = "Megaptera novaeangliae";
/** The east coast, Torres Strait to southern Tasmania, out past the shelf. */
const BBOX = { south: -44, north: -9, west: 148, east: 160 };

const ALA = "https://api.ala.org.au/occurrences/occurrences/search";
const ALA_OPEN_LICENCES = ['"CC0"', '"CC-BY"', '"CC-BY 4.0 (Int)"', '"CC-BY 3.0 (Au)"'];
const ALA_COLLECTORY = "https://collections.ala.org.au/ws/dataResource/";
const GBIF = "https://api.gbif.org/v1/occurrence/search";
const GBIF_DATASET = "https://api.gbif.org/v1/dataset/";
const GBIF_OPEN_LICENCES = ["CC0_1_0", "CC_BY_4_0"];

// ----------------------------------------------------------------- requests

const alaUrl = (extra) => {
  const p = new URLSearchParams();
  p.append("q", `taxa:"${SPECIES}"`);
  p.append("fq", `decimalLatitude:[${BBOX.south} TO ${BBOX.north}]`);
  p.append("fq", `decimalLongitude:[${BBOX.west} TO ${BBOX.east}]`);
  p.append("fq", `license:(${ALA_OPEN_LICENCES.join(" OR ")})`);
  p.append("pageSize", "0");
  for (const [k, v] of extra) p.append(k, v);
  return `${ALA}?${p}`;
};

const gbifUrl = (extra) => {
  const p = new URLSearchParams();
  p.append("scientificName", SPECIES);
  p.append("decimalLatitude", `${BBOX.south},${BBOX.north}`);
  p.append("decimalLongitude", `${BBOX.west},${BBOX.east}`);
  p.append("hasCoordinate", "true");
  p.append("hasGeospatialIssue", "false");
  for (const l of GBIF_OPEN_LICENCES) p.append("license", l);
  p.append("limit", "0");
  for (const [k, v] of extra) p.append(k, v);
  return `${GBIF}?${p}`;
};

let network = 0;
let cached = 0;
let lastAt = 0;
const planned = [];

async function get(url, label) {
  const key = createHash("sha1").update(url).digest("hex");
  const file = join(CACHE, `${key}.json`);
  if (existsSync(file)) {
    cached++;
    return JSON.parse(readFileSync(file, "utf8")).body;
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
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  } catch (err) {
    console.log("failed");
    stop(`Network error on ${label}: ${err.message}`);
  }
  if (res.status === 429) {
    console.log("429");
    stop(`Rate limited (429) on ${label}. Stopping; nothing retried. Try again later.`);
  }
  if (!res.ok) {
    console.log(res.status);
    stop(`HTTP ${res.status} on ${label}. Stopping; nothing retried.\n  ${url}`);
  }
  const body = await res.json();
  console.log("ok");
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, JSON.stringify({ url, fetched: new Date().toISOString(), body }));
  return body;
}

function stop(message) {
  console.error(`\n${message}\nMade ${network} network request(s) this run; ${cached} came from cache.`);
  process.exit(1);
}

const facet = (body, name) => body?.facetResults?.find((f) => f.fieldName === name)?.fieldResult ?? [];

// ----------------------------------------------------------------- run

console.log(`Humpback whales · ${DRY ? "dry run (nothing fetched)" : "building"}`);

// 1. ALA: each month's sightings, counted per 0.1° cell.
const months = [];
for (let m = 1; m <= 12; m++) {
  const body = await get(alaUrl([["fq", `month:"${m}"`], ["facets", "point-0.1"], ["flimit", "10000"]]), `ALA month ${m} grid`);
  const cells = facet(body, "point-0.1").map((c) => {
    const [lat, lng] = c.label.split(",").map(Number);
    return [lng, lat, c.count];
  });
  months.push({ month: m, records: body?.totalRecords ?? 0, cells });
}

// 2. ALA: which data resources the counted records come from, for credit.
const alaSourcesBody = await get(alaUrl([["facets", "dataResourceUid"], ["flimit", "500"]]), "ALA sources");
const alaTotal = alaSourcesBody?.totalRecords ?? 0;
const alaResources = facet(alaSourcesBody, "dataResourceUid")
  .map((r) => ({ uid: (r.fq?.match(/"([^"]+)"/) ?? [])[1] ?? r.label, name: r.label, records: r.count }))
  .sort((a, b) => b.records - a.records);

// 3. GBIF: the same question, as an independent check of the monthly shape,
//    and the datasets behind it for DOIs.
const gbifBody = await get(gbifUrl([["facet", "month"], ["facet", "datasetKey"], ["facetLimit", "200"]]), "GBIF months and datasets");
const gbifFacet = (name) => gbifBody?.facets?.find((f) => f.field === name)?.counts ?? [];
const gbifTotal = gbifBody?.count ?? 0;
const gbifMonths = Array.from({ length: 12 }, (_, i) => Number(gbifFacet("MONTH").find((c) => Number(c.name) === i + 1)?.count ?? 0));
const gbifDatasets = gbifFacet("DATASET_KEY").map((d) => ({ key: d.name, records: d.count }));

// 4. Citation metadata for the sources that carry the weight.
const citeAla = alaResources.filter((r) => alaTotal && r.records / alaTotal >= CITE_SHARE).slice(0, CITE_MAX);
for (const r of citeAla) {
  const meta = await get(`${ALA_COLLECTORY}${encodeURIComponent(r.uid)}`, `ALA source ${r.uid}`);
  if (meta) {
    r.name = meta.name ?? r.name;
    r.licence = meta.licenseType ?? null;
    r.citation = meta.citation ?? null;
    r.rights = meta.rights ?? null;
    r.url = `https://collections.ala.org.au/public/show/${r.uid}`;
  }
}
const citeGbif = gbifDatasets.filter((d) => gbifTotal && d.records / gbifTotal >= CITE_SHARE).slice(0, CITE_MAX);
for (const d of citeGbif) {
  const meta = await get(`${GBIF_DATASET}${d.key}`, `GBIF dataset ${d.key.slice(0, 8)}`);
  if (meta) {
    d.title = meta.title ?? null;
    d.doi = meta.doi ?? null;
    d.licence = meta.license ?? null;
    d.citation = meta.citation?.text ?? null;
    d.url = `https://www.gbif.org/dataset/${d.key}`;
  }
}

if (DRY) {
  const fixed = planned.length;
  console.log(`\nWould make ${fixed} request(s) now, plus up to ${2 * CITE_MAX} citation lookups once the source lists are known`);
  console.log(`(at least ${THROTTLE_MS / 1000}s apart, so roughly ${Math.ceil(((fixed + 2 * CITE_MAX) * THROTTLE_MS) / 1000)}s at most).`);
  for (const p of planned) console.log(`  · ${p}`);
  process.exit(0);
}

// ----------------------------------------------------------------- shape

// Where the sightings sit along the coast each month: the record-weighted
// median latitude, so the layer can move a gentle marker with the season.
const track = months.map(({ month, cells }) => {
  const sorted = cells.slice().sort((a, b) => a[1] - b[1]);
  const total = sorted.reduce((s, c) => s + c[2], 0);
  if (!total) return { month, lat: null, lng: null, records: 0 };
  let acc = 0;
  let median = sorted[0];
  for (const c of sorted) {
    acc += c[2];
    if (acc >= total / 2) {
      median = c;
      break;
    }
  }
  // Longitude: record-weighted mean of the cells within a degree of the median.
  const near = sorted.filter((c) => Math.abs(c[1] - median[1]) <= 1);
  const w = near.reduce((s, c) => s + c[2], 0);
  const lng = near.reduce((s, c) => s + c[0] * c[2], 0) / w;
  return { month, lat: Math.round(median[1] * 100) / 100, lng: Math.round(lng * 100) / 100, records: total };
});

const out = {
  id: "humpback-whales-east-australia",
  name: "Humpback whales",
  species: SPECIES,
  region: "The east coast of Australia",
  generated: new Date().toISOString(),
  grid: 0.1,
  bbox: BBOX,
  licences: "CC0 and CC BY records only",
  months,
  track,
  crossCheck: {
    note: "GBIF carries many of the same datasets as ALA, so it is used as an independent check of the monthly shape, not added to the counts.",
    alaMonthly: months.map((m) => m.records),
    gbifMonthly: gbifMonths,
    alaTotal,
    gbifTotal,
  },
  sources: {
    ala: {
      provider: "Atlas of Living Australia",
      url: "https://www.ala.org.au",
      query: alaUrl([]),
      records: alaTotal,
      resources: alaResources.map(({ uid, name, records, licence, citation, rights, url }) => ({
        uid,
        name,
        records,
        ...(licence !== undefined && { licence }),
        ...(citation && { citation }),
        ...(rights && { rights }),
        ...(url && { url }),
      })),
    },
    gbif: {
      provider: "GBIF.org",
      url: "https://www.gbif.org",
      query: gbifUrl([]),
      records: gbifTotal,
      datasets: citeGbif,
    },
  },
  requests: { network, cached },
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`\nWrote ${OUT}`);
console.log(`ALA ${alaTotal} records in ${months.reduce((s, m) => s + m.cells.length, 0)} month-cells; GBIF ${gbifTotal} records (cross-check).`);
console.log(`Made ${network} network request(s) this run; ${cached} came from cache.`);
