# Now on Earth

A clock that tells time by light instead of digits. The globe shows where the sun is overhead, rings of light spreading from it an hour of the Earth's turn apart, and rings of night closing in on midnight on the far side. There are no numbers, hands or time zones on the face. You find yourself on the globe and read the hour by where you sit in the light.

Now on Earth is its own site, and it is built to become a base layer of **the Landscape** on SeedTree.

## What is in the box

```
src/core/     pure maths: no DOM, no Mapbox, no network
  sun.ts        subsolar point, declination, equation of time, sun in the sky
  rings.ts      spherical caps as GeoJSON, cut cleanly at the antimeridian and poles
  seasons.ts    tropics, today's sun track, the viewer's parallel split into lit and dark
  describe.ts   the light in words ("late afternoon · the sun is low to the west")
src/mapbox/   the light as layers on any Mapbox GL v3 map
  attach.ts     attachNowOnEarth(map, options) → controller
  layers/       one self-contained module per layer: rings, seasons, sun
  palette.ts    colours read from the host page's CSS tokens
site/         the standalone clock (Vite), built on the package's public exports
scripts/      boundary and copy checks; phase 3 data builds will live here
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
| `layers` | rings, seasons, sun | Layer modules, bottom to top |
| `hidden` | none | Layer keys to start hidden |
| `beforeId` | first label layer | Host layer to sit beneath; `null` for on top |
| `themeElement` | `<html>` | Where to read colour tokens from |
| `tokens` / `palette` | V2 names | Rename tokens, or pin colours outright |

The controller has `setTime`, `isLive`, `setViewer`, `setFine`, `setVisible`, `layers`, `follow("sun" | null)`, `faceSun`, `faceMe`, `frame`, `subscribe`, `refreshPalette` and `destroy`.

### Colour comes from the host

Nothing is hard-coded in the layers. They read SeedTree V2's own tokens off the page, and re-read them when `data-theme` flips between `morning` and `night`:

| Role | Token | Notes |
| --- | --- | --- |
| Sun, day rings, tropics, sun track | `--accent` | V2's gold |
| Night rings | `--noe-night` | The clock's own; defaults to a dusk violet |
| The viewer's line and dot | `--noe-me` | The clock's own; defaults to teal |
| Paper, ink | `--bg`, `--ink` | V2 |

So a V2 restyle flows straight into the light. The standalone site mirrors V2's values in `site/src/tokens.css`.

### Writing a layer

Each layer is a factory returning a `ClockLayer`: `add`, `update`, `applyPalette`, `setVisible`, `remove`, and an optional `tick` for gentle motion. It owns its sources and layers outright and namespaces them with `ctx.id(...)`. Phase 2 and 3 layers (twilight, moon, people, ecological events, partnered seasonal knowledge) slot into the same list.

## The standalone site

```bash
npm install
cp .env.example .env.local   # then add a public Mapbox token (pk.*)
npm run dev                  # http://localhost:5178
```

With no token, or no WebGL, the page still runs: the words and the sliders follow the light and the globe rests. Keys are never committed. The token comes from the consumer: `VITE_MAPBOX_TOKEN` for this site, the host's own map for the Landscape.

**Controls, all numberless:** the day (scrub twelve hours either way), the year (half a year either way), play and pause, face the sun (the camera follows it), face me, fine rings, the seasonal lines, and morning or night. The slider tracks are drawn from the light itself: the sky over you across the day, and the length of your days across the year.

**Accessibility:** the face has no numbers, so it speaks. A polite live region describes the light in sentences ("Late afternoon. The sun is low to the west. Early spring, and the days are growing longer."). The sliders carry the same words as their values. Reduced motion stops the sun's breathing and the camera's easing.

**Location** is never asked for on arrival. If the browser has already been given permission it is used quietly; otherwise the clock stands in the Northern Rivers until you press "Face me". It is rounded to about ten kilometres and never leaves the page.

## Checks

```bash
npm run check    # typecheck, import boundaries, copy rules, tests
npm run build    # the package, to dist/
```

- **Boundaries:** `src/core` imports nothing outside itself and touches no DOM; `src/mapbox` imports `mapbox-gl` for types only; the site imports the package by its public names.
- **Copy:** no em dashes anywhere (use a mid dot, " · "); visible copy says "the Landscape", never "the map" or "the directory".

## Credits

Solar position after the NOAA Global Monitoring Laboratory solar calculator and Jean Meeus, *Astronomical Algorithms*. Architecture notes learned from [gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) (MIT): one module per layer, keys as upgrades, a data provenance file. See [DATA_SOURCES.md](DATA_SOURCES.md) for every dataset and its terms.

MIT licensed. Data, imagery and fonts keep their own licences.
