# Data sources and attribution

Now on Earth's **code** is [MIT](LICENSE) licensed. That grant covers the source code only. It does **not** extend to third-party data, imagery or fonts: each keeps its own licence and terms, listed here. Attribution shown in the app must stay intact.

Every dataset gets a row **before** it is used. Planned sources are listed too, so their terms are checked before any code touches them.

## In use

| Source | Used for | Fetched | Licence / terms | Attribution |
| --- | --- | --- | --- | --- |
| **Mapbox GL JS** v3 (`mapbox-gl`, peer dependency) | Globe rendering | Bundled by the host (the standalone site, or the Landscape) | [Mapbox Terms of Service](https://www.mapbox.com/legal/tos); GL JS v2+ is proprietary and needs an access token | Mapbox wordmark and attribution control, required, left on in the site |
| **Mapbox Satellite Streets v12** (`mapbox://styles/mapbox/satellite-streets-v12`) | Base imagery and labels under the light. The Landscape's own style | Live, in the browser, with the consumer's token | Mapbox ToS; imagery from Mapbox's providers; labels from OpenStreetMap ([ODbL](https://opendatacommons.org/licenses/odbl/)) | "© Mapbox © OpenStreetMap", plus imagery credits, rendered by the attribution control |
| **Solar position algorithm** (NOAA Global Monitoring Laboratory solar calculator, after Jean Meeus, *Astronomical Algorithms*) | Subsolar point, declination, equation of time | Nothing fetched: computed locally from the clock | The NOAA equations are a U.S. government work (public domain); this is an independent implementation in `src/core/sun.ts` | Courtesy credit in the README |
| **Fraunces** (Undercase Type) and **Instrument Sans** (Instrument) | Type, matching SeedTree V2 | Google Fonts, standalone site only | [SIL Open Font License 1.1](https://openfontlicense.org) | Not required in-app; listed here |

No personal data is collected. The viewer's position, when they choose to share it, is rounded to about ten kilometres and never leaves the page.

## Planned (phase 3: ecological events). Not yet in use

The build-time script will turn dated, located occurrence records into seasonal patterns by month, written to static JSON. The browser never calls these APIs. Terms, rate limits and required citations **must be re-checked against each provider's current documentation** before the first fetch, and this table updated with what was confirmed and when.

| Source | Intended use | What to confirm before use |
| --- | --- | --- |
| **Atlas of Living Australia** (biocache / occurrence API) | Australian occurrences, starting with humpback whales (*Megaptera novaeangliae*) on the east coast | API key or anonymous limits; per-record licences (mostly CC BY / CC BY-NC by data resource); citation and DOI for downloads |
| **GBIF** (occurrence search and download API) | Global occurrences; cross-check for the whale hero dataset | Per-record licences (CC0 / CC BY / CC BY-NC); citing a download DOI; rate limits on search vs. download |
| **eBird** (Cornell Lab; API 2.0 or Status and Trends) | Bird migration, if feasible | API key; eBird terms restrict redistribution of raw data; Status and Trends products have their own licence and citation |

Records under a **NonCommercial** licence (CC BY-NC) will be filtered out or carved out explicitly, and each rendered event layer will credit its sources in the UI.

## Partnered seasonal knowledge. Placeholder only

A layer for local and Indigenous seasonal calendars is reserved and **intentionally empty**. These calendars are **not** scraped, inferred or paraphrased from published sources. They will be added only in partnership, with the permission of the knowledge holders, on their terms, following Indigenous Cultural and Intellectual Property (ICIP) principles. Each entry will record who shared it, the permission given, and how it may be shown.
