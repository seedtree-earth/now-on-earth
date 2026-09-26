/**
 * Where the viewer is, asked for gently.
 *
 * The clock never prompts on arrival. If the browser has already been given
 * permission it uses it quietly; otherwise it stands in the Northern Rivers
 * until the person presses "Face me". The position is rounded to about ten
 * kilometres and never leaves the page.
 */

import type { LngLat } from "now-on-earth/core";

const coarse = (x: number) => Math.round(x * 10) / 10;

function read(): Promise<LngLat | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lng: coarse(p.coords.longitude), lat: coarse(p.coords.latitude) }),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 30 * 60 * 1000, timeout: 12000 },
    );
  });
}

/** The position if permission was already granted; never shows a prompt. */
export async function quietPosition(): Promise<LngLat | null> {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (status?.state === "granted") return read();
  } catch {
    /* Permissions API missing: stay quiet */
  }
  return null;
}

/** Ask for the position (may show the browser prompt). */
export function askPosition(): Promise<LngLat | null> {
  return read();
}
