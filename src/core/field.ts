/**
 * The human field: a slot for the cadence and intensity of people's shared
 * state, from sources such as networks of random number generators (the
 * Global Consciousness Project 2.0) or opt-in wearables (heart rate and its
 * variability, as HeartMath and In Truth measure them).
 *
 * The metronome shows it: the word EART set along an arc of the Earth, and
 * an H on the swinging arm. At one end of the swing the H completes HEART,
 * at the other EARTH. The cadence of the field sets the tempo; its intensity
 * sets how far the arm swings (only at full intensity does it reach either
 * end and complete a word).
 *
 * No source is connected yet. Until one is, the field is `null` and the arm
 * keeps RESTING_SWING, a slow steady rhythm, labelled "no source connected yet
 * · a resting swing, not data". Nothing here invents a signal: motion
 * presented as the human field would mislead, so the words never claim it. A source plugs in through `FieldSource`
 * once its data may be used (an agreement with its keepers; for personal
 * wearables, opt-in, coarse and unstored, by the principles in the README).
 */

export type FieldReading = {
  /** Beats per minute of the swing: the field's cadence. */
  cadence: number;
  /** 0..1: how far the arm swings. 1 reaches either end and completes the word. */
  intensity: number;
  /** When this reading was taken. */
  at: Date;
};

export interface FieldSource {
  /** Its name, for the label ("GCP 2.0 random number generator network"). */
  readonly name: string;
  /** What it measures, plainly, and what is uncertain about it. */
  readonly describes: string;
  /** Credit as its keepers ask. */
  readonly credit: string;
  /** Called with each reading, and null when the source goes quiet. Returns a way to stop. */
  subscribe(fn: (reading: FieldReading | null) => void): () => void;
}

/**
 * The swing while no source is connected: slow and steady, reaching both
 * ends. A resting rhythm for the instrument, not a reading of anything; the
 * label says so.
 */
export const RESTING_SWING: Omit<FieldReading, "at"> = { cadence: 10, intensity: 1 };

/** The widest swing either side of upright, degrees: the arm's reach to complete the word. */
export const FIELD_REACH = 60;

/** The arm's angle at a moment, degrees from upright (negative toward HEART, positive toward EARTH). 0 with no reading. */
export function armAngle(reading: FieldReading | null, seconds: number): number {
  if (!reading) return 0;
  const bpm = Math.max(6, Math.min(120, reading.cadence));
  // One beat is one swing from side to side; a full period is two beats.
  const period = 120 / bpm;
  const reach = FIELD_REACH * Math.max(0, Math.min(1, reading.intensity));
  return reach * Math.sin((2 * Math.PI * seconds) / period);
}

/** The field in words, numberless. */
export function fieldWords(reading: FieldReading | null, source: FieldSource | null): string {
  if (!source || !reading) return "Listening for the human field · no source connected yet";
  const pace = reading.cadence < 30 ? "a slow" : reading.cadence < 60 ? "a steady" : "a quick";
  const reach = reading.intensity < 0.33 ? "a gentle" : reading.intensity < 0.75 ? "a fuller" : "a wide";
  return `The human field: ${pace} beat, ${reach} swing · ${source.name}`;
}
