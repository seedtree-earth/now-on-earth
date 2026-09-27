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
  moonState,
  seasonMarkWords,
  seasonMarks,
  sunState,
  tideWords,
} from "now-on-earth/core";
import humpbacksJson from "now-on-earth/events/humpback-whales.json";
import { DEFAULT_HIDDEN, type NowOnEarth, type PresencePick, attachNowOnEarth, readPalette } from "now-on-earth/mapbox";
import { MOCK_PEOPLE } from "./mock-people";

/** Static, built at build time by scripts/ecology/humpbacks.mjs. Never fetched live. */
const humpbacks = humpbacksJson as unknown as SeasonalEvent;
import { askPosition, quietPosition } from "./location";
import { dayTrack, yearTrack } from "./tracks";

const TOKEN: string | undefined = import.meta.env.VITE_MAPBOX_TOKEN;
const STYLE = "mapbox://styles/mapbox/satellite-streets-v12"; // the Landscape's own style

const MIN = 60000;
const DAY = 86400000;
/** Playing, the sun crosses an hour of sky every second: a day in 24 seconds. */
const PLAY_MINUTES_PER_SECOND = 60;

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
  now: $<HTMLButtonElement>("now"),
  faceSun: $<HTMLButtonElement>("face-sun"),
  faceMe: $<HTMLButtonElement>("face-me"),
  fine: $<HTMLInputElement>("fine"),
  layers: $<HTMLButtonElement>("layers"),
  layersPanel: $("layers-panel"),
  moonline: $("moonline"),
  yearMarks: $("year-marks"),
  eventline: $("eventline"),
  eventCredit: $("event-credit"),
  pick: $("pick"),
  theme: $<HTMLButtonElement>("theme"),
};

// ---------------------------------------------------------------- state

let offsetMin = 0; // time scrub, -720 .. 720
let dayShift = 0; // season, -182 .. 182
let playing = false;
let viewer: LngLat = { ...FALLBACK_VIEWER };
let located = false;
let clock: NowOnEarth | null = null;
/** Which layers are on, mirrored here so the words work even without a globe. */
const shownLayers = new Set(
  ["rings", "twilight", "seasons", "moon", "sun", humpbacks.id].filter((k) => !DEFAULT_HIDDEN.includes(k)),
);

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
  const w = describeLight(date, viewer, sunState(date), moonOn ? moonState(date) : undefined);
  els.phase.textContent = w.phase;
  els.sky.textContent = `${w.sky} · ${w.season} · ${w.days}`;
  const place = located ? "Where you are" : "Seen from the Northern Rivers";
  const drift = driftWords();
  els.where.textContent = drift ? `${place} · ${drift.toLowerCase()}` : place;
  const tides = shownLayers.has("tides") ? tideWords(viewer, moonState(date)) : undefined;
  const moonText = [w.moon, tides].filter(Boolean).join(" · ");
  els.moonline.hidden = !moonText;
  if (moonText) els.moonline.textContent = moonText;
  const story = shownLayers.has(humpbacks.id) ? eventStory(humpbacks, date) : undefined;
  els.eventline.hidden = !story;
  if (story) els.eventline.textContent = story;

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
      (story ? ` Along the east coast, ${story}.` : "");
  }
  els.globe.setAttribute("aria-label", `A globe lit by the sun. ${w.sentence}`);
  els.scrub.setAttribute("aria-valuetext", `${w.phase}, ${w.sky}`);
  els.season.setAttribute("aria-valuetext", `${w.season}, ${w.days}`);
}

// ---------------------------------------------------------------- tracks

let tracksFor = "";
function renderTracks(force = false) {
  const base = new Date(Date.now() + dayShift * DAY);
  // Redraw when the day, the place or the theme moves on, not every frame.
  const key = [Math.round(base.getTime() / (10 * MIN)), viewer.lat, viewer.lng, document.documentElement.dataset.theme].join("|");
  if (!force && key === tracksFor) return;
  tracksFor = key;
  const palette = readPalette();
  els.scrub.style.setProperty("--track", dayTrack(base, viewer, palette));
  els.season.style.setProperty("--track", yearTrack(new Date(), viewer, palette));
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
  renderWords();
  renderTracks();
  els.now.hidden = isLive();
  els.play.setAttribute("aria-pressed", String(playing));
  els.play.querySelector(".btn-label")!.textContent = playing ? "Pause" : "Play";
  els.play.title = playing ? "Hold the sun still" : "Let the sun move";
  const following = clock?.following() === "sun";
  els.faceSun.setAttribute("aria-pressed", String(following));
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
  offsetMin += (dt / 1000) * PLAY_MINUTES_PER_SECOND;
  if (offsetMin > 720) {
    offsetMin -= 1440;
    dayShift += 1;
    if (dayShift > 182) dayShift -= 365;
    els.season.value = String(dayShift);
  }
  els.scrub.value = String(Math.round(offsetMin));
  push();
  requestAnimationFrame(playLoop);
}

// ---------------------------------------------------------------- controls

els.scrub.addEventListener("input", () => {
  offsetMin = Number(els.scrub.value);
  push();
});
els.season.addEventListener("input", () => {
  dayShift = Number(els.season.value);
  push();
});

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
  if (!clock) return;
  clock.follow(clock.following() === "sun" ? null : "sun");
  push();
});

els.faceMe.addEventListener("click", async () => {
  if (!located) {
    const p = await askPosition();
    if (p) {
      viewer = p;
      located = true;
      clock?.setViewer(viewer);
    }
  }
  clock?.faceMe();
  push();
});

let fine = false;
els.fine.addEventListener("change", () => {
  fine = els.fine.checked;
  clock?.setFine(fine);
});

// What the globe shows: each switch toggles one self-contained layer.
els.layers.addEventListener("click", () => {
  const open = els.layersPanel.hidden;
  els.layersPanel.hidden = !open;
  els.layers.setAttribute("aria-expanded", String(open));
});
for (const input of els.layersPanel.querySelectorAll<HTMLInputElement>("input[data-layer]")) {
  const key = input.dataset.layer!;
  input.checked = shownLayers.has(key);
  input.addEventListener("change", () => {
    if (input.checked) shownLayers.add(key);
    else shownLayers.delete(key);
    clock?.setVisible(key, input.checked);
    push();
  });
}

// Credit the sources in words, with a link to every dataset and licence.
{
  els.eventCredit.textContent = `${humpbacks.credit ?? ""}. ${humpbacks.note ?? ""} `;
  if (humpbacks.sourcesUrl) {
    const a = document.createElement("a");
    a.href = humpbacks.sourcesUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "All sources and licences";
    els.eventCredit.append(a);
  }
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
    events: [humpbacks],
    hidden: ["rings", "twilight", "seasons", "moon", "sun", "tides", "people", humpbacks.id].filter((k) => !shownLayers.has(k)),
    onPick: showPick,
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
push();
quietPosition().then((p) => {
  if (!p) return;
  viewer = p;
  located = true;
  clock?.setViewer(viewer);
  map?.easeTo({ center: [viewer.lng, viewer.lat], duration: 1200 });
  push();
});
