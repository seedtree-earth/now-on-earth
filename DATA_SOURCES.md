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
| **Mapbox Geocoding** (reverse, v6) | A name for a place the viewer chooses to stand ("Lisbon, Portugal") | Live, one request per place chosen, with the site's own token; cached on the page. Never asked for the viewer's real location | Mapbox ToS (temporary geocoding: names shown, not stored) | Covered by the Mapbox attribution on the globe |
| **Fraunces** (Undercase Type) and **Instrument Sans** (Instrument) | Type, matching SeedTree V2 | Google Fonts, standalone site only | [SIL Open Font License 1.1](https://openfontlicense.org) | Not required in-app; listed here |

No personal data is collected. The viewer's position, when they choose to share it, is rounded to about ten kilometres and never leaves the page. Places chosen with "Stand here" are rounded the same way, and only those are sent to Mapbox to be named.

## Phase 3: ecological events

A build-time script (`scripts/ecology/humpbacks.mjs`) turns dated, located occurrence records into seasonal patterns by month, written to static JSON (`events/humpback-whales.json`). The browser never calls these APIs.

### Terms checked on 2026-09-27

| Source | Access | Rate limits | Licence of records | Attribution required |
| --- | --- | --- | --- | --- |
| **Atlas of Living Australia** (occurrence search, `api.ala.org.au/occurrences`; collectory metadata, `collections.ala.org.au/ws`) | Open, no key: "Most of our APIs do not require authentication" ([ALA support](https://support.ala.org.au/support/solutions/articles/6000261502-how-to-access-ala-apis)). JWTs only for sensitive or private data. | None published. We treat it as fair use: facet queries only, one at a time, 1.5 s apart, cached, stop on any error. | Set per data resource by each provider. For the humpback query: CC0, CC BY (3.0 AU, 4.0), and a large share of CC BY-NC, BY-NC-SA, BY-NC-ND, BY-SA, BY-ND, custom and unspecified. | [ALA terms of use](https://www.ala.org.au/terms-of-use/): users must "acknowledge, reference or attribute the relevant Data Provider (using any specific attribution wording they may have provided)" in any derived work, and must honour each provider's own terms. |
| **GBIF** (occurrence search, `api.gbif.org/v1/occurrence/search`; dataset metadata, `/v1/dataset`) | Open, no key for search. | Dynamic: "Rapid or numerous queries to search APIs may be rate limited, depending on our server load" (HTTP 429); for long jobs use the download API ([GBIF API docs](https://techdocs.gbif.org/en/openapi/)). Search pages cap at 300 records and an offset of 100,000. GBIF asks for a User-Agent naming the app. | Per dataset: CC0 1.0, CC BY 4.0 or CC BY-NC 4.0. | Cite the datasets used (dataset citation text and DOI), per the GBIF data user agreement. |

### How we use them

- **Only CC0 and CC BY records, from datasets that are open too.** Record licences are filtered in the query (no NonCommercial, NoDerivatives, ShareAlike, custom or unspecified records). Then every contributing dataset's own licence is looked up, and any dataset published under NC, ND or SA terms is excluded whole, even if its records are tagged CC0: the stricter licence wins.
- **Drawn as a flow (2026-10-01):** the same option A data, unchanged and not re-fetched, now drives a corridor and a season (see README, Ecological events) rather than a haze of sightings. No new requests.
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

### Magnetic field and poles (checked 2026-09-27)

| Source | Used for | Fetched | Terms | Attribution |
| --- | --- | --- | --- | --- |
| **World Magnetic Model 2025** (NOAA NCEI and British Geological Survey), `WMM2025COF.zip` from [ncei.noaa.gov](https://www.ncei.noaa.gov/products/world-magnetic-model/wmm-coefficients) | Field lines traced from the model's spherical harmonic coefficients (degree 12, epoch 2025.0, valid to the end of 2029) | Once, at build time (`scripts/earth/magnetic.mjs`), written to `src/core/data/wmm2025.ts` | "The WMM source code is in the public domain and not licensed or under copyright. The information and software may be used freely by the public." Works built largely on U.S. government material should say so. | "NOAA NCEI Geomagnetic Modeling Team; British Geological Survey. 2024: World Magnetic Model 2025." |
| **Wandering of the Geomagnetic Poles** (NOAA NCEI): dip pole positions computed from IGRF, `NP.xy` and `SP.xy` from [ngdc.noaa.gov](https://www.ncei.noaa.gov/products/wandering-geomagnetic-poles) | The trail of the north and south magnetic poles since 1925, and their current positions | Once, at build time, written to `src/core/data/magnetic-poles.ts` | U.S. government data; no licence restrictions stated | "Magnetic pole positions: NOAA NCEI (IGRF)" |

- **Requests:** 3 in total (the coefficient zip and the two pole files), one at a time, 1.5 s apart, cached in `scripts/earth/.cache/` so rebuilds make none; any error stops the run.
- The model describes the field the Earth makes itself. Far out in space the real field is squeezed and stretched by the solar wind, which the model does not include; the field lines are drawn close to the Earth and described as the Earth's own field.

### The aurora (checked 2026-09-27)

| Source | Used for | Fetched | Terms | Attribution |
| --- | --- | --- | --- | --- |
| **NOAA Space Weather Prediction Center**, OVATION aurora forecast (`services.swpc.noaa.gov/json/ovation_aurora_latest.json`; model OVATION 2020, based on OVATION Prime by P. Newell, JHU/APL) | The live aurora oval near the present moment | Live, through our own function `/api/aurora` (Vercel), which fetches NOAA at most once every ten minutes and caches at the CDN; the browser never calls NOAA | U.S. government work; SWPC states no licence restrictions. NOAA's JSON is open to browsers (CORS `*`) and has no published rate limits; NOAA marks it `max-age=60` | "NOAA Space Weather Prediction Center, OVATION aurora forecast (based on the OVATION Prime model by P. Newell, JHU/APL)", under the layer switch |

- **Why a function, although the browser could fetch NOAA directly:** NOAA's file is about 900 KB (a 1° grid of 65,160 cells). Fetched once per visitor, that is a lot of load on NOAA and a heavy download on a phone. The function keeps only cells with aurora to show (value 3 and above; about 160 KB), fetches at most once every ten minutes, and the CDN serves everyone else. One request per ten minutes per edge cache region, User-Agent naming this site, no retries; if NOAA errors, the last good copy is served, marked stale.
- **Typical, not live:** more than an hour from the present, the live glow fades out and a typical oval is drawn instead (a moderately active night, after Feldstein's ovals, around the geomagnetic pole from the World Magnetic Model), in grey with dashed edges, and the words say "a typical aurora, not tonight's".

### Land and sea mask (2026-09-27)

- **Used for:** the tides' words and place words such as "the open ocean". A 1° sea mask built locally by `scripts/earth/ocean-mask.mjs` from Natural Earth land at 1:110m (public domain, via world-atlas, ISC). No network requests.

### Bar-tailed Godwits (checked 2026-09-27)

- **eBird directly: not used.** eBird's data terms require Cornell's explicit permission for any commercial use and forbid redistributing the data ([eBird data use](https://support.ebird.org/en/support/solutions/articles/48001078113-ebird-data-privacy-and-data-use)); the Status and Trends products are non-commercial only and must be shown exactly as downloaded ([terms](https://science.ebird.org/en/status-and-trends/products-access-terms-of-use)). Both fall outside our rule, so no eBird key is needed or used.
- **eBird's observations via GBIF: used.** Cornell publishes the *EOD – eBird Observation Dataset* to GBIF under **CC BY 4.0** ([doi:10.15468/aomfnb](https://doi.org/10.15468/aomfnb)), alongside ALA-origin and other datasets. Citation: Imani J, Audette C, et al. (2025). EOD – eBird Observation Dataset. Cornell Lab of Ornithology. Occurrence dataset https://doi.org/10.15468/aomfnb accessed via GBIF.org.
- **How:** `scripts/ecology/godwits.mjs` asks GBIF's map service for one binned count map per month (square bins of about 1.4°), licence-filtered to CC0 and CC BY, and keeps the cells in the East Asian–Australasian Flyway (90°E to 140°W). Two searches over the same boxes give the source list and a monthly cross-check (they agree with the maps almost exactly). Every leading dataset is CC BY 4.0; the script stops rather than ship any NC, ND or SA dataset.
- **Requests:** 2 probes by hand (the taxon key, one test map), then 21 in the build (12 monthly maps, 2 source searches, 7 dataset lookups), one at a time 1.5 s apart, cached; a rebuild makes none.
- **Result:** 182,018 flyway records. Most in Australia and New Zealand from October to March; the Yellow Sea rising in April; Alaska highest in June. Shown as a soft amber haze with a general line per month, credited under the switch.

- **Drawn as a flyway (2026-10-01):** the same data, not re-fetched, drives three legs between stopovers (New Zealand, the Yellow Sea, Alaska): the hero route of the New Zealand birds. Each stopover's place is the weighted middle of its sightings; each leg's season is when one stopover empties as the next fills. The legs over open sea have no sightings (the birds cross nonstop), so they are drawn as great circles between the stopovers, and the words and Guide say so. No new requests.

### Earthquakes, volcanoes and wildfires (checked 2026-09-29)

| Source | Used for | Fetched | Terms | Attribution |
| --- | --- | --- | --- | --- |
| **USGS Earthquake Hazards Program**, GeoJSON feed "Significant Earthquakes, Past Month" | Major earthquakes (Earth's body) | Live, through our function `/api/hazards` (at most every ten minutes, CDN-cached); USGS updates the feed every minute | U.S. government data, public domain; CORS open | "U.S. Geological Survey", under the switch; each quake links to its USGS event page |
| **GDACS** (Global Disaster Alert and Coordination System; UN and European Commission), event API: wildfire (WF) and volcano (VO) alerts at orange or red | Major wildfires (Weather and ice), erupting volcanoes (Earth's body) | Live, same function: wildfires from the past 60 days, eruptions from the past year | GDACS's API quick start: data are free, with the source acknowledged as "Global Disaster Alert and Coordination System, GDACS" ([quick start](https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v2.pdf)). Its terms add that GDACS does not replace official warnings and comes without warranty ([terms](https://www.gdacs.org/About/termofuse.aspx)) | "Global Disaster Alert and Coordination System, GDACS", under each switch; each event links to its GDACS report |

- **Thresholds:** USGS's own "significant" ranking (magnitude, felt reports and impact), and GDACS orange and red alerts. Everything below is left out.
- **Not used:** the Smithsonian Global Volcanism Program. Its content is under the Smithsonian's terms, which allow non-commercial use only ([GVP terms](https://volcano.si.edu/gvp_termsofuse.cfm)), outside our rule.
- **Requests:** 3 per refresh (one each: USGS, GDACS wildfires, GDACS volcanoes), at most once every ten minutes, one at a time, a User-Agent naming this site, no retries; a failed source keeps its last good copy. While checking the sources, 5 requests were made by hand.
- **Shown with care:** these are real events, some with losses. The words are plain ("a strong earthquake, magnitude 6.4, near Kainantu, Papua New Guinea, a few days ago"), each links to its official report, and the credits say to follow local authorities for warnings.

### The weather here (checked 2026-10-01)

| Source | Used for | Fetched | Terms | Attribution |
| --- | --- | --- | --- | --- |
| **MET Norway Locationforecast 2.0** (`api.met.no/weatherapi/locationforecast/2.0/compact`, the Norwegian Meteorological Institute) | The weather now, in words, at a place the viewer taps or stands (Weather and ice lens). Never a layer over the globe | Live, through our function `/api/weather`: one request per place, rounded to 0.1° first, memoised and CDN-cached until MET Norway's own `Expires` (usually 30 to 60 minutes, never more than three hours). The browser never calls MET Norway | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and NLOD 2.0; commercial use allowed. The [terms of service](https://api.met.no/doc/TermsOfService) require an identifying User-Agent, at most four decimals in coordinates, honouring `Expires`, and an agreement above 20 requests a second in total | "Weather from MET Norway, CC BY 4.0", under the switch |

- **Not used:** Open-Meteo. Its free API is for non-commercial use only ([terms](https://open-meteo.com/en/terms)), outside our rule.
- **Requests:** one per newly chosen place per forecast, no retries; a failure keeps the last good copy for that place, or says nothing. While building, 2 requests were made (Lisbon).

### Ground notes: what people notice (2026-10-01)

Contributed by the people who use the clock, not fetched from anywhere. Each writer chooses **CC BY 4.0** (the default) or **CC0** for their note, in line with the rule for every other source; NC, ND and SA are not offered. Places are rounded to 0.1° and kept with a day, never a time; names are optional and used only as credit ("Noted by Sam · CC BY 4.0", or "someone nearby"). On the standalone site notes are kept in the writer's own browser and are not sent anywhere. No requests are made.

### Ancient coastlines (checked 2026-10-01)

| Source | Used for | Fetched | Terms | Attribution |
| --- | --- | --- | --- | --- |
| **GEBCO_2025 Grid** (GEBCO Compilation Group), ice-surface elevation, 15 arc-second | Today's shallow seabed (0 to 150 m), which the low sea of the ice ages left dry | Once, at build time (`scripts/earth/coastlines.mjs`), through CEDA's OPeNDAP server as a strided sample: every 24th point, a 0.1° grid, in 6 requests (about 26 MB). The 7 GB file was never downloaded. Written to `site/public/data/shelf-depth.png` (379 KB) | [Public domain](https://www.gebco.net/data-products/gridded-bathymetry-data), free for any use including commercial | "GEBCO Compilation Group (2025) GEBCO 2025 Grid", under the switch |
| **Spratt & Lisiecki (2016)**, a Late Pleistocene sea level stack, *Climate of the Past* 12: 1079–1092 | Global sea level, one value per thousand years to 798,000 years ago: the short stack (seven records) to 430,000 years, the long stack (five records) beyond | Once, at build time, from NOAA NCEI Paleoclimatology (1 request, about 0.1 MB). Written to `src/core/data/sea-level.ts` | The paper is [CC BY 3.0](https://cp.copernicus.org/articles/12/1079/2016/); NOAA asks only to be cited: [doi:10.25921/rd66-5820](https://doi.org/10.25921/rd66-5820) | "Spratt & Lisiecki (2016), via NOAA NCEI", under the switch and in the Guide |

- **Requests:** 7 in all (1 NOAA, 6 CEDA), one at a time, 3 seconds apart, a User-Agent naming this project, cached (`scripts/earth/.cache/`, not committed), stop on any error. Plus 1 small metadata request by hand to confirm the OPeNDAP address.
- **What it can't say:** one global sea level laid on today's seabed. It does not adjust for coasts that have since risen or sunk (the land rebounding after the ice, sediment, coral growth), and the 0.1° grid can miss very narrow channels. The stack is smoothed, so in the last few thousand years it runs a few metres low (about 5 m at 2,000 years ago, where the sea was near today's): a better curve for the last 30,000 years (for example Lambeck et al. 2014) would sharpen this, if its data can be used under our licence rule.
- **Not used:** ETOPO 2022 (NOAA, public domain) was the fallback; GEBCO's OPeNDAP made the requested source practical.

### Images for places (rule set 2026-10-01)

For the Places lens (sacred sites, to come), images from Wikimedia Commons may be **CC0, public domain, CC BY or CC BY-SA**. This is the one exception to the no-SA rule: ShareAlike binds only adaptations, so an image shown **unmodified**, with its full credit, licence and a link to its Commons page, keeps to its terms. No cropping beyond the browser's own scaling, no filters, no overlays drawn into the image. NC and ND images are still excluded, as is anything a custodian has asked not to be shown.

### Parked

| Source | Intended use | What to confirm before use |
| --- | --- | --- |
| **eBird Status and Trends** (Cornell Lab) | Weekly modelled abundance for many species | Non-commercial only; would need Cornell's permission or a change to our licence rule |


## Partnered seasonal knowledge. Placeholder only

A layer for local and Indigenous seasonal calendars is reserved and **intentionally empty**. These calendars are **not** scraped, inferred or paraphrased from published sources. They will be added only in partnership, with the permission of the knowledge holders, on their terms, following Indigenous Cultural and Intellectual Property (ICIP) principles. Each entry will record who shared it, the permission given, and how it may be shown.
