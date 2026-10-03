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
  moonQuality,
  WHEEL_TRADITION,
  wheelAt,
  DEEP_MOMENTS,
  deepPosition,
  deepWords,
  deepYears,
  greatYearWords,
  chineseYear,
  solarTerm,
  zodiacAt,
  lookUp,
  ZODIAC_TRADITION,
  CHINESE_TRADITION,
  seaWords,
  type GroundNote,
  groundNoteCredit,
  groundNoteWords,
  kindInfo,
  notesNear,
  eventStory,
  auroraWords,
  compassWords,
  firesAt,
  fireWords,
  quakesAt,
  quakeWords,
  volcanoesAt,
  volcanoWords,
  moonState,
  seasonMarkWords,
  typicalAurora,
  seasonMarks,
  sunState,
  tideWords,
} from "now-on-earth/core";
import humpbacksJson from "now-on-earth/events/humpback-whales.json";
import godwitsJson from "now-on-earth/events/bar-tailed-godwits.json";
import { GIBS_ACKNOWLEDGEMENT, PRESENT_ONLY, type NowOnEarth, type PresencePick, attachNowOnEarth, hazardsFor, readPalette } from "now-on-earth/mapbox";
import { createLensPanel } from "./lens-panel";
import { GUIDE, LENS_TITLES } from "./guide";
import { type HoverItem, hoverItems } from "./hover";
import { flatHoverItems } from "./flat/hover";
import { placeName } from "./place-name";
import { WEATHER_CREDIT, weatherAt } from "./weather";
import { browserNoteStore } from "./ground-notes-store";
import { showNoteForm } from "./note-form";
import { createMetronome } from "./metronome";
import { renderHearts } from "./hearts";
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
  deep: $<HTMLInputElement>("deep"),
  deepMarks: $("deep-marks"),
  deepline: $("deepline"),
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
  hearts: $("hearts"),
  theme: $<HTMLButtonElement>("theme"),
};

// ---------------------------------------------------------------- state

/** How far to look: one slider at a time. */
type Scale = "day" | "year" | "deep";
let scale: Scale = "day";
/** Deep time, as a position on its scale (0..1000); 0 is now. The light stays live. */
let deepAt = 0;
const deepNow = () => deepYears(deepAt / 1000);
let offsetMin = 0; // time scrub, -720 .. 720
let dayShift = 0; // season, -182 .. 182
let playing = false;
let viewer: LngLat = { ...FALLBACK_VIEWER };
let located = false;
/** Where the viewer really is (once known); standing elsewhere does not change it. */
let home: LngLat | null = null;
/** Ground notes: what people noticed where they are (on this site, this browser's own). */
let notes: GroundNote[] = [];
void browserNoteStore.list().then((n) => {
  notes = n;
  clock?.setGroundNotes(notes);
});
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
    { key: "wheel-marks", label: "The wheel of the year", note: "(the Celtic/European wheel, both hemispheres' names)", built: true, on: true },
    { key: "look-up", label: "Look up", note: "(meteor showers, eclipses, the planets meeting: only when near, only if seen from here)", built: true, on: true, after: credit("Eclipse Predictions by Fred Espenak, NASA's GSFC. Planets: JPL's approximate planetary positions. Meteor showers: the major annual showers, as observers record them.") },
    { key: "zodiac", label: "The Western zodiac", note: "(the sun's sign: a tradition of astrology, not a forecast)", built: true, on: false },
    { key: "chinese-calendar", label: "The Chinese calendar", note: "(the year's animal and element, and the solar term)", built: true, on: false },
    {
      key: "wheel-local",
      label: "Local seasonal knowledge, from its custodians",
      note: "· to come, in partnership",
      built: false,
      on: false,
    },
    { key: "people", label: "People and nodes", note: "(sample)", built: true, on: false },
    {
      key: "partnered-knowledge",
      label: "Seasonal knowledge, shared in partnership",
      note: "· to come, with permission",
      built: false,
      on: false,
    },
    { key: "notes-life", label: "Life noticed on the ground", note: "(flowering, cicadas, birds: shared by people where they are)", built: true, on: true },
    { key: "ancient-coasts", label: "Ancient coastlines", note: "(in deep time: the seabed that was land)", built: true, on: true, after: credit("Seabed: GEBCO_2025 Grid (GEBCO Compilation Group, 2025). Sea level: Spratt & Lisiecki (2016), Climate of the Past, via NOAA NCEI. A global sea level on today's seabed: coasts that have since risen or sunk are not adjusted.") },
    { key: "magnetic-field", label: "The magnetic field", note: "(the Earth's own, from the World Magnetic Model)", built: true, on: true },
    { key: "magnetic-poles", label: "Magnetic north's wandering", note: "(since 1925)", built: true, on: true, after: magCredit },
    { key: "earthquakes", label: "Major earthquakes", note: "(live, the past month)", built: true, on: true, after: quakeCredit },
    { key: "volcanoes", label: "Erupting volcanoes", note: "(live, the past year)", built: true, on: true, after: volcanoCredit },
    { key: "fires", label: "Major wildfires", note: "(live, while they burn)", built: true, on: true, after: fireCredit },
    { key: "aurora", label: "The aurora", note: "(live near now, typical otherwise)", built: true, on: true, after: auroraCredit },
    { key: "notes-weather", label: "Weather noticed on the ground", note: "(frost, rain, snow: shared by people where they are)", built: true, on: true },
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
/** A wide screen: information down the left, controls down the right. */
const WIDE = window.matchMedia("(min-width: 900px)");
// ---------------------------------------------------------------- Hearts Now

/** Outward (the whole planet) or inward (your place in it). */
let hearts = false;
/** Where the camera was, to return to it. */
let beforeHearts: { center: [number, number]; zoom: number } | null = null;
let heartsTimer = 0;
const stillness = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function heartsPlace(): string {
  return standing ? `Seen from ${standing.name}` : located ? "Where you are" : "Seen from the Northern Rivers";
}

function setMode(next: boolean) {
  if (next === hearts) return;
  hearts = next;
  for (const b of document.querySelectorAll<HTMLButtonElement>(".mode button")) b.setAttribute("aria-checked", String((b.dataset.mode === "hearts") === hearts));
  document.body.classList.toggle("hearts-mode", hearts);
  els.hearts.hidden = !hearts;
  if (hearts) {
    // The moment is now, wherever the sliders were.
    playing = false;
    offsetMin = 0;
    dayShift = 0;
    els.scrub.value = "0";
    els.season.value = "0";
    setDeep(0);
    els.pick.hidden = true;
    els.layersPanel.hidden = true;
    els.guidePanel.hidden = true;
    els.layers.setAttribute("aria-expanded", "false");
    els.guide.setAttribute("aria-expanded", "false");
    hideTip();
    clock?.follow(null);
    drawHearts();
    frameGlobe();
    if (map) {
      const c = map.getCenter();
      beforeHearts = { center: [c.lng, c.lat], zoom: map.getZoom() };
      map.easeTo({ center: [viewer.lng, viewer.lat], zoom: Math.max(map.getZoom(), 3.2), duration: stillness() ? 0 : 2200, essential: true });
    }
    // The light and moon change slowly; a quiet refresh is enough.
    heartsTimer = window.setInterval(drawHearts, 10 * 60 * 1000);
  } else {
    clearInterval(heartsTimer);
    frameGlobe();
    if (map && beforeHearts) map.easeTo({ center: beforeHearts.center, zoom: beforeHearts.zoom, duration: stillness() ? 0 : 1600, essential: true });
    beforeHearts = null;
  }
  push();
}

function drawHearts() {
  if (!hearts) return;
  renderHearts(els.hearts, { at: viewer, place: heartsPlace(), onBack: () => setMode(false) });
}

for (const b of document.querySelectorAll<HTMLButtonElement>(".mode button")) {
  b.addEventListener("click", () => setMode(b.dataset.mode === "hearts"));
  b.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    setMode(!hearts);
    document.querySelector<HTMLButtonElement>(`.mode button[data-mode="${hearts ? "hearts" : "earth"}"]`)?.focus();
  });
}

/** The human field's metronome. No source is connected yet: it rests. */
const metronome = createMetronome($("metronome"));
metronome.connect(null);
const presentOnly = (key: string) => PRESENT_ONLY.includes(key) || key === humpbacks.id || key === godwits.id;
const shownLayers = { has: (key: string) => lenses.isShown(key) && !(deepAt > 0 && presentOnly(key)) };
/** The weather draws nothing on the globe, so it speaks in the cards whenever its own switch is on. */
const weatherOn = () => !lenses.offKeys().includes("weather-here");
/** Notes are words in the cards too: they follow their own switch there, lens open or not. */
const notesOn = (group: "weather" | "life") => deepAt === 0 && !lenses.offKeys().includes(group === "weather" ? "notes-weather" : "notes-life");


const shown = () => new Date(Date.now() + dayShift * DAY + offsetMin * MIN);
const isLive = () => !playing && offsetMin === 0 && dayShift === 0 && deepAt === 0;

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

/** The sky's invitation changes by the hour, not the frame: remember it per hour and place. */
let lookMemo = { key: "", words: undefined as string | undefined };
function lookUpNow(date: Date): string | undefined {
  const key = `${Math.floor(date.getTime() / 3_600_000)}|${viewer.lat.toFixed(1)}|${viewer.lng.toFixed(1)}`;
  if (key !== lookMemo.key) lookMemo = { key, words: lookUp(date, viewer)[0]?.words };
  return lookMemo.words;
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
  const deep = deepAt > 0 ? deepWords(deepNow()) : null;
  els.deepline.hidden = !deep;
  if (deep) {
    els.deepline.textContent = deep.moment ? `${deep.moment.name} · ${deep.years}. ${deep.moment.about}` : `${deep.when.charAt(0).toUpperCase()}${deep.when.slice(1)} · ${deep.years}.`;
    // The sky's great year: the turn of the axis and the pole star then.
    // Between the named moments (which carry their own sky).
    const sky = deep.moment ? "" : greatYearWords(deepNow());
    if (sky) els.deepline.textContent += ` ${sky}`;
    // The sea, when the coastlines are showing.
    const sea = shownLayers.has("ancient-coasts") ? seaWords(deepNow()) : null;
    if (sea) els.deepline.textContent += ` ${sea}`;
  }
  const deepSaid = deep ? ` In deep time, ${deep.moment ? deep.moment.name : deep.when}, ${deep.years}; the sun and sky as now.` : "";
  const tides = shownLayers.has("tides") && !isFlat() ? tideWords(viewer, moonState(date)) : undefined;
  const quality = moonOn && !isFlat() ? moonQuality(moonState(date)).words : undefined;
  const moonText = [w.moon, quality, tides].filter(Boolean).join(" · ");
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
  const wheel = !isFlat() && shownLayers.has("wheel-marks") ? `${wheelAt(date, viewer.lat).words}, on ${WHEEL_TRADITION}` : undefined;
  const zodiac = !isFlat() && shownLayers.has("zodiac") ? `${zodiacAt(date).words}, on ${ZODIAC_TRADITION}` : undefined;
  const chinese = !isFlat() && shownLayers.has("chinese-calendar") ? `${chineseYear(date).words}, ${solarTerm(date).words}, on ${CHINESE_TRADITION}` : undefined;
  const look = !isFlat() && deepAt === 0 && shownLayers.has("look-up") ? lookUpNow(date) : undefined;
  const lifeAndEarth = [wheel, look, zodiac, chinese, story, flight, earth, aurora].filter(Boolean).join(" · ");
  els.eventline.hidden = !lifeAndEarth;
  if (lifeAndEarth) els.eventline.textContent = lifeAndEarth;

  // Screen readers hear a change of light, not every frame of it: while the
  // sun is playing, at most one sentence every six seconds.
  const now = performance.now();
  if (w.sentence + deepSaid !== lastSentence && (!playing || now - lastSpoken > 6000)) {
    lastSentence = w.sentence + deepSaid;
    lastSpoken = now;
    els.words.textContent =
      (drift ? `${drift}. ` : "") +
      w.sentence +
      deepSaid +
      (quality ? ` ${quality.charAt(0).toUpperCase()}${quality.slice(1)}.` : "") +
      (wheel ? ` ${wheel.charAt(0).toUpperCase()}${wheel.slice(1)}.` : "") +
      (look ? ` ${look}` : "") +
      (zodiac ? ` ${zodiac.charAt(0).toUpperCase()}${zodiac.slice(1)}.` : "") +
      (chinese ? ` ${chinese.charAt(0).toUpperCase()}${chinese.slice(1)}.` : "") +
      (tides ? ` ${tides.charAt(0).toUpperCase()}${tides.slice(1)}.` : "") +
      (story ? ` Along the east coast, ${story}.` : "") +
      (flight ? ` Across the Pacific, ${flight}.` : "") +
      (earth ? ` ${earth.charAt(0).toUpperCase()}${earth.slice(1)}.` : "") +
      (aurora ? ` ${aurora.charAt(0).toUpperCase()}${aurora.slice(1)}.` : "");
  }
  els.globe.setAttribute("aria-label", `A globe lit by the sun. ${w.sentence}`);
  flatCanvasLabel(`Flat model. ${w.sentence}`);
  els.scrub.setAttribute("aria-valuetext", `${w.phase}, ${w.sky}`);
  els.season.setAttribute("aria-valuetext", `${w.season}, ${w.days}`);
  const dw = deepWords(deepNow());
  els.deep.setAttribute("aria-valuetext", deepAt ? `${dw.moment ? dw.moment.name : dw.when}, ${dw.years}` : "now");
  for (const b of els.deepMarks.querySelectorAll<HTMLElement>(".deep-mark")) b.classList.toggle("is-here", b.dataset.id === (dw.moment?.id ?? ""));
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
els.deep.addEventListener("input", () => {
  setDeep(Number(els.deep.value));
});

/** Earth's body was opened by going deep, so it closes again on the way back. */
let openedEarthForDeep = false;

/** Go to a depth in deep time: the Earth's layers follow; the light stays live. */
function setDeep(at: number) {
  const was = deepAt > 0;
  deepAt = Math.max(0, Math.min(1000, Math.round(at)));
  els.deep.value = String(deepAt);
  clock?.setDeepTime(deepNow());
  if (!was && deepAt > 0 && !lenses.lensStates().earth) {
    lenses.openLens("earth");
    openedEarthForDeep = true;
  }
  if (was && deepAt === 0 && openedEarthForDeep) {
    lenses.closeLens("earth");
    openedEarthForDeep = false;
  }
  if (was !== deepAt > 0) syncLocks();
  push();
}

/** Switches that rest: the globe's own while the flat model shows; the present's own in deep time. */
const FLAT_LOCKED = ["ancient-coasts", "wheel-marks", "moon", "tides", "twilight", "people", "day-light", "night-shade", "hour-rings", "hour-numbers", "magnetic-field", "magnetic-poles", "sea-ice", "aurora", "earthquakes", "volcanoes", "fires"];
function syncLocks() {
  const deepLocked = [...PRESENT_ONLY, humpbacks.id, godwits.id];
  lenses.setLocked([...new Set([...FLAT_LOCKED, ...deepLocked])], false);
  if (els.flatSwitch.checked) lenses.setLocked(FLAT_LOCKED, true);
  if (deepAt > 0) lenses.setLocked(deepLocked, true);
}

/** Show one scale's slider: the day, the year or deep time. */
function setScale(next: Scale) {
  scale = next;
  for (const b of document.querySelectorAll<HTMLButtonElement>(".depth button")) b.setAttribute("aria-checked", String(b.dataset.scale === next));
  for (const el of document.querySelectorAll<HTMLElement>(".sliders [data-scale]")) el.hidden = el.dataset.scale !== next;
}
for (const b of document.querySelectorAll<HTMLButtonElement>(".depth button")) {
  b.addEventListener("click", () => setScale(b.dataset.scale as Scale));
  // Arrow keys move between the three, as a radio group should.
  b.addEventListener("keydown", (e) => {
    const order: Scale[] = ["day", "year", "deep"];
    const i = order.indexOf(b.dataset.scale as Scale);
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = order[(i + step + 3) % 3];
    setScale(next);
    document.querySelector<HTMLButtonElement>(`.depth button[data-scale="${next}"]`)?.focus();
  });
}

/** The named moments along deep time: labelled ones in two rows, the rest quiet ticks named on hover. */
function renderDeepMarks() {
  let row = 0;
  els.deepMarks.replaceChildren(
    ...DEEP_MOMENTS.map((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = m.labelled ? "deep-mark" : "deep-mark is-quiet";
      b.dataset.id = m.id;
      const at = deepPosition(m.yearsAgo);
      b.style.setProperty("--at", String(at));
      if (at === 0) b.dataset.edge = "start";
      if (at > 0.93) b.dataset.edge = "end";
      if (m.labelled) {
        b.textContent = m.label;
        b.dataset.row = String(row++ % 2);
      }
      b.title = m.label;
      b.setAttribute("aria-label", m.yearsAgo ? `Go to ${m.name}, ${deepWords(m.yearsAgo).years}` : "Back to now");
      b.addEventListener("click", () => setDeep(Math.round(at * 1000)));
      return b;
    }),
  );
}
renderDeepMarks();

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
  setDeep(0);
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
  syncLocks();
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
  // On a phone they share the space over the dock; side by side on a wide screen.
  if (open && !WIDE.matches) {
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
  if (open && !WIDE.matches) els.pick.hidden = true;
  els.guide.setAttribute("aria-expanded", String(open));
  if (open && !WIDE.matches) {
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
    cardButton("Add what you notice", () => openNoteForm(at, name.textContent ?? "This place"), true),
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
    notes,
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
  if (w.moon) line("The moon", `${w.moon.charAt(0).toUpperCase()}${w.moon.slice(1)}. ${moonQuality(moonState(date)).words.charAt(0).toUpperCase()}${moonQuality(moonState(date)).words.slice(1)}.`);
  for (const it of items) if (!["day-light", "night-shade", "moon", "notes-weather", "notes-life"].includes(it.key)) line(it.title, it.detail);
  // What people nearby have noticed lately.
  const near = notesNear(notes, viewer, date).filter((n) => notesOn(kindInfo(n.kind).group));
  for (const n of near.slice(0, 5)) {
    const li = line("Noticed nearby", groundNoteWords(n, date));
    const cr = document.createElement("small");
    cr.className = "note-credit";
    cr.textContent = groundNoteCredit(n);
    li.append(cr);
  }
  const actions = document.createElement("div");
  actions.className = "place-actions";
  actions.append(cardButton("Add what you notice", () => openNoteForm(viewer, standing?.name ?? "where you are", true)));
  if (standing) actions.append(cardButton("Back to me", () => els.faceMe.click(), true));
  els.pick.append(close, title, list, actions);
}

/** The ground-note form, in the card, for a chosen place. */
function openNoteForm(at: LngLat, placeLabel: string, fromHere = false) {
  showNoteForm(els.pick, {
    at,
    placeLabel,
    day: shown(),
    store: browserNoteStore,
    onSaved: (note) => {
      notes = [...notes.filter((n) => n.id !== note.id), note];
      clock?.setGroundNotes(notes);
      // Show it where it now sits: open its lens if it was closed.
      lenses.openLens(kindInfo(note.kind).group === "weather" ? "weather" : "life");
      push();
    },
    onDone: () => (fromHere ? showHereCard() : (els.pick.hidden = true)),
  });
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
    notes,
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
 * it to fit. On a wide screen that is the space between the information rail
 * (left) and the controls (right); on a phone, between the words above and
 * the dock below, so the dock never hides half the Earth. Once a person
 * zooms, the zoom is theirs; the padding still follows the layout.
 */
let userZoomed = false;

function frameGlobe() {
  const dock = document.querySelector<HTMLElement>(".dock")!.getBoundingClientRect();
  const face = document.querySelector<HTMLElement>(".face")!.getBoundingClientRect();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const narrow = w < 720;
  const wide = WIDE.matches;
  const info = document.querySelector<HTMLElement>(".info")!.getBoundingClientRect();
  // A hidden dock or face measures zero; it then takes no room.
  const top = !wide && narrow && face.height ? Math.max(0, face.bottom - 24) : 0;
  const dockH = !wide && dock.height ? h - dock.top : 0;
  // In Hearts Now on a phone, the card takes the lower space: frame the globe above it.
  const card = hearts && !wide ? els.hearts.getBoundingClientRect() : null;
  const bottom = card && card.height ? h - card.top + 12 : dockH ? dockH + 12 : 0;
  const left = wide && info.width ? info.right : 0;
  const right = wide && dock.width ? w - dock.left : 0;
  document.documentElement.style.setProperty("--dock-h", `${Math.round(dockH)}px`);
  const padding = { top, bottom, left, right };
  flat.setPadding({ top, bottom, left, right });
  if (!map) return { padding, zoom: 1.6 };
  // Globe radius in pixels is worldSize / 2π, with worldSize = 512 · 2^zoom.
  const room = Math.max(160, Math.min(w - left - right, h - top - bottom));
  const zoom = Math.max(0.2, Math.log2((0.4 * room * 2 * Math.PI) / 512));
  map.setPadding(padding);
  // In Hearts Now the camera has settled on a place; the layout leaves its zoom alone.
  if (!userZoomed && !hearts && Number.isFinite(zoom)) map.setZoom(zoom);
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
    notes,
    deep: deepNow(),
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
  if (import.meta.env.DEV) Object.assign(window, { __noe: { map, clock, metronome } });
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
WIDE.addEventListener("change", () => frameGlobe());
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
