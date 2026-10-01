/**
 * Land or sea: a 1° mask built from Natural Earth land at 1:110m
 * (scripts/earth/ocean-mask.mjs). Coarse on purpose, for words ("the open
 * ocean") rather than drawing.
 */

import { OCEAN_MASK } from "./data/ocean-mask.js";

let maskBits: Uint8Array | null = null;
function bits(): Uint8Array {
  if (!maskBits) {
    const bin = typeof atob === "function" ? atob(OCEAN_MASK.bits) : Buffer.from(OCEAN_MASK.bits, "base64").toString("binary");
    maskBits = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }
  return maskBits;
}

/** Is this point at sea (Natural Earth land at 1:110m, on a 1° grid)? */
export function isOcean(lat: number, lng: number): boolean {
  const row = Math.min(OCEAN_MASK.height - 1, Math.max(0, Math.floor(90 - lat)));
  const col = ((Math.floor(lng + 180) % 360) + 360) % 360;
  const i = row * OCEAN_MASK.width + col;
  return (bits()[i >> 3] & (1 << (i & 7))) !== 0;
}
