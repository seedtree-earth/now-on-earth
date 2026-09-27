/**
 * GET /api/aurora · NOAA SWPC's live aurora forecast (OVATION), lightened and
 * cached.
 *
 * NOAA publishes the forecast as a 1° grid of 65,160 cells (about 900 KB),
 * refreshed every few minutes. Most cells are zero. This function fetches it
 * at most once every ten minutes, keeps only the cells where there is aurora
 * to show, and serves that (about a tenth of the size) with a CDN cache, so
 * NOAA sees a request every ten minutes rather than one per visitor.
 *
 * Polite as the build scripts: one request, a User-Agent naming this site, no
 * retries. If NOAA errors, the last good copy is served (marked stale); with
 * none to hand, a 502 with the reason.
 */

const SOURCE = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";
const USER_AGENT = "now-on-earth/0.1 (+https://github.com/seedtree-earth/now-on-earth)";
const TTL_MS = 10 * 60 * 1000;
/** OVATION values below this are left out (they are nearly everywhere). */
const MIN_VALUE = 3;

export type AuroraPayload = {
  source: string;
  credit: string;
  observed: string;
  forecast: string;
  fetched: string;
  stale?: boolean;
  /** [longitude -180..180, latitude, OVATION value]. */
  points: Array<[number, number, number]>;
};

/** Keep the cells worth drawing, with longitudes in -180..180. */
export function compactOvation(raw: {
  "Observation Time": string;
  "Forecast Time": string;
  coordinates: Array<[number, number, number]>;
}): Omit<AuroraPayload, "fetched"> {
  return {
    source: SOURCE,
    credit: "NOAA Space Weather Prediction Center, OVATION aurora forecast (based on the OVATION Prime model by P. Newell, JHU/APL)",
    observed: raw["Observation Time"],
    forecast: raw["Forecast Time"],
    points: raw.coordinates
      .filter(([, , v]) => v >= MIN_VALUE)
      .map(([lng, lat, v]) => [lng >= 180 ? lng - 360 : lng, lat, v]),
  };
}

let memo: { at: number; body: AuroraPayload } | null = null;

const json = (body: unknown, status = 200, maxAge = 600) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // The CDN holds it for ten minutes and may serve it a little past that while it refreshes.
      "Cache-Control": `public, max-age=60, s-maxage=${maxAge}, stale-while-revalidate=300`,
      "Access-Control-Allow-Origin": "*",
    },
  });

export async function GET(): Promise<Response> {
  if (memo && Date.now() - memo.at < TTL_MS) return json(memo.body);
  try {
    const res = await fetch(SOURCE, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (!res.ok) throw new Error(`NOAA answered ${res.status}`);
    const body: AuroraPayload = { ...compactOvation(await res.json()), fetched: new Date().toISOString() };
    memo = { at: Date.now(), body };
    return json(body);
  } catch (err) {
    if (memo) return json({ ...memo.body, stale: true }, 200, 120);
    return json({ error: `The aurora forecast is unavailable right now (${(err as Error).message}).` }, 502, 60);
  }
}
