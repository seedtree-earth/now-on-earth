/**
 * What every element is, in a sentence or two: shown in the Guide panel and
 * used as the heading of the hover pop-ups. Plain words, mid dots, no dashes.
 */

import type { LensId } from "now-on-earth/mapbox";

export type GuideEntry = {
  key: string;
  lens: LensId | "controls";
  title: string;
  body: string;
  /** Where it comes from, if it is data. */
  source?: string;
  /** CSS colour (usually a token) for the swatch. */
  swatch?: string;
  /** Swatch shape. */
  mark?: "fill" | "line" | "dash" | "dot" | "glow" | "number";
};

export const GUIDE: GuideEntry[] = [
  // ------------------------------------------------------------ Light
  { key: "sun", lens: "light", title: "The sun", body: "The point where the sun stands straight overhead right now. Everything on the clock is measured from here.", source: "Computed from the date and time (NOAA solar equations).", swatch: "var(--accent)", mark: "dot" },
  { key: "day-light", lens: "light", title: "Daylight", body: "Everywhere the sun is up. Each band is one hour of the Earth's turn away from the sun, the gold deepening and paling to warm white toward it.", swatch: "var(--accent)", mark: "fill" },
  { key: "night-shade", lens: "light", title: "Night shade", body: "Everywhere the sun is down, deepening toward local midnight on the far side of the Earth.", swatch: "var(--noe-night)", mark: "fill" },
  { key: "hour-rings", lens: "light", title: "Hour rings", body: "The edges of the hour bands. The firmest is the terminator, the line between day and night.", swatch: "var(--accent)", mark: "line" },
  { key: "hour-numbers", lens: "light", title: "Hour numbers", body: "Hours from the sun: 1 to 6 outward through the day, 7 to 12 across the night to midnight. Subtract two places' numbers to count the hours between them (add them if they sit either side of the sun).", swatch: "var(--ink)", mark: "number" },
  { key: "twilight", lens: "light", title: "Twilight and golden hour", body: "The soft light either side of the terminator: golden hour while the sun is low, then civil, nautical and astronomical twilight as it sinks below the horizon.", swatch: "var(--noe-dusk)", mark: "fill" },
  { key: "moon", lens: "light", title: "The moon", body: "Where the moon stands overhead, drawn in its true phase (mirrored for the southern hemisphere, as you would see it). Beneath it, the quality many keep for this part of the moon's month: the new moon for intention, the full moon for illumination, the waning moon for release, the dark moon for rest. A practice, not a claim about the moon's influence.", source: "Computed (lunar theory after Meeus).", swatch: "var(--noe-moon)", mark: "dot" },
  { key: "tides", lens: "light", title: "The moon's pull on the oceans", body: "Two swells where the moon's pull lifts the seas, under the moon and on the far side, with low water between and a dashed rim where the pull turns. Fuller at spring tides, fainter at neap. The idealised pull, not a tide table.", swatch: "var(--noe-moon)", mark: "fill" },
  { key: "lane", lens: "light", title: "The sun's lane", body: "The two tropics: the only band where the sun ever stands overhead.", swatch: "var(--accent)", mark: "dash" },
  { key: "sun-track", lens: "light", title: "Today's sun track", body: "The line the sun crosses overhead today, sliding between the tropics through the year.", swatch: "var(--accent)", mark: "dash" },
  { key: "day-line", lens: "light", title: "Your day line", body: "Your own latitude, bright where it is lit. How much of it is bright is how long your day is.", swatch: "var(--noe-me)", mark: "line" },

  // ------------------------------------------------------------ Life
  { key: "humpback-whales-east-australia", lens: "life", title: "Humpback whales", body: "The humpbacks' corridor along Australia's east coast, as a flow: particles stream north in winter and south with the calves in spring, the ribbon swelling in season and fading over summer, when they are away in Antarctic waters. Slide the year to watch it turn. The corridor and timing come from where sightings gather each month; no single whale or sighting is drawn.", mark: "line", source: "Atlas of Living Australia and GBIF.org · CC0 and CC BY records only.", swatch: "var(--noe-life)" },
  { key: "bar-tailed-godwits-eaaf", lens: "life", title: "Bar-tailed Godwits", body: "The hero route of the East Asian–Australasian Flyway as a flow: New Zealand to the Yellow Sea in March, on to Alaska to breed in April and May, then straight back across the Pacific in September, the longest nonstop flight of any bird. Each leg streams in its own season and rests out of it. The legs join the stopovers where the birds are seen; the routes between, over open sea, are drawn as the shortest way, not tracked.", source: "GBIF.org, including eBird's observations (CC BY 4.0).", swatch: "var(--noe-flight)", mark: "glow" },
  { key: "notes-life", lens: "life", title: "Life noticed on the ground", body: "Trees flowering and fruiting, cicadas and frogs calling, birds arriving and leaving: the season's signs, noted by people where they are, placed to about ten kilometres. Fresh notes are bright and fade over a month. Add your own from any place card.", source: "Shared by the people who noticed them, CC0 or CC BY 4.0 as each chose.", swatch: "var(--noe-life)", mark: "dot" },

  { key: "people", lens: "life", title: "People and nodes", body: "People and places that chose to be shown, each dot in its own light: gold by day, rose at twilight, violet by night. Coarse places only. Sample data for now.", swatch: "var(--noe-dusk)", mark: "dot" },

  // ------------------------------------------------------------ Earth's body
  { key: "ancient-coasts", lens: "earth", title: "Ancient coastlines", body: "In deep time, the seabed that was dry land when the sea stood lower, drawn as soft sand over today's sea. Slide back to the Last Ice Age and Australia, New Guinea and Tasmania are one land, Britain walks to Europe and Asia meets America. It follows the ice ages back about 800,000 years. One global sea level on today's seabed: coasts that have since risen or sunk are not adjusted, and the curve runs a few metres low in the last few thousand years.", source: "GEBCO_2025 seabed; Spratt & Lisiecki (2016) sea level, via NOAA NCEI.", swatch: "var(--noe-shore)", mark: "fill" },

  { key: "magnetic-field", lens: "earth", title: "The magnetic field", body: "A few of the loops of the Earth's own magnetic field, traced from the World Magnetic Model. Further out the solar wind reshapes the real field.", source: "World Magnetic Model 2025 (NOAA NCEI and BGS).", swatch: "var(--noe-field)", mark: "line" },
  { key: "magnetic-poles", lens: "earth", title: "Magnetic north's wandering", body: "Where the north and south magnetic poles have wandered since 1925, fading into the past, with the geographic poles beside them.", source: "NOAA NCEI, from IGRF.", swatch: "var(--noe-field)", mark: "dot" },
  { key: "aurora", lens: "earth", title: "The aurora", body: "Near the present moment, NOAA's live forecast of where the aurora may be seen. Away from now, a typical oval in grey with dashed edges. Only where it is dark.", source: "NOAA Space Weather Prediction Center (OVATION).", swatch: "var(--noe-aurora)", mark: "glow" },

  { key: "earthquakes", lens: "earth", title: "Major earthquakes", body: "The past month's significant earthquakes, as USGS ranks them by magnitude, how widely they were felt and their impact. Rings grow with magnitude and fade over a month; the last day's breathe. Real events: for warnings, follow local authorities.", source: "U.S. Geological Survey, live (refreshed every ten minutes).", swatch: "var(--noe-quake)", mark: "dot" },
  { key: "volcanoes", lens: "earth", title: "Erupting volcanoes", body: "Eruptions from the past year that GDACS rated orange or red, fading with age.", source: "Global Disaster Alert and Coordination System, GDACS, live.", swatch: "var(--noe-ember)", mark: "dot" },

  // ------------------------------------------------------------ Weather and ice
  { key: "weather-here", lens: "weather", title: "The weather here", body: "The weather now, in words, at a place you tap or stand: the sky, how warm it is and the wind. One place at a time, never drawn over the globe. It is the weather now, even when the sliders show another hour. It draws nothing on the globe, so it speaks whenever its own switch is on, lens open or not.", source: "MET Norway Locationforecast, CC BY 4.0." },

  { key: "notes-weather", lens: "weather", title: "Weather noticed on the ground", body: "Frost, rain in the gauge, the first snow, a storm: noted by people where they are, as small blue dots placed to about ten kilometres. Fresh notes are bright and fade over a month; scrub the year to watch them arrive. Add your own from any place card.", source: "Shared by the people who noticed them, CC0 or CC BY 4.0 as each chose.", swatch: "var(--noe-rain)", mark: "dot" },

  { key: "sea-ice", lens: "weather", title: "Sea ice and snow", body: "Where sea ice and snow lay in this month of a recent year, in soft white, crossfading month to month.", source: "NASA GIBS (AMSR2 sea ice, MODIS snow).", swatch: "#ffffff", mark: "fill" },

  { key: "fires", lens: "weather", title: "Major wildfires", body: "Wildfires GDACS rated orange or red in the past two months: a warm glow while they burn, fading for a week after. Real events: for warnings, follow local authorities.", source: "Global Disaster Alert and Coordination System, GDACS, live.", swatch: "var(--noe-fire)", mark: "glow" },

  // ------------------------------------------------------------ Controls
  { key: "wheel-marks", lens: "wheel", title: "The wheel of the year", body: "The eight turnings of the year, worked out from the sun: the two solstices, the two equinoxes, and the four cross-quarter days at the true midpoints between them. They sit on a loop around the sun, each at the latitude the sun stands over at that moment, with a small gold hand where the year is now. Every turning has two names, because the wheel turns opposite in each hemisphere: the northern name above, the southern below. When the north is at Beltane, the south is at Samhain. The names are those of the Celtic/European wheel tradition, one tradition among many, not a universal calendar.", source: "Computed from the sun's ecliptic longitude (NOAA solar equations).", swatch: "var(--noe-dusk)", mark: "dot" },
  { key: "wheel-local", lens: "wheel", title: "Local seasonal knowledge", body: "A place kept beside the wheel for the seasons as the people of a place know them, shared by their custodians, in partnership and on their terms. It is empty until it is shared. Calendars are never scraped, inferred or paraphrased from published sources." },

  { key: "control-day", lens: "controls", title: "The day", body: "Slide twelve hours either way from now. The track shows the sky over you across those hours." },
  { key: "control-year", lens: "controls", title: "The year", body: "Slide half a year either way. The track shows how long your days are; the marks are the solstices and equinoxes (tap one to go there)." },
  { key: "control-depth", lens: "controls", title: "Day · Year · Deep time", body: "Choose how far to look. Day and Year move the light, as ever. Deep time reaches back through thousands, then millions of years, marked by named moments rather than figures (the years are in the words above). In deep time the sun and the rings stay live; the Earth's own layers follow you back, and the ones that only know the present (live events, people, notes, today's migrations and magnetic field) step aside." },
  { key: "control-pace", lens: "controls", title: "Play and pace", body: "Play sets the sun moving. While it plays, the Pace slider runs from as it is, through hours, days and weeks, to seasons, where your hour is held and the year runs by in about a minute. Each full turn of the sun carries the year on by a day, as it really does." },
  { key: "control-face", lens: "controls", title: "Face the sun · Face me", body: "Keep the sun in view as it moves, or come back to where you are." },
  { key: "control-stand", lens: "controls", title: "Stand here", body: "Tap any place on the globe, then Stand here: the clock speaks for that place, and a Here card gathers what is happening on the ground there. Back to me comes home." },
  { key: "control-note", lens: "controls", title: "Add what you notice", body: "From a place card or the Here card: say what you noticed (the first frost, rain in the gauge, a tree in flower, cicadas starting), the day, and how it may be shared. It is placed to about ten kilometres, with no time of day, and named only if you give a name. On this site, notes are kept in your browser only." },
  { key: "control-flat", lens: "controls", title: "Flat model", body: "Switches the globe for the common flat Earth depiction, run with the same clock, so the two can be compared." },
];

export const LENS_TITLES: Record<GuideEntry["lens"], string> = {
  light: "Light",
  wheel: "Wheel",
  life: "Life",
  earth: "Earth's body",
  weather: "Weather and ice",
  controls: "The controls",
};

export const guideFor = (key: string) => GUIDE.find((g) => g.key === key);
