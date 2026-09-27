/**
 * Colours come from the host page's CSS custom properties, never from here.
 *
 * On the Landscape that means SeedTree V2's own tokens (`--accent`, `--ink`,
 * `--bg`, `--canopy`, switched by `data-theme="morning" | "night"`), so a V2
 * restyle flows straight into the light on the globe. The clock adds two tokens
 * V2 does not have yet, `--noe-night` and `--noe-me`; a host can define them,
 * and until it does the fallbacks below keep the night a dusk violet and the
 * viewer's own line a clear teal.
 *
 * Mapbox needs concrete colour strings, so each token is resolved through a
 * canvas (which normalises any CSS colour to hex or rgba) and re-resolved when
 * the page's theme attribute changes.
 */

export type Palette = {
  /** Sun, day rings, tropics, sun track. V2: --accent. */
  day: string;
  /** Night rings. Clock token: --noe-night. */
  night: string;
  /** Pale warm light the day rings lift toward near the sun. Clock token: --noe-glow. */
  glow: string;
  /** Rose of golden hour and twilight. Clock token: --noe-dusk. */
  dusk: string;
  /** Moonlight: the moon, its phase, the tides. Clock token: --noe-moon. */
  moon: string;
  /** Living things: ecological events. Clock token: --noe-life. */
  life: string;
  /** The Earth's body: magnetic field lines and poles. Clock token: --noe-field. */
  field: string;
  /** The aurora's green. Clock token: --noe-aurora. */
  aurora: string;
  /** Plankton's bioluminescent blue. Clock token: --noe-plankton. */
  plankton: string;
  /** The viewer's line and dot. Clock token: --noe-me. */
  me: string;
  /** Hairlines and strokes that sit against the globe. V2: --bg. */
  paper: string;
  /** Strong ink, for strokes on the gold. V2: --ink. */
  ink: string;
  /** Is the page in its night theme? Tunes the depth of the fills. */
  dark: boolean;
};

export type PaletteTokens = { [K in Exclude<keyof Palette, "dark">]: string };

/** Token names, matching SeedTree V2's globals.css where V2 has one. */
export const TOKENS: PaletteTokens = {
  day: "--accent",
  night: "--noe-night",
  glow: "--noe-glow",
  dusk: "--noe-dusk",
  moon: "--noe-moon",
  life: "--noe-life",
  field: "--noe-field",
  aurora: "--noe-aurora",
  plankton: "--noe-plankton",
  me: "--noe-me",
  paper: "--bg",
  ink: "--ink",
};

const FALLBACK_LIGHT: Omit<Palette, "dark"> = {
  day: "#d99a2e",
  night: "#2d2350",
  glow: "#fff4d6",
  dusk: "#d9826b",
  moon: "#dfe4ee",
  life: "#3f9e8f",
  field: "#8fa6dc",
  aurora: "#3fcf8e",
  plankton: "#4fb8d6",
  me: "#2a9d9a",
  paper: "#f4eee1",
  ink: "#1c231a",
};

const FALLBACK_DARK: Omit<Palette, "dark"> = {
  day: "#f0c05a",
  night: "#120d24",
  glow: "#fff0c8",
  dusk: "#e59274",
  moon: "#e9edf6",
  life: "#7fd6c4",
  field: "#a9bdf0",
  aurora: "#6dffb0",
  plankton: "#7fe3ff",
  me: "#5cc8c2",
  paper: "#0f1712",
  ink: "#e9e6d7",
};

let probe: CanvasRenderingContext2D | null = null;

/** Normalise any CSS colour to a string Mapbox can parse, or null. */
function normalise(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (typeof document === "undefined") return v;
  probe ??= document.createElement("canvas").getContext("2d");
  if (!probe) return v;
  probe.fillStyle = "#010203";
  probe.fillStyle = v;
  const out = String(probe.fillStyle);
  // Unchanged sentinel means the browser rejected the value.
  if (out === "#010203" && v.toLowerCase() !== "#010203") return null;
  return /^(#|rgb)/.test(out) ? out : null;
}

/** Is the page in its dark theme? V2 marks it data-theme="night". */
export function isDark(el: Element): boolean {
  const t = el.getAttribute("data-theme");
  if (t === "night" || t === "dark") return true;
  if (t === "morning" || t === "light") return false;
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readPalette(
  el: Element = document.documentElement,
  overrides: Partial<Palette> = {},
  tokens: PaletteTokens = TOKENS,
): Palette {
  const dark = overrides.dark ?? isDark(el);
  const style = getComputedStyle(el);
  const fallback = dark ? FALLBACK_DARK : FALLBACK_LIGHT;
  const pick = (k: keyof PaletteTokens) =>
    overrides[k] ?? normalise(style.getPropertyValue(tokens[k])) ?? fallback[k];
  return {
    day: pick("day"),
    night: pick("night"),
    glow: pick("glow"),
    dusk: pick("dusk"),
    moon: pick("moon"),
    life: pick("life"),
    field: pick("field"),
    aurora: pick("aurora"),
    plankton: pick("plankton"),
    me: pick("me"),
    paper: pick("paper"),
    ink: pick("ink"),
    dark,
  };
}
