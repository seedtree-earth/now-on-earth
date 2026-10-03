/**
 * The metronome of the human field, lower left on a wide screen.
 *
 * The scale is the Earth: its curve along the bottom, and above it the word
 * EART set on an arc. The arm rises from the Earth with an H at its tip. At
 * one end of its swing the H completes HEART, at the other EARTH; the
 * field's cadence sets the tempo, its intensity how far it reaches.
 *
 * No source is connected yet, so the arm rests upright and the label says
 * so. `connect(source)` starts it; nothing here makes up a signal.
 */

import { type FieldReading, type FieldSource, FIELD_REACH, armAngle, fieldWords } from "now-on-earth/core";

const NS = "http://www.w3.org/2000/svg";
const W = 240;
const H = 150;
const PIVOT = { x: 120, y: 132 };
/** The radius of the scale: letters and the H ride it. */
const R = 92;
/** Letters are a swing-step apart; the H completes the word one step beyond either end. */
const STEP = FIELD_REACH / 2.5;

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

const onArc = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180;
  return { x: PIVOT.x + r * Math.sin(a), y: PIVOT.y - r * Math.cos(a) };
};

export type Metronome = {
  connect(source: FieldSource | null): void;
  destroy(): void;
};

export function createMetronome(root: HTMLElement): Metronome {
  root.className = "metronome";
  root.setAttribute("role", "img");
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" });

  // The Earth: a wide curve of the planet along the bottom.
  const earthR = 420;
  svg.append(
    el("defs", {}),
    el("circle", { class: "m-earth", cx: PIVOT.x, cy: PIVOT.y + earthR - 6, r: earthR }),
    el("path", { class: "m-limb", d: `M ${PIVOT.x - 118} ${PIVOT.y + 12} Q ${PIVOT.x} ${PIVOT.y - 12} ${PIVOT.x + 118} ${PIVOT.y + 12}` }),
  );

  // The scale: a faint arc with ticks, from one end of the swing to the other.
  const from = onArc(-FIELD_REACH - 6, R + 16);
  const to = onArc(FIELD_REACH + 6, R + 16);
  svg.append(el("path", { class: "m-scale", d: `M ${from.x} ${from.y} A ${R + 16} ${R + 16} 0 0 1 ${to.x} ${to.y}` }));
  for (let d = -FIELD_REACH; d <= FIELD_REACH + 0.01; d += STEP / 2) {
    const a = onArc(d, R + 12);
    const b = onArc(d, R + 19);
    svg.append(el("line", { class: "m-tick", x1: a.x, y1: a.y, x2: b.x, y2: b.y }));
  }

  // EART, each letter upright on the arc.
  "EART".split("").forEach((ch, i) => {
    const deg = -1.5 * STEP + i * STEP;
    const p = onArc(deg);
    const t = el("text", { class: "m-letter", x: p.x, y: p.y, "text-anchor": "middle", "dominant-baseline": "central", transform: `rotate(${deg} ${p.x} ${p.y})` });
    t.textContent = ch;
    svg.append(t);
  });

  // The arm and its H, turning about the pivot.
  const arm = el("g", { class: "m-arm" });
  const tip = onArc(0, R - 13);
  arm.append(el("line", { class: "m-rod", x1: PIVOT.x, y1: PIVOT.y, x2: tip.x, y2: tip.y }));
  const hp = onArc(0);
  const hText = el("text", { class: "m-h", x: hp.x, y: hp.y, "text-anchor": "middle", "dominant-baseline": "central" });
  hText.textContent = "H";
  arm.append(hText);
  svg.append(arm, el("circle", { class: "m-pivot", cx: PIVOT.x, cy: PIVOT.y, r: 4 }));

  const label = document.createElement("p");
  label.className = "m-label";
  root.replaceChildren(svg, label);

  let source: FieldSource | null = null;
  let reading: FieldReading | null = null;
  let stop: (() => void) | null = null;
  let raf = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setAngle = (deg: number) => arm.setAttribute("transform", `rotate(${deg.toFixed(2)} ${PIVOT.x} ${PIVOT.y})`);
  // At rest the H waits on the arm below the word, so the scale reads EART; with a source it rides the scale.
  const seat = (onScale: boolean) => {
    const p = onArc(0, onScale ? R : R - 30);
    hText.setAttribute("y", String(p.y));
    root.classList.toggle("is-resting", !onScale);
  };
  const say = () => {
    const words = fieldWords(reading, source);
    label.textContent = words;
    root.setAttribute("aria-label", `A metronome of the human field, the H swinging between HEART and EARTH. ${words}.`);
  };
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    setAngle(armAngle(reading, now / 1000));
  };
  const run = () => {
    cancelAnimationFrame(raf);
    // No reading, or a wish for stillness: the arm rests (upright, or held at the swing's reach).
    seat(!!reading);
    if (!reading) return setAngle(0);
    if (reduced) return setAngle(FIELD_REACH * Math.min(1, reading.intensity) * 0.5);
    raf = requestAnimationFrame(loop);
  };

  setAngle(0);
  seat(false);
  say();

  return {
    connect(next) {
      stop?.();
      stop = null;
      source = next;
      reading = null;
      if (source) {
        stop = source.subscribe((r) => {
          reading = r;
          say();
          run();
        });
      }
      say();
      run();
    },
    destroy() {
      stop?.();
      cancelAnimationFrame(raf);
      root.replaceChildren();
    },
  };
}
