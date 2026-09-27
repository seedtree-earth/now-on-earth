/**
 * The Earth's own magnetic field, from the World Magnetic Model 2025.
 *
 * The model is a spherical harmonic expansion of the field's potential to
 * degree 12, with a yearly rate of change. From it: the field at any point on
 * or above the Earth, the compass's pull at a place, and field lines traced
 * out from the surface. The Earth is treated as a sphere (geocentric), which
 * is far finer than the eye can tell here.
 *
 * The model describes the field the Earth makes itself. Further out the solar
 * wind squeezes and stretches the real field; the model does not include
 * that, and the traced lines are kept close to the Earth.
 */

import { WMM2025 } from "./data/wmm2025.js";
import { MAGNETIC_POLES } from "./data/magnetic-poles.js";
import type { LngLat } from "./sun.js";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const N_MAX = 12;

export type Vec3 = [number, number, number];

/** Decimal year of a date. */
export function decimalYear(date: Date): number {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (date.getTime() - start) / (end - start);
}

type Coeffs = { g: number[][]; h: number[][] };

/** Coefficients at a decimal year (held within the model's validity). */
export function coefficientsAt(year: number): Coeffs {
  const t = Math.max(WMM2025.epoch, Math.min(WMM2025.epoch + 5, year)) - WMM2025.epoch;
  const g = Array.from({ length: N_MAX + 1 }, () => new Array(N_MAX + 1).fill(0));
  const h = Array.from({ length: N_MAX + 1 }, () => new Array(N_MAX + 1).fill(0));
  for (const [n, m, gnm, hnm, dg, dh] of WMM2025.coefficients) {
    g[n][m] = gnm + dg * t;
    h[n][m] = hnm + dh * t;
  }
  return { g, h };
}

/** Schmidt semi-normalised associated Legendre functions and their θ-derivatives. */
function legendre(theta: number) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const P = Array.from({ length: N_MAX + 1 }, () => new Array(N_MAX + 1).fill(0));
  const dP = Array.from({ length: N_MAX + 1 }, () => new Array(N_MAX + 1).fill(0));
  P[0][0] = 1;
  for (let n = 1; n <= N_MAX; n++) {
    // The sectoral term, m = n.
    if (n === 1) {
      P[1][1] = s;
      dP[1][1] = c;
    } else {
      const k = Math.sqrt((2 * n - 1) / (2 * n));
      P[n][n] = k * s * P[n - 1][n - 1];
      dP[n][n] = k * (c * P[n - 1][n - 1] + s * dP[n - 1][n - 1]);
    }
    for (let m = 0; m < n; m++) {
      const a = Math.sqrt(n * n - m * m);
      const b = n >= 2 ? Math.sqrt((n - 1) * (n - 1) - m * m) : 0;
      const p2 = n >= 2 ? P[n - 2][m] : 0;
      const dp2 = n >= 2 ? dP[n - 2][m] : 0;
      P[n][m] = ((2 * n - 1) * c * P[n - 1][m] - b * p2) / a;
      dP[n][m] = ((2 * n - 1) * (c * dP[n - 1][m] - s * P[n - 1][m]) - b * dp2) / a;
    }
  }
  return { P, dP };
}

export type FieldComponents = {
  /** Northward, eastward and downward components, nT. */
  north: number;
  east: number;
  down: number;
  /** Total strength, nT. */
  total: number;
};

/**
 * The field at latitude, longitude and radius `r` (in Earth radii) from the
 * spherical harmonic expansion: B = -∇V.
 */
export function fieldAt(lat: number, lng: number, r: number, coeffs: Coeffs): FieldComponents {
  const theta = (90 - lat) * RAD;
  const phi = lng * RAD;
  const { P, dP } = legendre(theta);
  const s = Math.max(1e-9, Math.sin(theta));
  let Br = 0;
  let Bt = 0;
  let Bp = 0;
  for (let n = 1; n <= N_MAX; n++) {
    const k = Math.pow(1 / r, n + 2);
    for (let m = 0; m <= n; m++) {
      const cm = Math.cos(m * phi);
      const sm = Math.sin(m * phi);
      const gh = coeffs.g[n][m] * cm + coeffs.h[n][m] * sm;
      Br += (n + 1) * k * gh * P[n][m];
      Bt -= k * gh * dP[n][m];
      Bp -= (k * m * (-coeffs.g[n][m] * sm + coeffs.h[n][m] * cm) * P[n][m]) / s;
    }
  }
  // θ grows southward, so north is -Bθ; down is -Br.
  const north = -Bt;
  const east = Bp;
  const down = -Br;
  return { north, east, down, total: Math.hypot(north, east, down) };
}

/** Which way a compass points at a place, degrees east of true north, and how steeply the field dips. */
export function compass(at: LngLat, date: Date): { declination: number; inclination: number } {
  const f = fieldAt(at.lat, at.lng, 1, coefficientsAt(decimalYear(date)));
  return {
    declination: Math.atan2(f.east, f.north) * DEG,
    inclination: Math.atan2(f.down, Math.hypot(f.north, f.east)) * DEG,
  };
}

/** A compass's pull at a place, in words. */
export function compassWords(at: LngLat, date: Date): string {
  const { declination: d } = compass(at, date);
  const side = d >= 0 ? "east" : "west";
  const a = Math.abs(d);
  if (a < 1.5) return "a compass here points almost true north";
  if (a < 8) return `a compass here points a little ${side} of true north`;
  if (a < 25) return `a compass here points well ${side} of true north`;
  return `a compass here points far ${side} of true north`;
}

// ------------------------------------------------------------ field lines

/** Earth-centred unit-sphere coordinates: x toward 0°E, y toward 90°E, z toward the North Pole. */
export function toXYZ(lat: number, lng: number, r = 1): Vec3 {
  const cl = Math.cos(lat * RAD);
  return [r * cl * Math.cos(lng * RAD), r * cl * Math.sin(lng * RAD), r * Math.sin(lat * RAD)];
}

function fromXYZ([x, y, z]: Vec3): { lat: number; lng: number; r: number } {
  const r = Math.hypot(x, y, z);
  return { lat: Math.asin(z / r) * DEG, lng: Math.atan2(y, x) * DEG, r };
}

/** The unit field direction at a point, as an x, y, z vector. */
function direction(p: Vec3, coeffs: Coeffs): Vec3 {
  const { lat, lng, r } = fromXYZ(p);
  const f = fieldAt(lat, lng, r, coeffs);
  const la = lat * RAD;
  const lo = lng * RAD;
  // Local north, east and up as x, y, z.
  const N: Vec3 = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const E: Vec3 = [-Math.sin(lo), Math.cos(lo), 0];
  const U: Vec3 = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const v: Vec3 = [0, 1, 2].map((i) => f.north * N[i] + f.east * E[i] - f.down * U[i]) as Vec3;
  const len = Math.hypot(...v);
  return v.map((x) => x / len) as Vec3;
}

/**
 * The dipole axis: the geomagnetic north pole, as a unit vector. The dipole
 * moment points roughly south, so north is its opposite.
 */
export function dipoleAxis(coeffs: Coeffs): Vec3 {
  const m: Vec3 = [coeffs.g[1][1], coeffs.h[1][1], coeffs.g[1][0]];
  const len = Math.hypot(...m);
  return m.map((x) => -x / len) as Vec3;
}

export type FieldLine = { points: Vec3[]; /** Its greatest height, Earth radii from the centre. */ apex: number };

/**
 * Field lines traced from rings of footpoints around the dipole axis, at the
 * given magnetic latitudes, every `spacing` degrees of magnetic longitude.
 * Each is followed with fourth-order Runge-Kutta steps until it comes back to
 * the surface in the other hemisphere.
 */
export function fieldLines(
  date: Date,
  opts: { latitudes?: number[]; spacing?: number; step?: number; maxRadius?: number } = {},
): FieldLine[] {
  const coeffs = coefficientsAt(decimalYear(date));
  const latitudes = opts.latitudes ?? [30, 40, 48];
  const spacing = opts.spacing ?? 45;
  const step = opts.step ?? 0.02;
  const maxRadius = opts.maxRadius ?? 4;
  const axis = dipoleAxis(coeffs);
  // Two directions at right angles to the axis, to walk the rings.
  const ref: Vec3 = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a: Vec3): Vec3 => {
    const l = Math.hypot(...a);
    return a.map((x) => x / l) as Vec3;
  };
  const u = norm(cross(axis, ref));
  const w = cross(axis, u);

  const lines: FieldLine[] = [];
  for (const mlat of latitudes) {
    for (let mlon = 0; mlon < 360; mlon += spacing) {
      const cl = Math.cos(mlat * RAD);
      const sl = Math.sin(mlat * RAD);
      const cm = Math.cos(mlon * RAD);
      const sm = Math.sin(mlon * RAD);
      // A footpoint in the magnetic north, just above the surface.
      let p: Vec3 = [0, 1, 2].map((i) => 1.001 * (sl * axis[i] + cl * (cm * u[i] + sm * w[i]))) as Vec3;
      // In the north the field points down into the Earth; follow it backwards, outward and over.
      const sign = -1;
      const points: Vec3[] = [p];
      let apex = 1;
      for (let i = 0; i < 4000; i++) {
        const k1 = direction(p, coeffs);
        const p2 = p.map((x, j) => x + (sign * step * k1[j]) / 2) as Vec3;
        const k2 = direction(p2, coeffs);
        const p3 = p.map((x, j) => x + (sign * step * k2[j]) / 2) as Vec3;
        const k3 = direction(p3, coeffs);
        const p4 = p.map((x, j) => x + sign * step * k3[j]) as Vec3;
        const k4 = direction(p4, coeffs);
        p = p.map((x, j) => x + (sign * step * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])) / 6) as Vec3;
        const r = Math.hypot(...p);
        apex = Math.max(apex, r);
        points.push(p);
        if (r < 1 || r > maxRadius) break;
      }
      lines.push({ points, apex });
    }
  }
  return lines;
}

// ------------------------------------------------------------ poles

export type PolePosition = { lng: number; lat: number; year: number };

/** The north and south magnetic (dip) poles' wandering, from 1925, oldest first. */
export function magneticPoleTrails(): { north: PolePosition[]; south: PolePosition[] } {
  const map = (rows: Array<[number, number, number]>) => rows.map(([lng, lat, year]) => ({ lng, lat, year }));
  return { north: map(MAGNETIC_POLES.north), south: map(MAGNETIC_POLES.south) };
}
