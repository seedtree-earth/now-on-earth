/**
 * The sky's long cycles, for deep time.
 *
 * - The great year: the Earth's axis wobbles like a slowing top, carrying the
 *   celestial pole round a circle in the sky and the equinoxes back along the
 *   zodiac, once in about 25,800 years (precession). Today the pole star is
 *   Polaris; as the pyramids rose it was Thuban; half a great year back it
 *   was Vega.
 * - The tilt's nod (about 41,000 years) and the orbit's stretch (about
 *   100,000 years, and a long rhythm of about 405,000): the Milankovitch
 *   cycles that pace the ice ages.
 * - The galactic year: the sun's journey once round the Milky Way, roughly
 *   230 million years.
 *
 * The pole is found by turning it steadily round the ecliptic pole at
 * today's tilt: close for tens of thousands of years, a sketch beyond that
 * (the tilt and the rate both drift). Star places are J2000, without their
 * own slow motions.
 */

export const GREAT_YEAR = 25_772;
export const TILT_CYCLE = 41_000;
export const ORBIT_CYCLE = 100_000;
export const LONG_ORBIT_CYCLE = 405_000;
export const GALACTIC_YEAR = 230_000_000;

const RAD = Math.PI / 180;
const OBLIQUITY = 23.44;

/** Bright stars that have been, or will be, near the pole: [name, constellation, RA hours, Dec degrees] (J2000). */
const POLE_STARS: Array<[string, string, number, number]> = [
  ["Polaris", "the Little Bear", 2.5303, 89.2641],
  ["Kochab", "the Little Bear", 14.8451, 74.1555],
  ["Thuban", "the Dragon", 14.0731, 64.3758],
  ["Vega", "the Lyre", 18.6156, 38.7837],
  ["Deneb", "the Swan", 20.6905, 45.2803],
  ["Alderamin", "Cepheus", 21.3097, 62.5856],
  ["Errai", "Cepheus", 23.6558, 77.6325],
  ["Iota Herculis", "Hercules", 17.6575, 46.0064],
  ["Delta Cygni", "the Swan", 19.7496, 45.1308],
];

/** A star's place in ecliptic coordinates (J2000), as a unit vector. */
function eclipticVector(raHours: number, dec: number): [number, number, number] {
  const ra = raHours * 15 * RAD;
  const d = dec * RAD;
  const x = Math.cos(d) * Math.cos(ra);
  const y = Math.cos(d) * Math.sin(ra);
  const z = Math.sin(d);
  const e = OBLIQUITY * RAD;
  return [x, y * Math.cos(e) + z * Math.sin(e), -y * Math.sin(e) + z * Math.cos(e)];
}

/** The north celestial pole, years ago, as a unit vector in today's ecliptic frame. */
export function poleAt(yearsAgo: number): [number, number, number] {
  // Today the pole sits at ecliptic longitude 90°, 23.44° from the ecliptic pole.
  // Going back in time it turns forward round the ecliptic pole (the equinoxes move west over time).
  const lambda = (90 + (360 * yearsAgo) / GREAT_YEAR) * RAD;
  const beta = (90 - OBLIQUITY) * RAD;
  return [Math.cos(beta) * Math.cos(lambda), Math.cos(beta) * Math.sin(lambda), Math.sin(beta)];
}

/** The bright star nearest the pole then, and how near (degrees). */
export function poleStar(yearsAgo: number): { name: string; constellation: string; distance: number } {
  const p = poleAt(yearsAgo);
  let best = { name: "", constellation: "", distance: 180 };
  for (const [name, constellation, ra, dec] of POLE_STARS) {
    const v = eclipticVector(ra, dec);
    const d = Math.acos(Math.max(-1, Math.min(1, p[0] * v[0] + p[1] * v[1] + p[2] * v[2]))) / RAD;
    if (d < best.distance) best = { name, constellation, distance: d };
  }
  return best;
}

const FRACTION: Array<[number, string]> = [
  [0.04, ""],
  [0.18, "a little way round"],
  [0.32, "a quarter of the way round"],
  [0.43, "a third of the way round"],
  [0.57, "half way round"],
  [0.68, "two thirds of the way round"],
  [0.82, "three quarters of the way round"],
  [0.96, "most of the way round"],
  [1, ""],
];

const COUNT = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** Where the great year stands, years ago, in words: the turn of the pole, and the pole star if one is near. */
export function greatYearWords(yearsAgo: number): string {
  if (yearsAgo < 200) return "";
  if (yearsAgo > 1_000_000) return "The pole has circled the sky many times since; the great year turns about once in each twenty-six thousand years.";
  const turns = yearsAgo / GREAT_YEAR;
  const whole = Math.floor(turns + 0.04);
  const part = FRACTION.find(([max]) => turns - Math.floor(turns) < max)?.[1] ?? "";
  const way =
    whole === 0
      ? `the great year ${part} from now`
      : part
        ? `${COUNT[whole] ?? "many"} great year${whole > 1 ? "s" : ""} and ${part} back`
        : `${COUNT[whole] ?? "many"} whole turn${whole > 1 ? "s" : ""} of the great year back`;
  const star = poleStar(yearsAgo);
  const pole =
    star.distance < 1.5
      ? `${star.name} in ${star.constellation} the pole star`
      : star.distance < 6
        ? `${star.name} in ${star.constellation} near the pole`
        : "no bright star at the pole";
  const half = Math.abs((turns % 1) - 0.5) < 0.08 ? "; the stars of today's summer nights shine in winter" : "";
  return `${way.charAt(0).toUpperCase()}${way.slice(1)}: ${pole}${half}.`;
}
