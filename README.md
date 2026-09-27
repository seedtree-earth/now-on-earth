# Now on Earth

A clock that tells time by light instead of digits. The globe shows where the sun is overhead, rings of light spreading from it an hour of the Earth's turn apart, and rings of night closing in on midnight on the far side. There are no numbers, hands or time zones on the face. You find yourself on the globe and read the hour by where you sit in the light.

Now on Earth is its own site, and it is built to become a base layer of **the Landscape** on SeedTree.

## What is in the box

```
src/core/     pure maths: no DOM, no Mapbox, no network
  sun.ts        subsolar point, declination, equation of time, sun in the sky
  rings.ts      spherical caps as GeoJSON, cut cleanly at the antimeridian and poles
  seasons.ts    tropics, today's sun track, the viewer's parallel split into lit and dark
  twilight.ts   golden hour and civil, nautical, astronomical twilight as graded bands
  moon.ts       sublunar point, phase and illumination (low-precision Meeus)
  tides.ts      the moon's pull (P2 shape), spring and neap, in shapes and words
  people.ts     the Presence shape: opt-in only, coarse places, no search
  events.ts     seasonal ecological events, month blending, and the shapes for
                partnered knowledge and ground-truthing (placeholders)
  describe.ts   the light in words ("late afternoon · the sun is low to the west")
src/mapbox/   the light as layers on any Mapbox GL v3 map
  attach.ts     attachNowOnEarth(map, options) → controller
  layers/       one self-contained module per layer: tides, rings, twilight,
                seasons, people, moon, sun
  palette.ts    colours read from the host page's CSS tokens
site/         the standalone clock (Vite), built on the package's public exports
scripts/      boundary and copy checks, and ecology/ build scripts
events/       static event data built by those scripts (humpback-whales.json)
DATA_SOURCES.md  every dataset, its licence and its credit
```

The package publishes two entry points:

- `now-on-earth/core` (also the package root): for anything that wants the maths.
- `now-on-earth/mapbox`: for a page that already has a Mapbox map.

## Using it on an existing map (the Landscape)

The host owns the map, the token, the style and the projection. The clock only adds `noe-` sources and layers, and removes every one of them on `destroy()`. `mapbox-gl` is a peer dependency (`^3.26.0`, matching SeedTree V2) and is imported for types only.

```ts
import { attachNowOnEarth } from "now-on-earth/mapbox";

map.once("load", () => {
  // ...the host's own sources and layers...
  const clock = attachNowOnEarth(map, {
    beforeId: "clusters", // slip the light beneath the Landscape's pins
  });
  // later: clock.setTime(date) · clock.setTime(null) for live · clock.setVisible("seasons", false)
  // on unmount: clock.destroy()
});
```

`attachNowOnEarth(map, options)`:

| Option | Default | |
| --- | --- | --- |
| `time` | live | A fixed `Date`, or leave unset to follow the real clock |
| `viewer` | Northern Rivers, NSW | `{ lng, lat }` for the viewer's line and dot |
| `fine` | `false` | 5° rings instead of 15° |
| `people` | none | `Presence[]`; only those with `consent.shown` are drawn |
| `onPick` | none | Called with a person or node's details on hover or tap |
| `layers` | tides, rings, twilight, seasons, people, moon, sun | Layer modules, bottom to top |
| `hidden` | tides, people | Layer keys to start hidden |
| `beforeId` | first label layer | Host layer to sit beneath; `null` for on top |
| `themeElement` | `<html>` | Where to read colour tokens from |
| `tokens` / `palette` | V2 names | Rename tokens, or pin colours outright |

The controller has `setTime`, `isLive`, `setViewer`, `setFine`, `setPeople`, `setVisible`, `layers`, `follow("sun" | null)`, `faceSun`, `faceMe`, `frame`, `subscribe`, `refreshPalette` and `destroy`.

### Colour comes from the host

Nothing is hard-coded in the layers. They read SeedTree V2's own tokens off the page, and re-read them when `data-theme` flips between `morning` and `night`:

| Role | Token | Notes |
| --- | --- | --- |
| Sun, day rings, tropics, sun track | `--accent` | V2's gold |
| The heart of the day | `--noe-glow` | The clock's own; day rings pale toward it near the sun |
| Golden hour and twilight | `--noe-dusk` | The clock's own; a dusk rose |
| Moon, phase, tides | `--noe-moon` | The clock's own; moonlight silver |
| Night rings | `--noe-night` | The clock's own; defaults to a dusk violet |
| The viewer's line and dot | `--noe-me` | The clock's own; defaults to teal |
| Paper, ink | `--bg`, `--ink` | V2 |

So a V2 restyle flows straight into the light. The standalone site mirrors V2's values in `site/src/tokens.css`.

### Lenses

Layers are gathered into four lenses so the clock stays calm by default. Only **Light** is on at first; each lens is a switch for the whole way of looking, and opens to show its own layers. A layer is drawn when its lens is on and its own switch is on (`setLens`, `lensOn`, and `lenses` in the options; the grouping lives in `src/mapbox/lenses.ts`).

| Lens | Layers |
| --- | --- |
| Light | sun, rings (and finer rings), twilight, moon, tides, the sun's lane, today's sun track, your day line |
| Life | ecological events (humpbacks), plankton's nightly rise *(to come)*, people and nodes, partnered seasonal knowledge *(placeholder)*, migrations and iNaturalist sightings *(to come)* |
| Earth's body | the magnetic field, magnetic north's wandering, the aurora *(to come)*, the axis's wobble *(later)* |
| Weather and ice | sea ice and snow *(to come)*, the rain belt, carbon dioxide, fires *(later)* |

The Flat model is a separate switch, outside the lenses.

### The layers

| Key | What it shows | On by default |
| --- | --- | --- |
| `rings` | Gold hour rings round the sun, paling toward it; violet rings closing on midnight | yes |
| `twilight` | Golden hour warming to rose, then civil, nautical and astronomical twilight cooling to violet | yes |
| `lane` | The tropics: the sun's lane | yes |
| `sun-track` | Today's parallel under the sun | yes |
| `day-line` | The viewer's line, lit and dark, and their dot | yes |
| `moon` | The moon over its sublunar point, drawn in its true phase, mirrored for the southern hemisphere | yes |
| `sun` | The sun point, breathing slowly | yes |
| `tides` | The moon's pull: two swells rising toward their crests (under the moon and opposite), a faint low-water belt between, a dashed rim where the pull turns; fuller at spring tides, fainter at neap. The idealised equilibrium tide, not a tide table | no |
| `people` | People and nodes who chose to be shown, each dot in its own light | no |
| *event id* | Each `events` entry: a soft seasonal haze, blended month to month | yes, when passed |
| `partnered-knowledge` | Placeholder. Draws nothing until knowledge is shared with permission | n/a |

### Ecological events

```ts
import humpbacks from "now-on-earth/events/humpback-whales.json";
attachNowOnEarth(map, { events: [humpbacks] });
```

Event data is built ahead of time, never fetched in the browser:

```bash
npm run data:humpbacks -- --dry-run   # list the requests, fetch nothing
npm run data:humpbacks                # fetch (or read cache) and write events/
```

The dataset carries its own words (a general line per month), a credit line and a note on what it can't say. It's shown as a general seasonal pattern, not tracks. See [DATA_SOURCES.md](DATA_SOURCES.md) for the licence rules and every source.

### People: the line the layer holds

A `Presence` is `{ id, kind, name, place, placeName?, href?, consent }`. The layer draws only those with `consent.shown === true`, and rounds every place again on the way in (people and nodes to 0.5°, about 55 km; organisations to 0.1°). A presence is a place someone chose, never a device position: there is no tracking, no live location and no search. `fromLandscapeRows(rows)` reads the Landscape's public listings in the same shape. The standalone site uses clearly marked mock nodes (`site/src/mock-people.ts`).

### Writing a layer

Each layer is a factory returning a `ClockLayer`: `add`, `update`, `applyPalette`, `setVisible`, `remove`, and an optional `tick` for gentle motion. It owns its sources and layers outright and namespaces them with `ctx.id(...)`. Phase 3 layers (ecological events, partnered seasonal knowledge) slot into the same list.

## The standalone site

```bash
npm install
cp .env.example .env.local   # then add a public Mapbox token (pk.*)
npm run dev                  # http://localhost:5173
```

With no token, or no WebGL, the page still runs: the words and the sliders follow the light and the globe rests. Keys are never committed. The token comes from the consumer: `VITE_MAPBOX_TOKEN` for this site, the host's own map for the Landscape.

**Controls, all numberless:** the day (scrub twelve hours either way), the year (half a year either way, with the solstices and equinoxes marked where they fall: a gold disc for the longest day, an empty ring for the shortest, half-lit for the equinoxes, named for your hemisphere; tap one to go there), play and pause, face the sun (the camera follows it), face me, a Layers panel (the seasonal lines, twilight, the moon, the tides, people, finer rings), and morning or night. The slider tracks are drawn from the light itself: the sky over you across the day, and the length of your days across the year.

**Accessibility:** the face has no numbers, so it speaks. A polite live region describes the light in sentences ("Late afternoon. The sun is low to the west. Early spring, and the days are growing longer. A first quarter moon, high in the east."). The sliders carry the same words as their values. Reduced motion stops the sun's breathing and the camera's easing.

**Location** is never asked for on arrival. If the browser has already been given permission it is used quietly; otherwise the clock stands in the Northern Rivers until you press "Face me". It is rounded to about ten kilometres and never leaves the page.

## The Flat model

A switch in the Layers panel, labelled only "Flat model", swaps the globe for the common flat Earth depiction and runs it with the same controls (the day, the year, face the sun, face me), so anyone can compare what each model predicts for their own place. There is no commentary. Off by default; standalone site only (`site/src/flat/`), never part of the Landscape integration.

- **The disc:** a North-Pole-centred azimuthal equidistant map, Antarctica around the rim, drawn on a canvas with d3-geo and Natural Earth land. Drag to turn it. It needs no Mapbox token.
- **The sun:** a spotlight 3,000 miles above the disc, circling the centre once a day over today's tropic; seen from above it stands over the real subsolar point.
- **The light:** the spotlight reaches 2·90·sin 45° ≈ 127.3° of arc, calibrated so the equator gets exactly twelve hours at the equinox. Elevation is the flat geometry's, so the sun never goes below the horizon.
- **The words and tracks** follow the model that is showing: the face describes the disc's light, and the day and year tracks show the disc's day and year (on the globe's scale, so the two can be compared).
- Every parameter is stated once, in `site/src/flat/model.ts`, and tested beside the globe's predictions in `test/flat.test.ts`.

## Roadmap

- **Done:** the core light (sun, rings, seasons, words); twilight, moon, tides and people; humpback whales on the east coast from ALA and GBIF; the Flat model.
- **Next · birds:** eBird migration, once there is an API key and its redistribution terms are checked.
- **Future · community ground-truthing:** people confirm what they actually see by logging sightings on **iNaturalist** (in a SeedTree project), and a build-time script pulls them back: research grade, CC0 or CC BY only, coarsened and aggregated by month and cell exactly like the event data, shown as "what people are seeing this season" beside the long-run pattern. We don't run our own sightings database. The data shapes are drafted (`GroundTruthObservation`, `GroundTruthMonth` in `src/core/events.ts`) and the switch is in the Layers panel, off and marked "to come".
- **Future · partnered seasonal knowledge:** local and Indigenous seasonal calendars, only in partnership, with permission and on the holders' terms. Never scraped. The shape (`PartneredKnowledge`) and an empty placeholder layer are in place.
- **Joining the Landscape:** add the package to SeedTree V2 and call `attachNowOnEarth` from the Landscape's map `load` handler, with `fromLandscapeRows` feeding the people layer.

## Checks

```bash
npm run check    # typecheck, import boundaries, copy rules, tests
npm run build    # the package, to dist/
```

- **Boundaries:** `src/core` imports nothing outside itself and touches no DOM; `src/mapbox` imports `mapbox-gl` for types only; the site imports the package by its public names.
- **Copy:** no em dashes anywhere (use a mid dot, " · "); visible copy says "the Landscape", never "the map" or "the directory".

## Credits

Solar position after the NOAA Global Monitoring Laboratory solar calculator and Jean Meeus, *Astronomical Algorithms*; lunar position after Meeus, ch. 47. Architecture notes learned from [gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) (MIT): one module per layer, keys as upgrades, a data provenance file. See [DATA_SOURCES.md](DATA_SOURCES.md) for every dataset and its terms.

MIT licensed. Data, imagery and fonts keep their own licences.
