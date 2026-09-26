/**
 * The standalone clock: a globe of its own, the light from now-on-earth, and a
 * dock of numberless controls. Everything the Landscape will reuse lives in the
 * library; this file is only the frame around it.
 */

import "./styles.css";
import mapboxgl from "mapbox-gl";
import { FALLBACK_VIEWER, type LngLat, describeLight } from "now-on-earth/core";
import { type NowOnEarth, attachNowOnEarth, readPalette } from "now-on-earth/mapbox";
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
  fine: $<HTMLButtonElement>("fine"),
  seasons: $<HTMLButtonElement>("seasons"),
  theme: $<HTMLButtonElement>("theme"),
};

// ---------------------------------------------------------------- state

let offsetMin = 0; // time scrub, -720 .. 720
let dayShift = 0; // season, -182 .. 182
let playing = false;
let viewer: LngLat = { ...FALLBACK_VIEWER };
let located = false;
let clock: NowOnEarth | null = null;

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
  const w = describeLight(date, viewer);
  els.phase.textContent = w.phase;
  els.sky.textContent = `${w.sky} · ${w.season} · ${w.days}`;
  const place = located ? "Where you are" : "Seen from the Northern Rivers";
  const drift = driftWords();
  els.where.textContent = drift ? `${place} · ${drift.toLowerCase()}` : place;

  // Screen readers hear a change of light, not every frame of it: while the
  // sun is playing, at most one sentence every six seconds.
  const now = performance.now();
  if (w.sentence !== lastSentence && (!playing || now - lastSpoken > 6000)) {
    lastSentence = w.sentence;
    lastSpoken = now;
    els.words.textContent = (drift ? `${drift}. ` : "") + w.sentence;
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
els.fine.addEventListener("click", () => {
  fine = !fine;
  clock?.setFine(fine);
  els.fine.setAttribute("aria-pressed", String(fine));
});

els.seasons.addEventListener("click", () => {
  const on = els.seasons.getAttribute("aria-pressed") !== "true";
  clock?.setVisible("seasons", on);
  els.seasons.setAttribute("aria-pressed", String(on));
});

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
  const narrow = window.matchMedia("(max-width: 720px)").matches;
  try {
    map = new mapboxgl.Map({
      container: els.globe,
      style: STYLE,
      projection: "globe",
      center: [viewer.lng, viewer.lat],
      zoom: narrow ? 0.9 : 1.6,
      attributionControl: true,
    });
  } catch (err) {
    console.warn("[now-on-earth] globe could not start", err);
    notice("This screen cannot draw the globe · the words above still follow the light.");
    return;
  }
  map.getCanvas().setAttribute("aria-hidden", "true");
  map.on("style.load", setFog);
  map.once("load", () => {
    if (!map) return;
    clock = attachNowOnEarth(map, { viewer, fine });
    clock.subscribe(() => {
      const following = clock?.following() === "sun";
      if (els.faceSun.getAttribute("aria-pressed") !== String(following)) {
        els.faceSun.setAttribute("aria-pressed", String(following));
      }
    });
    push();
  });
  new ResizeObserver(() => map?.resize()).observe(els.globe);
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
