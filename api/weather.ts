/**
 * GET /api/weather?lat=..&lng=.. · The weather at one chosen place, from MET
 * Norway's Locationforecast 2.0 (CC BY 4.0), cached.
 *
 * Granular by design: only the place someone tapped or stands, rounded to
 * 0.1° (about ten kilometres) before it goes anywhere. MET Norway's terms ask
 * for an identifying User-Agent, no more than four decimals in coordinates,
 * and that Expires is honoured: each place is fetched at most once per
 * forecast (about half an hour to an hour), memoised here and held by the CDN
 * for the same span.
 *
 * Polite as the other functions: one request, no retries. If MET Norway
 * errors, the last good copy for that place is served (marked stale).
 */

const SOURCE = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const USER_AGENT = "now-on-earth/0.1 (+https://github.com/seedtree-earth/now-on-earth)";
const CREDIT = "Weather from MET Norway (the Norwegian Meteorological Institute), CC BY 4.0";
/** Never hold a forecast longer than this, whatever Expires says. */
const MAX_MS = 3 * 60 * 60 * 1000;
/** Places remembered at once; the oldest are let go. */
const MAX_PLACES = 500;

type Step = {
  time: string;
  data: {
    instant: { details: Record<string, number> };
    next_1_hours?: { summary: { symbol_code: string }; details?: { precipitation_amount?: number } };
    next_6_hours?: { summary: { symbol_code: string }; details?: { precipitation_amount?: number } };
  };
};

export type WeatherBody = {
  at: { lng: number; lat: number };
  updated: string;
  expires: string;
  credit: string;
  stale?: boolean;
  now: {
    symbol: string;
    temperature: number;
    wind: number;
    windFrom: number;
    rain?: number;
    later?: { symbol: string; rain?: number };
  };
};

/** The step nearest now, and the six hours after it, from MET Norway's timeseries. */
export function compactForecast(
  raw: { properties: { meta: { updated_at: string }; timeseries: Step[] } },
  now = Date.now(),
): Pick<WeatherBody, "updated" | "now"> {
  const series = raw.properties.timeseries;
  const current = series.find((s) => Date.parse(s.time) + 30 * 60 * 1000 >= now) ?? series[0];
  const d = current.data;
  const next = d.next_1_hours ?? d.next_6_hours;
  return {
    updated: raw.properties.meta.updated_at,
    now: {
      symbol: next?.summary.symbol_code ?? "cloudy",
      temperature: d.instant.details.air_temperature,
      wind: d.instant.details.wind_speed,
      windFrom: d.instant.details.wind_from_direction,
      rain: next?.details?.precipitation_amount,
      later: d.next_6_hours
        ? { symbol: d.next_6_hours.summary.symbol_code, rain: d.next_6_hours.details?.precipitation_amount }
        : undefined,
    },
  };
}

const memo = new Map<string, { until: number; body: WeatherBody }>();

const json = (body: unknown, status: number, maxAge: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${Math.min(maxAge, 600)}, s-maxage=${maxAge}`,
      "Access-Control-Allow-Origin": "*",
    },
  });

const coarse = (x: number) => Math.round(x * 10) / 10;

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url, "http://local").searchParams;
  const lat = Number(q.get("lat") ?? NaN);
  const lng = Number(q.get("lng") ?? NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: "Give a lat and lng." }, 400, 60);
  }
  const at = { lat: coarse(lat), lng: coarse(lng) };
  const key = `${at.lat},${at.lng}`;
  const known = memo.get(key);
  if (known && Date.now() < known.until) return json(known.body, 200, Math.round((known.until - Date.now()) / 1000));
  try {
    const res = await fetch(`${SOURCE}?lat=${at.lat}&lon=${at.lng}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`MET Norway answered ${res.status}`);
    const expires = Date.parse(res.headers.get("Expires") ?? "") || Date.now() + 30 * 60 * 1000;
    const until = Math.min(Math.max(expires, Date.now() + 10 * 60 * 1000), Date.now() + MAX_MS);
    const body: WeatherBody = { at, ...compactForecast(await res.json()), expires: new Date(until).toISOString(), credit: CREDIT };
    if (memo.size >= MAX_PLACES) memo.delete(memo.keys().next().value as string);
    memo.set(key, { until, body });
    return json(body, 200, Math.round((until - Date.now()) / 1000));
  } catch (err) {
    if (known) return json({ ...known.body, stale: true }, 200, 120);
    return json({ error: `The weather is unavailable right now (${(err as Error).message}).` }, 502, 60);
  }
}
