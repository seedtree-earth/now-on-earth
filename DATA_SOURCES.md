# Data sources and attribution

Now on Earth's **code** is [MIT](LICENSE) licensed. That grant covers the source code only. It does **not** extend to third-party data, imagery or fonts: each keeps its own licence and terms, listed here. Attribution shown in the app must stay intact.

Every dataset gets a row **before** it is used. Planned sources are listed too, so their terms are checked before any code touches them.

## In use

| Source | Used for | Fetched | Licence / terms | Attribution |
| --- | --- | --- | --- | --- |
| **Mapbox GL JS** v3 (`mapbox-gl`, peer dependency) | Globe rendering | Bundled by the host (the standalone site, or the Landscape) | [Mapbox Terms of Service](https://www.mapbox.com/legal/tos); GL JS v2+ is proprietary and needs an access token | Mapbox wordmark and attribution control, required, left on in the site |
| **Mapbox Satellite Streets v12** (`mapbox://styles/mapbox/satellite-streets-v12`) | Base imagery and labels under the light. The Landscape's own style | Live, in the browser, with the consumer's token | Mapbox ToS; imagery from Mapbox's providers; labels from OpenStreetMap ([ODbL](https://opendatacommons.org/licenses/odbl/)) | "© Mapbox © OpenStreetMap", plus imagery credits, rendered by the attribution control |
| **Solar position algorithm** (NOAA Global Monitoring Laboratory solar calculator, after Jean Meeus, *Astronomical Algorithms*) | Subsolar point, declination, equation of time | Nothing fetched: computed locally from the clock | The NOAA equations are a U.S. government work (public domain); this is an independent implementation in `src/core/sun.ts` | Courtesy credit in the README |
| **Lunar position** (low-precision theory: leading periodic terms of Jean Meeus, *Astronomical Algorithms*, ch. 47) | Sublunar point, phase, the tidal bulges | Nothing fetched: computed locally | Published algorithm; independent implementation in `src/core/moon.ts` | Courtesy credit in the README |
| **Mock people and nodes** (`site/src/mock-people.ts`) | Demo of the people layer on the standalone site | Bundled | Fictional; no real people or organisations; coarse, well-known regions only | Labelled "sample" in the UI and "Mock node" on every dot |
| **Natural Earth** land outlines, 1:50m (via the `world-atlas` package, ISC) | The Flat model's disc (standalone site only) | Bundled, loaded when the Flat model is first shown | Natural Earth is public domain; world-atlas is ISC | "Land: Natural Earth", shown under the disc |
| **NASA GIBS** (Global Imagery Browse Services), WMTS tiles in EPSG:3857: `MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct` and `AMSRU2_Sea_Ice_Concentration_12km` | Sea ice and snow (Weather and ice lens) | Live, tiles loaded by the map in the browser as you view (no key; CORS open). Checked 2026-09-27 | NASA imagery, open for any use; no published rate limits | The GIBS acknowledgement, shown under the layer switch: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)." Plus "NASA GIBS" in the map's attribution line while the layer is on |
| **Fraunces** (Undercase Type) and **Instrument Sans** (Instrument) | Type, matching SeedTree V2 | Google Fonts, standalone site only | [SIL Open Font License 1.1](https://openfontlicense.org) | Not required in-app; listed here |

No personal data is collected. The viewer's position, when they choose to share it, is rounded to about ten kilometres and never leaves the page.

## Phase 3: ecological events

A build-time script (`scripts/ecology/humpbacks.mjs`) turns dated, located occurrence records into seasonal patterns by month, written to static JSON (`events/humpback-whales.json`). The browser never calls these APIs.

### Terms checked on 2026-09-27

| Source | Access | Rate limits | Licence of records | Attribution required |
| --- | --- | --- | --- | --- |
| **Atlas of Living Australia** (occurrence search, `api.ala.org.au/occurrences`; collectory metadata, `collections.ala.org.au/ws`) | Open, no key: "Most of our APIs do not require authentication" ([ALA support](https://support.ala.org.au/support/solutions/articles/6000261502-how-to-access-ala-apis)). JWTs only for sensitive or private data. | None published. We treat it as fair use: facet queries only, one at a time, 1.5 s apart, cached, stop on any error. | Set per data resource by each provider. For the humpback query: CC0, CC BY (3.0 AU, 4.0), and a large share of CC BY-NC, BY-NC-SA, BY-NC-ND, BY-SA, BY-ND, custom and unspecified. | [ALA terms of use](https://www.ala.org.au/terms-of-use/): users must "acknowledge, reference or attribute the relevant Data Provider (using any specific attribution wording they may have provided)" in any derived work, and must honour each provider's own terms. |
| **GBIF** (occurrence search, `api.gbif.org/v1/occurrence/search`; dataset metadata, `/v1/dataset`) | Open, no key for search. | Dynamic: "Rapid or numerous queries to search APIs may be rate limited, depending on our server load" (HTTP 429); for long jobs use the download API ([GBIF API docs](https://techdocs.gbif.org/en/openapi/)). Search pages cap at 300 records and an offset of 100,000. GBIF asks for a User-Agent naming the app. | Per dataset: CC0 1.0, CC BY 4.0 or CC BY-NC 4.0. | Cite the datasets used (dataset citation text and DOI), per the GBIF data user agreement. |

### How we use them

- **Only CC0 and CC BY records, from datasets that are open too.** Record licences are filtered in the query (no NonCommercial, NoDerivatives, ShareAlike, custom or unspecified records). Then every contributing dataset's own licence is looked up, and any dataset published under NC, ND or SA terms is excluded whole, even if its records are tagged CC0: the stricter licence wins.
- **Excluded on that rule:** *Happywhale · Humpback whale in South Pacific Ocean* (CC BY-NC dataset, 16,702 records tagged CC0). It is by far the largest source; leaving it out keeps the pattern shape but thins it.
- **Result:** 7,320 ALA records from 20 open datasets, in 2,123 month-cells. GBIF's independent monthly totals (7,463 records, Happywhale removed the same way) track ALA's closely. One kept dataset, *Entangled Wildlife Australia* (54 records), has a dataset licence recorded only as "other"; its records are CC0 or CC BY and it is not NC, ND or SA, so it stays under the rule as written. Worth confirming with the provider.
- **Aggregates, not records.** The script asks for counts per 0.1° grid cell per month (facets), so no individual sighting, observer or exact point is stored or shipped.
- **ALA is the source of the pattern; GBIF is a cross-check.** GBIF carries many of the same datasets as ALA (Happywhale, iNaturalist and others), so adding the two would count sightings twice. GBIF's monthly totals are stored beside ALA's as an independent check, and GBIF supplies DOIs for the main datasets.
- **Credit** is shown in the app whenever the layer is on (ALA, GBIF and the leading data resources), and the full source list, with each resource's licence and citation, is written into the JSON.
- **Politeness:** one request at a time, at least 1.5 s apart, with a User-Agent naming this repo. Responses are cached in `scripts/ecology/.cache/` (not committed), so reruns make no requests. Any 429 or error stops the run with no retries.
- **Requests made so far (2026-09-27):** 4 count-only probes by hand; a first build of 22 requests; a strict-licence rebuild of 30 (21 dataset licence lookups in all, 12 monthly grids, the kept-source list, one GBIF adjustment). 56 in total, none refused. A clean rebuild from cache makes 0.
- **Shown honestly:** as a broad, soft seasonal haze blended month to month, never points or tracks, with a note that sightings gather where people look. The UI credits ALA, GBIF.org and the leading datasets whenever the layer is on (in the Layers panel and the globe's attribution line), and links here for every dataset and licence.

### Sea ice and snow (checked 2026-09-27)

- **Chosen: NASA GIBS**, over the NSIDC Sea Ice Index, because it covers snow as well as sea ice.
- **Sea ice:** AMSR2 (GCOM-W1) sea ice concentration, 12 km, daily; the 15th of each month is shown. Microwave, so it sees through cloud and polar night. GHRSST MUR25 was ruled out (open water drawn opaque, rainbow scale), as was MODIS sea ice (gaps under cloud and in the polar night). The AMSR2 series in GIBS ends on 1 September 2025, so each month is taken from the most recent year held. AMSR2 does not observe the area right around the North Pole (the "pole hole").
- **Snow:** MODIS/Terra monthly average snow cover, March 2000 to August 2026 (with a few missing months, skipped).
- **Drawn** as soft white: any sea ice as one white; snow graded by cover, read back from NASA's colour scale. Months crossfade as the year slider turns.
- **Requests:** none at build time. While the layer is on, the map fetches GIBS tiles for the two months either side of the date, at the zoom in view (a few dozen small PNGs), and the browser caches them. Before building, 1 capabilities document and 4 colour-key files were read by hand to choose layers.

### Parked

| Source | Intended use | What to confirm before use |
| --- | --- | --- |
| **eBird** (Cornell Lab; API 2.0 or Status and Trends) | Bird migration | Needs an API key (not yet); eBird terms restrict redistribution of raw data; Status and Trends products have their own licence and citation |


## Partnered seasonal knowledge. Placeholder only

A layer for local and Indigenous seasonal calendars is reserved and **intentionally empty**. These calendars are **not** scraped, inferred or paraphrased from published sources. They will be added only in partnership, with the permission of the knowledge holders, on their terms, following Indigenous Cultural and Intellectual Property (ICIP) principles. Each entry will record who shared it, the permission given, and how it may be shown.
