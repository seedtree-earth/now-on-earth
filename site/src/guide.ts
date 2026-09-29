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
  { key: "moon", lens: "light", title: "The moon", body: "Where the moon stands overhead, drawn in its true phase (mirrored for the southern hemisphere, as you would see it).", source: "Computed (lunar theory after Meeus).", swatch: "var(--noe-moon)", mark: "dot" },
  { key: "tides", lens: "light", title: "The moon's pull on the oceans", body: "Two swells where the moon's pull lifts the seas, under the moon and on the far side, with low water between and a dashed rim where the pull turns. Fuller at spring tides, fainter at neap. The idealised pull, not a tide table.", swatch: "var(--noe-moon)", mark: "fill" },
  { key: "lane", lens: "light", title: "The sun's lane", body: "The two tropics: the only band where the sun ever stands overhead.", swatch: "var(--accent)", mark: "dash" },
  { key: "sun-track", lens: "light", title: "Today's sun track", body: "The line the sun crosses overhead today, sliding between the tropics through the year.", swatch: "var(--accent)", mark: "dash" },
  { key: "day-line", lens: "light", title: "Your day line", body: "Your own latitude, bright where it is lit. How much of it is bright is how long your day is.", swatch: "var(--noe-me)", mark: "line" },

  // ------------------------------------------------------------ Life
  { key: "humpback-whales-east-australia", lens: "life", title: "Humpback whales", body: "Where humpbacks are seen along Australia's east coast in each month: north in winter, south with their calves in spring. A general seasonal pattern from sightings, not tracks.", source: "Atlas of Living Australia and GBIF.org · CC0 and CC BY records only.", swatch: "var(--noe-life)", mark: "glow" },
  { key: "bar-tailed-godwits-eaaf", lens: "life", title: "Bar-tailed Godwits", body: "Where these shorebirds are seen along the East Asian–Australasian Flyway each month: Australia and New Zealand in the southern summer, the Yellow Sea in April, Alaska to breed. A general pattern, not tracks.", source: "GBIF.org, including eBird's observations (CC BY 4.0).", swatch: "var(--noe-flight)", mark: "glow" },
  { key: "plankton", lens: "life", title: "Plankton's nightly rise", body: "A model of a real daily pattern: each night zooplankton rise from the deep to feed near the surface in the dark and sink before dawn. The glow is brightest along the dusk edge, where they are arriving.", source: "A model, after Brierley (2014), Current Biology.", swatch: "var(--noe-plankton)", mark: "glow" },
  { key: "people", lens: "life", title: "People and nodes", body: "People and places that chose to be shown, each dot in its own light: gold by day, rose at twilight, violet by night. Coarse places only. Sample data for now.", swatch: "var(--noe-dusk)", mark: "dot" },

  // ------------------------------------------------------------ Earth's body
  { key: "magnetic-field", lens: "earth", title: "The magnetic field", body: "A few of the loops of the Earth's own magnetic field, traced from the World Magnetic Model. Further out the solar wind reshapes the real field.", source: "World Magnetic Model 2025 (NOAA NCEI and BGS).", swatch: "var(--noe-field)", mark: "line" },
  { key: "magnetic-poles", lens: "earth", title: "Magnetic north's wandering", body: "Where the north and south magnetic poles have wandered since 1925, fading into the past, with the geographic poles beside them.", source: "NOAA NCEI, from IGRF.", swatch: "var(--noe-field)", mark: "dot" },
  { key: "aurora", lens: "earth", title: "The aurora", body: "Near the present moment, NOAA's live forecast of where the aurora may be seen. Away from now, a typical oval in grey with dashed edges. Only where it is dark.", source: "NOAA Space Weather Prediction Center (OVATION).", swatch: "var(--noe-aurora)", mark: "glow" },

  // ------------------------------------------------------------ Weather and ice
  { key: "sea-ice", lens: "weather", title: "Sea ice and snow", body: "Where sea ice and snow lay in this month of a recent year, in soft white, crossfading month to month.", source: "NASA GIBS (AMSR2 sea ice, MODIS snow).", swatch: "#ffffff", mark: "fill" },

  // ------------------------------------------------------------ Controls
  { key: "control-day", lens: "controls", title: "The day", body: "Slide twelve hours either way from now. The track shows the sky over you across those hours." },
  { key: "control-year", lens: "controls", title: "The year", body: "Slide half a year either way. The track shows how long your days are; the marks are the solstices and equinoxes (tap one to go there)." },
  { key: "control-pace", lens: "controls", title: "Play and pace", body: "Play sets the sun moving. While it plays, the Pace slider runs from as it is, through hours, days and weeks, to seasons, where your hour is held and the year runs by in about a minute. Each full turn of the sun carries the year on by a day, as it really does." },
  { key: "control-face", lens: "controls", title: "Face the sun · Face me", body: "Keep the sun in view as it moves, or come back to where you are." },
  { key: "control-flat", lens: "controls", title: "Flat model", body: "Switches the globe for the common flat Earth depiction, run with the same clock, so the two can be compared." },
];

export const LENS_TITLES: Record<GuideEntry["lens"], string> = {
  light: "Light",
  life: "Life",
  earth: "Earth's body",
  weather: "Weather and ice",
  controls: "The controls",
};

export const guideFor = (key: string) => GUIDE.find((g) => g.key === key);
