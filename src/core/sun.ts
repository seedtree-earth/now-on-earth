/**
 * Where the sun is overhead, right now or at any moment.
 *
 * The subsolar point's latitude is the solar declination; its longitude is
 * where local apparent solar time is noon. Both come from the NOAA solar
 * calculator's series (after Meeus, "Astronomical Algorithms"), which carries
 * the equation of time, so the point sits within about a tenth of a degree of
 * the true sun for any date this century. That is far finer than a person can
 * read off a globe, which is the point: the light is honest.
 */

export type LngLat = { lng: number; lat: number };

export type SunState = {
  /** The subsolar point: the sun is straight overhead here. */
  subsolar: LngLat;
  /** The opposite side of the Earth: local midnight, the heart of the night. */
  antisolar: LngLat;
  /** Solar declination in degrees (equals the subsolar latitude). */
  declination: number;
  /** Equation of time in minutes: apparent minus mean solar time. */
  equationOfTime: number;
  /** The sun's apparent ecliptic longitude in degrees, 0 at the March equinox. */
  eclipticLongitude: number;
  /** Obliquity of the ecliptic in degrees: the latitude of the tropics. */
  obliquity: number;
};

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Wrap a longitude into [-180, 180). */
export function wrapLng(lng: number): number {
  const x = (((lng + 180) % 360) + 360) % 360;
  return x - 180;
}

/** Julian centuries since J2000.0 for a JS Date (UTC). */
export function julianCentury(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  return (jd - 2451545) / 36525;
}

export function sunState(date: Date): SunState {
  const T = julianCentury(date);

  // Geometric mean longitude and anomaly of the sun, orbit eccentricity.
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  // Equation of centre, true and apparent longitude.
  const Mr = M * RAD;
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);

  // Obliquity, corrected for nutation.
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);

  const declination = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) * DEG;

  // Equation of time, in minutes.
  const y = Math.tan((eps * RAD) / 2) ** 2;
  const L0r = L0 * RAD;
  const eot =
    4 *
    DEG *
    (y * Math.sin(2 * L0r) -
      2 * e * Math.sin(Mr) +
      4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) -
      0.5 * y * y * Math.sin(4 * L0r) -
      1.25 * e * e * Math.sin(2 * Mr));

  // Where is it apparent noon? Mean noon sits at longitude -15° per hour past
  // 12:00 UTC; the equation of time nudges it by a quarter degree per minute.
  const utcMinutes =
    date.getUTCHours() * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60000;
  const lng = wrapLng(-(utcMinutes + eot - 720) / 4);

  return {
    subsolar: { lng, lat: declination },
    antisolar: { lng: wrapLng(lng + 180), lat: -declination },
    declination,
    equationOfTime: eot,
    eclipticLongitude: ((lambda % 360) + 360) % 360,
    obliquity: eps,
  };
}

/** Great-circle angular distance between two points, in degrees. */
export function angularDistance(a: LngLat, b: LngLat): number {
  const p1 = a.lat * RAD;
  const p2 = b.lat * RAD;
  const dl = (b.lng - a.lng) * RAD;
  const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}

export type SunSky = {
  /** Height of the sun above the horizon, degrees (negative below). */
  altitude: number;
  /** Compass bearing of the sun, degrees clockwise from north. */
  azimuth: number;
  /**
   * Hour angle in degrees: 0 at local solar noon, negative in the morning,
   * positive in the afternoon, ±180 at local solar midnight.
   */
  hourAngle: number;
};

/** Where the sun sits in the sky for someone standing at `at`. */
export function sunSky(at: LngLat, sun: SunState): SunSky {
  const hourAngle = wrapLng(at.lng - sun.subsolar.lng);
  const altitude = 90 - angularDistance(at, sun.subsolar);

  // Initial bearing from the observer toward the subsolar point.
  const p1 = at.lat * RAD;
  const p2 = sun.subsolar.lat * RAD;
  const dl = (sun.subsolar.lng - at.lng) * RAD;
  const yy = Math.sin(dl) * Math.cos(p2);
  const xx = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const azimuth = ((Math.atan2(yy, xx) * DEG) % 360 + 360) % 360;

  return { altitude, azimuth, hourAngle };
}

/**
 * The share of a day that is lit at a given latitude on a given declination,
 * from 0 (polar night) to 1 (midnight sun). Geometric, centre of the disc.
 */
export function dayLengthShare(lat: number, declination: number): number {
  const x = -Math.tan(lat * RAD) * Math.tan(declination * RAD);
  if (x <= -1) return 1;
  if (x >= 1) return 0;
  return (2 * Math.acos(x) * DEG) / 360;
}

/**
 * Half the lit arc of a parallel, in degrees of longitude either side of the
 * sun's meridian. 0 means the parallel is wholly dark; 180 wholly lit.
 */
export function litHalfArc(lat: number, declination: number): number {
  return dayLengthShare(lat, declination) * 180;
}
