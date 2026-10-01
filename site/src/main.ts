/**
 * The standalone clock: a globe of its own, the light from now-on-earth, and a
 * dock of numberless controls. Everything the Landscape will reuse lives in the
 * library; this file is only the frame around it.
 */

import "./styles.css";
import mapboxgl from "mapbox-gl";
import {
  FALLBACK_VIEWER,
  type LngLat,
  type SeasonalEvent,
  describeLight,
  eventStory,
  auroraWords,
  compassWords,
  firesAt,
  fireWords,
  quakesAt,
  quakeWords,
  volcanoesAt,
  volcanoWords,
  planktonWords,
  moonState,
  seasonMarkWords,
  typicalAurora,
  seasonMarks,
  sunState,
  tideWords,
} from "now-on-earth/core";
import humpbacksJson from "now-on-earth/events/humpback-whales.json";
import godwitsJson from "now-on-earth/events/bar-tailed-godwits.json";
import { GIBS_ACKNOWLEDGEMENT, type NowOnEarth, type PresencePick, attachNowOnEarth, hazardsFor, readPalette } from "now-on-earth/mapbox";
import { createLensPanel } from "./lens-panel";
import { GUIDE, LENS_TITLES } from "./guide";
import { type HoverItem, hoverItems } from "./hover";
import { flatHoverItems } from "./flat/hover";
import { placeName } from "./place-name";
import { WEATHER_CREDIT, weatherAt } from "./weather";
import { MOCK_PEOPLE } from "./mock-people";

/** Static, built at build time by scripts/ecology/humpbacks.mjs. Never fetched live. */
const humpbacks = humpbacksJson as unknown as SeasonalEvent;
const godwits = godwitsJson as unknown as SeasonalEvent;
import { askPosition, quietPosition } from "./location";
import { dayTrack, yearTrack } from "./tracks";
import { describeFlat } from "./flat/model";
import { createFlatView } from "./flat/view";

const TOKEN: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN;
const STYLE = "mapbox://styles/mapbox/satellite-streets-v12"; // the Landscape's own style

const MIN = 60000;
const DAY = 86400000;
/**
 * The pace of play. The first four run time straight on (each full turn of
 * the sun carries the year on by a day, as it really does). At the fastest,
 * Seasons, the hour is held and the days step on, so the year's slow changes
 * show without the sun spinning into a blur.
 */
type Pace = { word: string; say: string; minutesPerSecond?: number; daysPerSecond?: number };
const PACES: Pace[] = [
  { word: "as it is", say: "as it is, in real time", minutesPerSecond: 1 / 60 },
  { word: "hours", say: "an hour of sky every second", minutesPerSecond: 60 },
  { word: "days", say: "a full turn of the sun every twelve seconds", minutesPerSecond: 120 },
  { word: "weeks", say: "about a week every second", minutesPerSecond: 7 * 1440 },
  { word: "seasons", say: "the year in about a minute, your hour held", daysPerSecond: 6 },
];
let pace = 2;
let seasonCarry = 0;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const els = {
  globe: $("globe"),
  phase: $("phase"),
  sky: $("sky"),
  where: $("where"),
  words: $("light-words"),
  notice: $("notice"),
  scrub: $<HTMLInputElement>("scrub"),
  season: $<HTMLInputElement>("season"),
  play: $<HTMLButtonElement>("play"),
  pace: $<HTMLInputElement>("pace"),
  paceRow: $("pace-row"),
  paceWord: $("pace-word"),
  now: $<HTMLButtonElement>("now"),
  faceSun: $<HTMLButtonElement>("face-sun"),
  faceMe: $<HTMLButtonElement>("face-me"),
  layers: $<HTMLButtonElement>("layers"),
  guide: $<HTMLButtonElement>("guide"),
  guidePanel: $("guide-panel"),
  tip: $("hover-tip"),
  layersPanel: $("layers-panel"),
  moonline: $("moonline"),
  flatSwitch: $<HTMLInputElement>("flat-model"),
  yearMarks: $("year-marks"),
  eventline: $("eventline"),
  pick: $("pick"),
  theme: $<HTMLButtonElement>("theme"),
};

// ---------------------------------------------------------------- state

let offsetMin = 0; // time scrub, -720 .. 720
let dayShift = 0; // season, -182 .. 182
let playing = false;
let viewer: LngLat = { ...FALLBACK_VIEWER };
let located = false;
/** Where the viewer really is (once known); standing elsewhere does not change it. */
let home: LngLat | null = null;
/** A place the viewer chose to stand, and its name. */
let standing: { at: LngLat; name: string } | null = null;
let clock: NowOnEarth | null = null;
/** The flat model's disc, drawn in the globe's place when switched on. */
const flat = createFlatView(document.querySelector<HTMLElement>(".shell")!);
if (import.meta.env.DEV) Object.assign(window, { __flat: flat });
const isFlat = () => flat.isShown();
// ---------------------------------------------------------------- lenses

/** The credit that sits under the humpback switch, with a link to every source. */
const eventCredit = document.createElement("p");
eventCredit.className = "credit";
eventCredit.textContent = `${humpbacks.credit ?? ""}. ${humpbacks.note ?? ""} `;
if (humpbacks.sourcesUrl) {
  const a = document.createElement("a");
  a.href = humpbacks.sourcesUrl;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "All sources and licences";
  eventCredit.append(a);
}

/** NASA's acknowledgement, under the sea ice switch. */
const iceCredit = document.createElement("p");
iceCredit.className = "credit";
iceCredit.textContent = `Snow: MODIS/Terra monthly snow cover. Sea ice: AMSR2 sea ice concentration, GCOM-W1 (the series in GIBS ends in September 2025). ${GIBS_ACKNOWLEDGEMENT}`;

/** Credit for the magnetic layers. */
const magCredit = document.createElement("p");
magCredit.className = "credit";
magCredit.textContent =
  "Field: World Magnetic Model 2025, NOAA NCEI Geomagnetic Modeling Team and British Geological Survey (public domain; U.S. government material). The model is the Earth's own field; further out the solar wind reshapes it. Pole positions: NOAA NCEI, Wandering of the Geomagnetic Poles (IGRF).";

/** The aurora's credit, and what it is showing: live or typical. */
const auroraCredit = document.createElement("p");
auroraCredit.className = "credit";
const AURORA_CREDIT =
  "Live: NOAA Space Weather Prediction Center, OVATION aurora forecast (based on the OVATION Prime model by P. Newell, JHU/APL), refreshed every ten minutes. Typical: a moderately active night's oval, drawn in grey with dashed edges.";
auroraCredit.textContent = AURORA_CREDIT;
let auroraLive: { points: Array<[number, number, number]> } | null = null;
let auroraMode: "live" | "typical" | "unavailable" = "typical";

/** Plankton: a model, said plainly, with its source. */
const planktonCredit = document.createElement("p");
planktonCredit.className = "credit";
planktonCredit.innerHTML =
  'A model of a real daily pattern, not data: each night zooplankton rise from the deep to feed near the surface in the dark and sink before dawn (diel vertical migration), drawn here from the light alone over the oceans. See <a href="https://doi.org/10.1016/j.cub.2014.08.054" target="_blank" rel="noopener">Brierley, A. S. (2014), Diel vertical migration, <i>Current Biology</i> 24: R1074–R1076</a>. Ocean outline: Natural Earth.';

/** A credit line for an event dataset, with a link to every source. */
function creditFor(e: SeasonalEvent): HTMLElement {
  const p = document.createElement("p");
  p.className = "credit";
  p.textContent = `${e.credit ?? ""}. ${e.note ?? ""} `;
  if (e.sourcesUrl) {
    const a = document.createElement("a");
    a.href = e.sourcesUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "All sources and licences";
    p.append(a);
  }
  return p;
}

/** Credits for the live hazard layers. */
const credit = (text: string) => {
  const p = document.createElement("p");
  p.className = "credit";
  p.textContent = text;
  return p;
};
const quakeCredit = credit("Live from the U.S. Geological Survey: the past month's significant earthquakes. For warnings, follow local authorities.");
const volcanoCredit = credit("Live from the Global Disaster Alert and Coordination System, GDACS: eruptions rated orange or red in the past year.");
const fireCredit = credit("Live from the Global Disaster Alert and Coordination System, GDACS: wildfires rated orange or red in the past two months. GDACS alerts do not replace official warnings.");

/** Finer rings: a setting inside the Light lens rather than a layer. */
const fineRow = document.createElement("label");
fineRow.className = "switch";
fineRow.innerHTML = '<input type="checkbox" id="fine" /><span>Finer rings</span>';
const fineInput = fineRow.querySelector("input")!;

const lenses = createLensPanel(
  $("lenses"),
  [
    { key: "sun", label: "The sun", built: true, on: true },
    { key: "day-light", label: "Daylight", note: "(the sun's gold)", built: true, on: true },
    { key: "night-shade", label: "Night shade", built: true, on: true },
    { key: "hour-rings", label: "Hour rings", built: true, on: true },
    { key: "hour-numbers", label: "Hour numbers", note: "(hours from the sun, for counting time differences)", built: true, on: true },
    { key: "twilight", label: "Twilight and golden hour", built: true, on: true },
    { key: "moon", label: "The moon", built: true, on: true },
    { key: "tides", label: "The moon's pull on the oceans", built: true, on: false },
    { key: "lane", label: "The sun's lane", built: true, on: true },
    { key: "sun-track", label: "Today's sun track", built: true, on: true },
    { key: "day-line", label: "Your day line", built: true, on: true },
    {
      key: humpbacks.id,
      label: "Humpback whales on the east coast",
      note: "(the seasonal pattern)",
      built: true,
      on: true,
      after: eventCredit,
    },
    {
      key: godwits.id,
      label: "Bar-tailed Godwits across the Pacific",
      note: "(the seasonal pattern)",
      built: true,
      on: true,
      after: creditFor(godwits),
    },
    { key: "plankton", label: "Plankton's nightly rise", note: "(a model)", built: true, on: true, after: planktonCredit },
    { key: "people", label: "People and nodes", note: "(sample)", built: true, on: false },
    {
      key: "partnered-knowledge",
      label: "Seasonal knowledge, shared in partnership",
      note: "· to come, with permission",
      built: false,
      on: false,
    },
    { key: "magnetic-field", label: "The magnetic field", note: "(the Earth's own, from the World Magnetic Model)", built: true, on: true },
    { key: "magnetic-poles", label: "Magnetic north's wandering", note: "(since 1925)", built: true, on: true, after: magCredit },
    { key: "earthquakes", label: "Major earthquakes", note: "(live, the past month)", built: true, on: true, after: quakeCredit },
    { key: "volcanoes", label: "Erupting volcanoes", note: "(live, the past year)", built: true, on: true, after: volcanoCredit },
    { key: "fires", label: "Major wildfires", note: "(live, while they burn)", built: true, on: true, after: fireCredit },
    { key: "aurora", label: "The aurora", note: "(live near now, typical otherwise)", built: true, on: true, after: auroraCredit },
    { key: "weather-here", label: "The weather here", note: "(now, in words, where you tap or stand)", built: true, on: true, after: credit(WEATHER_CREDIT) },
    { key: "sea-ice", label: "Sea ice and snow", note: "(a recent year, month by month)", built: true, on: true, after: iceCredit },
  ],
  {
    eventLens: { [humpbacks.id]: "life", [godwits.id]: "life" },
    extras: { light: [fineRow] },
    onLayer: (key, shown) => {
      clock?.setVisible(key, shown);
      push();
    },
    onLens: (lens, on) => {
      clock?.setLens(lens, on);
      push();
    },
  },
);
/** What is showing, so the words work even without a globe. */
const shownLayers = { has: (key: string) => lenses.isShown(key) };
/** The weather draws nothing on the globe, so it speaks in the cards whenever its own switch is on. */
const weatherOn = () => !lenses.offKeys().includes("weather-here");


const shown = () => new Date(Date.now() + dayShift * DAY + offsetMin * MIN);
const isLive = () => !playing && offsetMin === 0 && dayShift === 0;

// ---------------------------------------------------------------- words

function driftWords(): string {
  const parts: string[] = [];
  const d = Math.abs(dayShift);
  if (d >= 1) {
    const when = d <= 3 ? "a few days" : d <= 24 ? "a few weeks" : d <= 75 ? "a month or two" : d <= 140 ? "a season" : "half a year";
    parts.push(dayShift > 0 ? `${when} ahead` : `${when} back`);
  }
  const h = Math.abs(offsetMin);
  if (h >= 5) {
    const when = h <= 90 ? "a little" : h <= 360 ? "some hours" : "many hours";
    parts.push(offsetMin > 0 ? `${when} later` : `${when} earlier`);
  }
  return parts.length ? `Looking ${parts.join(", ")}` : "";
}

let lastSentence = "";
let lastSpoken = 0;

function renderWords() {
  const date = shown();
  const moonOn = shownLayers.has("moon");
  // The face speaks for whichever model is showing.
  const w: { phase: string; sky: string; season: string; days: string; sentence: string; moon?: string } = isFlat()
    ? describeFlat(date, viewer)
    : describeLight(date, viewer, sunState(date), moonOn ? moonState(date) : undefined);
  els.phase.textContent = w.phase;
  els.sky.textContent = `${w.sky} · ${w.season} · ${w.days}`;
  const place = standing ? `Standing in ${standing.name}` : located ? "Where you are" : "Seen from the Northern Rivers";
  const drift = driftWords();
  els.where.textContent = drift ? `${place} · ${drift.toLowerCase()}` : place;
  const tides = shownLayers.has("tides") && !isFlat() ? tideWords(viewer, moonState(date)) : undefined;
  const moonText = [w.moon, tides].filter(Boolean).join(" · ");
  els.moonline.hidden = !moonText;
  if (moonText) els.moonline.textContent = moonText;
  const story = shownLayers.has(humpbacks.id) ? eventStory(humpbacks, date) : undefined;
  const earth = !isFlat() && (shownLayers.has("magnetic-field") || shownLayers.has("magnetic-poles")) ? compassWords(viewer, date) : undefined;
  const auroraOn = !isFlat() && shownLayers.has("aurora");
  const aurora = auroraOn
    ? auroraMode === "live" && auroraLive
      ? (auroraWords(viewer, auroraLive.points, sunState(date)) ?? "the aurora now, from NOAA's forecast")
      : auroraMode === "unavailable"
        ? "the live aurora forecast is resting; a typical oval shows"
        : "a typical aurora, not tonight's"
    : undefined;
  const flight = shownLayers.has(godwits.id) ? eventStory(godwits, date) : undefined;
  const plankton = !isFlat() && shownLayers.has("plankton") ? planktonWords(viewer, sunState(date)) : undefined;
  const lifeAndEarth = [story, flight, plankton, earth, aurora].filter(Boolean).join(" · ");
  els.eventline.hidden = !lifeAndEarth;
  if (lifeAndEarth) els.eventline.textContent = lifeAndEarth;

  // Screen readers hear a change of light, not every frame of it: while the
  // sun is playing, at most one sentence every six seconds.
  const now = performance.now();
  if (w.sentence !== lastSentence && (!playing || now - lastSpoken > 6000)) {
    lastSentence = w.sentence;
    lastSpoken = now;
    els.words.textContent =
      (drift ? `${drift}. ` : "") +
      w.sentence +
      (tides ? ` ${tides.charAt(0).toUpperCase()}${tides.slice(1)}.` : "") +
      (story ? ` Along the east coast, ${story}.` : "") +
      (flight ? ` Across the Pacific, ${flight}.` : "") +
      (plankton ? ` ${plankton.charAt(0).toUpperCase()}${plankton.slice(1)}, as the model has it.` : "") +
      (earth ? ` ${earth.charAt(0).toUpperCase()}${earth.slice(1)}.` : "") +
      (aurora ? ` ${aurora.charAt(0).toUpperCase()}${aurora.slice(1)}.` : "");
  }
  els.globe.setAttribute("aria-label", `A globe lit by the sun. ${w.sentence}`);
  flatCanvasLabel(`Flat model. ${w.sentence}`);
  els.scrub.setAttribute("aria-valuetext", `${w.phase}, ${w.sky}`);
  els.season.setAttribute("aria-valuetext", `${w.season}, ${w.days}`);
}

// ---------------------------------------------------------------- tracks

let tracksFor = "";
function renderTracks(force = false) {
  const base = new Date(Date.now() + dayShift * DAY);
  // Redraw when the day, the place or the theme moves on, not every frame.
  const key = [Math.round(base.getTime() / (10 * MIN)), viewer.lat, viewer.lng, document.documentElement.dataset.theme, isFlat()].join("|");
  if (!force && key === tracksFor) return;
  tracksFor = key;
  const palette = readPalette();
  const model = isFlat() ? "flat" : "globe";
  els.scrub.style.setProperty("--track", dayTrack(base, viewer, palette, model));
  els.season.style.setProperty("--track", yearTrack(new Date(), viewer, palette, model));
  renderMarks();
}

// ---------------------------------------------------------------- year marks

/**
 * The solstices and equinoxes within the year slider's reach, placed where
 * they fall, named for the viewer's hemisphere. Tapping one goes there.
 */
const MARK_GLYPH: Record<string, string> = {
  // The longest day: a full sun.
  longest: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.6" fill="currentColor"/></svg>',
  // The shortest day: an empty ring.
  shortest: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  // An equinox: half light, half dark.
  equinox:
    '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6 2a4 4 0 0 1 0 8z" fill="currentColor"/></svg>',
};

function renderMarks() {
  const now = Date.now();
  const marks = seasonMarks(new Date(now - 182 * DAY), new Date(now + 182 * DAY));
  els.yearMarks.replaceChildren(
    ...marks.map((m) => {
      const words = seasonMarkWords(m.kind, viewer.lat);
      const kind = words.startsWith("the longest") ? "longest" : words.startsWith("the shortest") ? "shortest" : "equinox";
      const offset = (m.date.getTime() - now) / DAY;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mark";
      b.dataset.kind = kind;
      b.style.setProperty("--at", String((offset + 182) / 364));
      b.innerHTML = MARK_GLYPH[kind];
      b.title = words.charAt(0).toUpperCase() + words.slice(1);
      b.setAttribute("aria-label", `Go to ${words}`);
      b.addEventListener("click", () => {
        // Land on the moment itself: the day, and the hour of the turn.
        const target = m.date.getTime() - now;
        dayShift = Math.round(target / DAY);
        offsetMin = Math.max(-720, Math.min(720, Math.round((target - dayShift * DAY) / MIN)));
        els.season.value = String(dayShift);
        els.scrub.value = String(offsetMin);
        push();
      });
      return b;
    }),
  );
}

// ---------------------------------------------------------------- push

function push() {
  clock?.setTime(isLive() ? null : shown());
  if (isFlat()) {
    flat.draw({
      sun: sunState(shown()),
      viewer,
      lane: shownLayers.has("lane"),
      track: shownLayers.has("sun-track"),
      dayLine: shownLayers.has("day-line"),
    });
  }
  renderWords();
  renderTracks();
  els.now.hidden = isLive();
  els.play.setAttribute("aria-pressed", String(playing));
  els.paceRow.hidden = !playing;
  els.play.setAttribute("aria-label", playing ? `Pause. Playing at ${PACES[pace].say}.` : "Play");
  els.play.querySelector(".btn-label")!.textContent = playing ? "Pause" : "Play";
  els.play.title = playing ? "Hold the sun still" : "Let the sun move";
  const following = isFlat() ? flat.following() : clock?.following() === "sun";
  els.faceSun.setAttribute("aria-pressed", String(following));
}

function flatCanvasLabel(text: string) {
  document.querySelector(".flat")?.setAttribute("aria-label", text);
}

// Live: words and tracks follow the real clock.
setInterval(() => {
  if (!playing) push();
}, 5000);

// Playing: an hour of sky per second, carrying over into the year.
let lastFrame = 0;
function playLoop(t: number) {
  if (!playing) return;
  const dt = lastFrame ? Math.min(100, t - lastFrame) : 16;
  lastFrame = t;
  const p = PACES[pace];
  if (p.daysPerSecond) {
    // Seasons: whole days only, so the sun keeps your hour.
    seasonCarry += (dt / 1000) * p.daysPerSecond;
    const whole = Math.floor(seasonCarry);
    seasonCarry -= whole;
    dayShift += whole;
  } else {
    offsetMin += (dt / 1000) * (p.minutesPerSecond ?? 0);
    // Each full turn past the end of the day slider carries the year on a day.
    while (offsetMin > 720) {
      offsetMin -= 1440;
      dayShift += 1;
    }
  }
  while (dayShift > 182) dayShift -= 365;
  els.season.value = String(dayShift);
  els.scrub.value = String(Math.round(offsetMin));
  push();
  requestAnimationFrame(playLoop);
}

// Dev only: step the play loop by hand (a hidden tab runs no animation frames).
if (import.meta.env.DEV) Object.assign(window, { __playLoop: playLoop });

// ---------------------------------------------------------------- controls

els.scrub.addEventListener("input", () => {
  offsetMin = Number(els.scrub.value);
  push();
});
els.season.addEventListener("input", () => {
  dayShift = Number(els.season.value);
  push();
});

// The pace, named in words for the eye and the ear.
function syncPace() {
  els.paceWord.textContent = PACES[pace].word;
  els.pace.setAttribute("aria-valuetext", PACES[pace].say);
}
els.pace.addEventListener("input", () => {
  pace = Number(els.pace.value);
  seasonCarry = 0;
  syncPace();
  push();
});
syncPace();

els.play.addEventListener("click", () => {
  playing = !playing;
  lastFrame = 0;
  if (playing) requestAnimationFrame(playLoop);
  push();
});

els.now.addEventListener("click", () => {
  playing = false;
  offsetMin = 0;
  dayShift = 0;
  els.scrub.value = "0";
  els.season.value = "0";
  push();
});

els.faceSun.addEventListener("click", () => {
  if (isFlat()) flat.follow(!flat.following());
  else if (clock) clock.follow(clock.following() === "sun" ? null : "sun");
  push();
});
// Turning the disc by hand lets go of the sun, as dragging the globe does.
document.addEventListener("flat:release", () => push());

els.faceMe.addEventListener("click", async () => {
  if (standing) {
    // Come home from wherever you were standing.
    standing = null;
    viewer = home ?? { ...FALLBACK_VIEWER };
    clock?.setViewer(viewer);
    els.pick.hidden = true;
    syncFaceMe();
  } else if (!located) {
    const p = await askPosition();
    if (p) {
      viewer = p;
      home = p;
      located = true;
      clock?.setViewer(viewer);
    }
  }
  clock?.faceMe();
  if (isFlat()) flat.faceMe();
  push();
});

// The flat model: the disc takes the globe's place; the same controls drive it.
els.flatSwitch.addEventListener("change", async () => {
  if (els.flatSwitch.checked) {
    await flat.show();
    els.globe.style.visibility = "hidden";
    els.notice.style.visibility = "hidden";
  } else {
    flat.hide();
    els.globe.style.visibility = "";
    els.notice.style.visibility = "";
  }
  // The moon and tides belong to the globe; their switches rest while the disc shows.
  lenses.setLocked(["moon", "tides", "twilight", "people", "day-light", "night-shade", "hour-rings", "hour-numbers", "magnetic-field", "magnetic-poles", "sea-ice", "aurora", "plankton", "earthquakes", "volcanoes", "fires"], els.flatSwitch.checked);
  frameGlobe();
  renderTracks(true);
  push();
});

let fine = false;
fineInput.addEventListener("change", () => {
  fine = fineInput.checked;
  clock?.setFine(fine);
});

// What the globe shows: each switch toggles one self-contained layer.
els.layers.addEventListener("click", () => {
  const open = els.layersPanel.hidden;
  els.layersPanel.hidden = !open;
  els.layers.setAttribute("aria-expanded", String(open));
  if (open) {
    els.guidePanel.hidden = true;
    els.guide.setAttribute("aria-expanded", "false");
  }
});

// ---------------------------------------------------------------- guide

/** The Guide: every element, grouped as the lenses are, with its swatch and source. */
function renderGuide() {
  const groups = ["light", "life", "earth", "weather", "controls"] as const;
  els.guidePanel.replaceChildren(
    ...groups.flatMap((lens) => {
      const entries = GUIDE.filter((g) => g.lens === lens);
      if (!entries.length) return [];
      const h = document.createElement("h2");
      h.textContent = LENS_TITLES[lens];
      const dl = document.createElement("dl");
      for (const g of entries) {
        const item = document.createElement("div");
        item.className = "guide-item";
        const sw = document.createElement("span");
        sw.className = "swatch";
        sw.setAttribute("aria-hidden", "true");
        if (g.swatch) {
          sw.style.setProperty("--c", g.swatch);
          sw.style.background = g.mark === "glow" ? `radial-gradient(circle, ${g.swatch}, transparent 70%)` : g.swatch;
        }
        if (g.mark) sw.dataset.mark = g.mark;
        if (g.mark === "number") sw.textContent = "3";
        if (!g.swatch && !g.mark) sw.style.visibility = "hidden";
        const dt = document.createElement("dt");
        dt.textContent = g.title;
        const dd = document.createElement("dd");
        dd.textContent = g.body;
        if (g.source) {
          const src = document.createElement("span");
          src.className = "source";
          src.textContent = g.source;
          dd.append(src);
        }
        item.append(sw, dt, dd);
        dl.append(item);
      }
      return [h, dl];
    }),
  );
}
renderGuide();

els.guide.addEventListener("click", () => {
  const open = els.guidePanel.hidden;
  els.guidePanel.hidden = !open;
  els.guide.setAttribute("aria-expanded", String(open));
  if (open) {
    els.layersPanel.hidden = true;
    els.layers.setAttribute("aria-expanded", "false");
  }
});

// ---------------------------------------------------------------- hover

let typicalCache: { key: number; points: Array<[number, number, number]> } | null = null;
function auroraForHover(date: Date) {
  if (auroraMode === "live" && auroraLive) return { live: true, points: auroraLive.points };
  const key = Math.round(date.getTime() / 600000);
  if (typicalCache?.key !== key) typicalCache = { key, points: typicalAurora(date, sunState(date)) };
  return { live: false, points: typicalCache.points };
}

function hideTip() {
  els.tip.hidden = true;
}

/** Fill the pop-up and set it beside the pointer, kept inside the window. */
function placeTip(point: { x: number; y: number }, items: HoverItem[]) {
  if (!items.length) return hideTip();
  els.tip.replaceChildren(
    ...items.map((it) => {
      const p = document.createElement("p");
      const b = document.createElement("strong");
      b.textContent = it.title;
      const span = document.createElement("span");
      span.textContent = it.detail;
      p.append(b, span);
      return p;
    }),
  );
  els.tip.hidden = false;
  const r = els.tip.getBoundingClientRect();
  const x = Math.min(point.x + 16, window.innerWidth - r.width - 8);
  const y = point.y + 16 + r.height > window.innerHeight - 8 ? point.y - r.height - 12 : point.y + 16;
  els.tip.style.left = `${Math.max(8, x)}px`;
  els.tip.style.top = `${Math.max(8, y)}px`;
}

// The Flat model speaks for itself on its own disc.
let flatTapTimer = 0;
flat.onPoint((point, at, tap) => {
  if (!at || !isFlat()) {
    if (!tap) hideTip();
    return;
  }
  const date = shown();
  placeTip(point, flatHoverItems(flat, point, at, sunState(date), viewer, (k) => shownLayers.has(k)));
  if (tap) {
    clearTimeout(flatTapTimer);
    flatTapTimer = window.setTimeout(hideTip, 5000);
  }
});

/** A tapped earthquake, eruption or fire: its words and a link to its official report. */
function showHazardCard(point: { x: number; y: number }): boolean {
  const hz = hazardsFor();
  if (!hz || !map) return false;
  const date = shown();
  const near = <T extends { lng: number; lat: number }>(list: T[]) =>
    list.find((x) => {
      const p = map!.project([x.lng, x.lat]);
      return Math.hypot(p.x - point.x, p.y - point.y) < 12;
    });
  const q = shownLayers.has("earthquakes") ? near(quakesAt(hz.quakes, date)) : undefined;
  const v = shownLayers.has("volcanoes") ? near(volcanoesAt(hz.volcanoes, date)) : undefined;
  const f = shownLayers.has("fires") ? near(firesAt(hz.fires, date)) : undefined;
  const hit = q
    ? { title: "Major earthquake", words: quakeWords(q), url: q.url, source: "USGS" }
    : v
      ? { title: "Erupting volcano", words: volcanoWords(v), url: v.url, source: "GDACS" }
      : f
        ? { title: "Major wildfire", words: fireWords(f), url: f.url, source: "GDACS" }
        : null;
  if (!hit) return false;
  els.pick.hidden = false;
  els.pick.replaceChildren();
  const name = document.createElement("strong");
  name.textContent = hit.title;
  const words = document.createElement("span");
  words.textContent = hit.words.charAt(0).toUpperCase() + hit.words.slice(1) + ".";
  const a = document.createElement("a");
  a.href = hit.url;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = `The ${hit.source} report`;
  els.pick.append(name, words, document.createElement("br"), a);
  return true;
}

// ---------------------------------------------------------------- standing somewhere

const coarse = (x: number) => Math.round(x * 10) / 10;

function syncFaceMe() {
  const label = els.faceMe.querySelector(".btn-label");
  if (label) label.textContent = standing ? "Back to me" : "Face me";
  els.faceMe.title = standing ? "Come back to where you are" : "Come back to where you are";
}

function cardButton(text: string, onClick: () => void, quiet = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  if (quiet) b.className = "quiet";
  b.addEventListener("click", onClick);
  return b;
}

/** A tapped place: its name and light, and the choice to stand there. */
async function showPlaceCard(lngLat: { lng: number; lat: number }) {
  const at = { lng: coarse(lngLat.lng), lat: coarse(lngLat.lat) };
  const seq = ++placeSeq;
  els.pick.hidden = false;
  els.pick.replaceChildren();
  const name = document.createElement("strong");
  name.textContent = "This place";
  const light = document.createElement("span");
  const w = isFlat() ? null : describeLight(shown(), at);
  light.textContent = w ? `${w.phase.charAt(0).toUpperCase()}${w.phase.slice(1)} here.` : "";
  const actions = document.createElement("div");
  actions.className = "place-actions";
  actions.append(
    cardButton("Stand here", () => void standAt(at, name.textContent ?? "here")),
    cardButton("Close", () => (els.pick.hidden = true), true),
  );
  const weather = document.createElement("span");
  weather.className = "weather";
  els.pick.append(name, light, weather, actions);
  if (weatherOn()) {
    void weatherAt(at).then((words) => {
      if (seq === placeSeq && words) weather.textContent = ` ${words}`;
    });
  }
  const n = await placeName(at, TOKEN);
  if (seq === placeSeq) name.textContent = n.charAt(0).toUpperCase() + n.slice(1);
}
let placeSeq = 0;

/** Stand somewhere else: the face, the lines and the tracks all speak for it. */
async function standAt(at: LngLat, name: string) {
  standing = { at, name: name === "This place" ? await placeName(at, TOKEN) : name };
  viewer = at;
  clock?.setViewer(viewer);
  syncFaceMe();
  push();
  showHereCard();
}

let hereSeq = 0;

/** Everything happening on the ground where the viewer stands. */
function showHereCard() {
  if (!map) return;
  const date = shown();
  const w = describeLight(date, viewer, sunState(date), shownLayers.has("moon") ? moonState(date) : undefined);
  const items = hoverItems({
    map,
    point: map.project([viewer.lng, viewer.lat]),
    at: viewer,
    date,
    sun: sunState(date),
    moon: moonState(date),
    viewer,
    shows: (k) => shownLayers.has(k),
    events: [humpbacks, godwits],
    aurora: auroraForHover(date),
    limit: 20,
  }).filter((it) => !["day-line", "sun-track", "lane"].includes(it.key));
  els.pick.hidden = false;
  els.pick.replaceChildren();
  const close = cardButton("×", () => (els.pick.hidden = true), true);
  close.className = "quiet close";
  close.setAttribute("aria-label", "Close");
  const title = document.createElement("strong");
  title.textContent = standing ? `Here · ${standing.name}` : "Here";
  const list = document.createElement("ul");
  list.className = "here-list";
  const line = (head: string, text: string) => {
    const li = document.createElement("li");
    const b = document.createElement("b");
    b.textContent = head;
    li.append(b, text);
    list.append(li);
    return li;
  };
  line("The light", `${w.phase.charAt(0).toUpperCase()}${w.phase.slice(1)}. ${w.sky.charAt(0).toUpperCase()}${w.sky.slice(1)}.`);
  if (weatherOn()) {
    const li = line("The weather now", "…");
    const seq = ++hereSeq;
    void weatherAt(viewer).then((words) => {
      if (seq !== hereSeq) return;
      if (words) li.lastChild!.textContent = words;
      else li.remove();
    });
  }
  line("The season", `${w.season.charAt(0).toUpperCase()}${w.season.slice(1)}, and ${w.days}.`);
  if (w.moon) line("The moon", `${w.moon.charAt(0).toUpperCase()}${w.moon.slice(1)}.`);
  for (const it of items) if (!["day-light", "night-shade", "moon"].includes(it.key)) line(it.title, it.detail);
  const actions = document.createElement("div");
  actions.className = "place-actions";
  if (standing) actions.append(cardButton("Back to me", () => els.faceMe.click()));
  els.pick.append(close, title, list, actions);
}

/** Say what is under the pointer, beside it. */
function showTip(point: { x: number; y: number }, lngLat: { lng: number; lat: number }) {
  if (!map || isFlat()) return hideTip();
  const date = shown();
  const items = hoverItems({
    map,
    point,
    at: { lng: lngLat.lng, lat: lngLat.lat },
    date,
    sun: sunState(date),
    moon: moonState(date),
    viewer,
    shows: (k) => shownLayers.has(k),
    events: [humpbacks, godwits],
    aurora: auroraForHover(date),
  });
  placeTip(point, items);
}

// A person or node, when their dot is hovered or tapped.
function showPick(p: PresencePick | null) {
  if (!p) {
    els.pick.hidden = true;
    return;
  }
  els.pick.hidden = false;
  els.pick.replaceChildren();
  const name = document.createElement("strong");
  name.textContent = p.name;
  const light = document.createElement("span");
  light.textContent = p.placeName ? `${p.phase} in ${p.placeName}` : p.phase;
  els.pick.append(name, light);
  if (p.href) {
    const a = document.createElement("a");
    a.href = p.href;
    a.textContent = "Visit on the Landscape";
    els.pick.append(document.createElement("br"), a);
  }
}

// Theme: the same key and attribute as SeedTree V2.
function syncThemeButton() {
  const night = document.documentElement.dataset.theme === "night";
  els.theme.querySelector(".btn-label")!.textContent = night ? "Morning" : "Night";
  els.theme.title = night ? "Cross into morning" : "Cross into night";
}
els.theme.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "night" ? "morning" : "night";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("seedtree-theme", next);
  } catch {
    /* private mode */
  }
  syncThemeButton();
  renderTracks(true);
  setFog();
  flat.refreshPalette();
});
syncThemeButton();

// ---------------------------------------------------------------- globe

let map: mapboxgl.Map | null = null;

function setFog() {
  if (!map) return;
  const css = getComputedStyle(document.documentElement);
  const bg = css.getPropertyValue("--bg").trim();
  const night = document.documentElement.dataset.theme === "night";
  map.setFog({
    color: night ? "#1b2a22" : "#f7efdc",
    "high-color": night ? "#0b1320" : "#e9dcc0",
    "space-color": bg,
    "horizon-blend": 0.05,
    "star-intensity": night ? 0.3 : 0,
  });
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

function notice(text: string) {
  els.notice.hidden = false;
  els.notice.innerHTML = `<p></p>`;
  els.notice.querySelector("p")!.textContent = text;
}

/**
 * Frame the globe in the open space between the words and the dock, and size
 * it to fit, so on a phone the dock never hides half the Earth. Once a person
 * zooms, the zoom is theirs; the padding still follows the layout.
 */
let userZoomed = false;

function frameGlobe() {
  const dock = document.querySelector<HTMLElement>(".dock")!.getBoundingClientRect();
  const face = document.querySelector<HTMLElement>(".face")!.getBoundingClientRect();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const narrow = w < 720;
  // A hidden dock or face measures zero; it then takes no room.
  const top = narrow && face.height ? Math.max(0, face.bottom - 24) : 0;
  const dockH = dock.height ? h - dock.top : 0;
  const bottom = dockH ? dockH + 12 : 0;
  document.documentElement.style.setProperty("--dock-h", `${Math.round(dockH)}px`);
  const padding = { top, bottom, left: 0, right: 0 };
  flat.setPadding({ top, bottom });
  if (!map) return { padding, zoom: 1.6 };
  // Globe radius in pixels is worldSize / 2π, with worldSize = 512 · 2^zoom.
  const room = Math.max(160, Math.min(w, h - top - bottom));
  const zoom = Math.max(0.2, Math.log2((0.4 * room * 2 * Math.PI) / 512));
  map.setPadding(padding);
  if (!userZoomed && Number.isFinite(zoom)) map.setZoom(zoom);
  return { padding, zoom };
}

function buildGlobe() {
  if (!TOKEN) {
    notice("The globe is resting until it has a Mapbox token · the words above still follow the light.");
    return;
  }
  if (!webglAvailable()) {
    notice("This screen cannot draw the globe · the words above still follow the light.");
    return;
  }
  mapboxgl.accessToken = TOKEN;
  try {
    map = new mapboxgl.Map({
      container: els.globe,
      style: STYLE,
      projection: "globe",
      center: [viewer.lng, viewer.lat],
      zoom: 1.2,
      attributionControl: true,
      // Always-visible credit for the event data, beside Mapbox's own.
      customAttribution: `Humpback sightings: <a href="https://www.ala.org.au" target="_blank" rel="noopener">Atlas of Living Australia</a>, <a href="https://www.gbif.org" target="_blank" rel="noopener">GBIF.org</a> and contributing datasets (<a href="${humpbacks.sourcesUrl}" target="_blank" rel="noopener">sources</a>)`,
    });
  } catch (err) {
    console.warn("[now-on-earth] globe could not start", err);
    notice("This screen cannot draw the globe · the words above still follow the light.");
    return;
  }
  map.getCanvas().setAttribute("aria-hidden", "true");
  // Hover (or tap, on a touch screen) to hear what is under the pointer.
  let pending = 0;
  map.on("mousemove", (e) => {
    if (pending) cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => showTip(e.point, e.lngLat));
  });
  // A tap shows it for a few seconds; there is no pointer to move away.
  let tapTimer = 0;
  map.on("click", (e) => {
    if (!showHazardCard(e.point)) void showPlaceCard(e.lngLat);
    showTip(e.point, e.lngLat);
    clearTimeout(tapTimer);
    tapTimer = window.setTimeout(hideTip, 5000);
  });
  map.on("mouseout", hideTip);
  map.on("dragstart", hideTip);
  map.on("zoomstart", hideTip);
  map.on("style.load", setFog);
  map.on("zoomstart", (e) => {
    if ((e as { originalEvent?: Event }).originalEvent) userZoomed = true;
  });
  frameGlobe();
  // Attach at once: the clock waits for the style itself, so the light arrives
  // with the style rather than after every imagery tile has loaded.
  clock = attachNowOnEarth(map, {
    viewer,
    fine,
    people: MOCK_PEOPLE,
    events: [humpbacks, godwits],
    hidden: lenses.offKeys(),
    lenses: lenses.lensStates(),
    onPick: showPick,
    hazards: { url: "/api/hazards" },
    aurora: {
      url: "/api/aurora",
      onStatus: (st) => {
        auroraMode = st.mode;
        auroraLive = st.mode === "live" && st.points ? { points: st.points } : null;
        push();
      },
    },
  });
  // Dev only: a handle for poking at the globe from the console.
  if (import.meta.env.DEV) Object.assign(window, { __noe: { map, clock } });
  clock.subscribe(() => {
    const following = clock?.following() === "sun";
    if (els.faceSun.getAttribute("aria-pressed") !== String(following)) {
      els.faceSun.setAttribute("aria-pressed", String(following));
    }
  });
  push();
  // Re-frame when the window or the dock changes size (the dock grows a row
  // on a phone when the Now button appears).
  const ro = new ResizeObserver(() => {
    map?.resize();
    frameGlobe();
  });
  ro.observe(els.globe);
  ro.observe(document.querySelector<HTMLElement>(".dock")!);
}

// ---------------------------------------------------------------- start

buildGlobe();
frameGlobe();
window.addEventListener("resize", () => frameGlobe());
push();
quietPosition().then((p) => {
  if (!p) return;
  home = p;
  located = true;
  if (standing) return; // stay where they chose to stand
  viewer = p;
  clock?.setViewer(viewer);
  map?.easeTo({ center: [viewer.lng, viewer.lat], duration: 1200 });
  push();
});
