/**
 * GET /api/hazards · major earthquakes, wildfires and eruptions, lightened and
 * cached. Three sources, fetched at most once every ten minutes between them
 * and served from the CDN, so the sources see three requests per ten minutes
 * rather than one per visitor:
 *
 *   · Earthquakes: USGS "Significant Earthquakes, Past Month" (public domain).
 *     USGS's significance blends magnitude, how widely a quake was felt, and
 *     its impact.
 *   · Wildfires: GDACS wildfire alerts at orange or red, the past two months.
 *   · Volcanoes: GDACS eruption alerts at orange or red, the past year.
 *
 * GDACS (the UN and European Commission's Global Disaster Alert and
 * Coordination System) asks to be credited, and its alerts do not replace
 * official warnings. One request each, a User-Agent naming this site, no
 * retries; if a source errors, the last good copy of it is kept.
 */

const USER_AGENT = "now-on-earth/0.1 (+https://github.com/seedtree-earth/now-on-earth)";
const TTL_MS = 10 * 60 * 1000;
const DAY = 86400000;

const USGS = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson";
const GDACS = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH";

export type Quake = { id: string; lng: number; lat: number; mag: number; depth: number; time: string; place: string; url: string; tsunami: boolean };
export type Alert = { id: string; lng: number; lat: number; level: "Orange" | "Red"; from: string; to: string; name: string; country: string; url: string };

export type HazardsPayload = {
  fetched: string;
  credits: { quakes: string; fires: string; volcanoes: string };
  quakes: Quake[];
  fires: Alert[];
  volcanoes: Alert[];
  stale?: string[];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function compactQuakes(raw: { features: Array<{ id: string; geometry: { coordinates: number[] }; properties: Record<string, unknown> }> }): Quake[] {
  return raw.features.map((f) => ({
    id: f.id,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    depth: f.geometry.coordinates[2] ?? 0,
    mag: Number(f.properties.mag),
    time: new Date(Number(f.properties.time)).toISOString(),
    place: String(f.properties.place ?? ""),
    url: String(f.properties.url ?? ""),
    tsunami: Number(f.properties.tsunami) === 1,
  }));
}

export function compactAlerts(raw: { features?: Array<{ geometry: { coordinates: number[] }; properties: Record<string, unknown> }> }): Alert[] {
  return (raw.features ?? [])
    .filter((f) => f.properties.alertlevel === "Orange" || f.properties.alertlevel === "Red")
    .map((f) => {
      const p = f.properties;
      const url = (p.url as { report?: string } | undefined)?.report ?? "https://www.gdacs.org";
      return {
        id: `${p.eventtype}-${p.eventid}`,
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        level: p.alertlevel as "Orange" | "Red",
        from: new Date(String(p.fromdate) + "Z").toISOString(),
        to: new Date(String(p.todate) + "Z").toISOString(),
        name: String(p.name ?? p.eventname ?? "").trim(),
        country: String(p.country ?? ""),
        url,
      };
    });
}

const gdacsUrl = (types: string, days: number) => {
  const now = new Date();
  const p = new URLSearchParams({
    eventlist: types,
    alertlevel: "Orange;Red",
    fromdate: iso(new Date(now.getTime() - days * DAY)),
    todate: iso(now),
  });
  return `${GDACS}?${p}`;
};

let memo: { at: number; body: HazardsPayload } | null = null;

async function getJson(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res.json();
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=600, stale-while-revalidate=300",
      "Access-Control-Allow-Origin": "*",
    },
  });

export async function GET(): Promise<Response> {
  if (memo && Date.now() - memo.at < TTL_MS) return json(memo.body);
  // One at a time, no retries; a failed source keeps its last good copy.
  const stale: string[] = [];
  async function pick<T>(name: "quakes" | "fires" | "volcanoes", url: string, compact: (raw: never) => T[], last: T[]): Promise<T[]> {
    try {
      return compact((await getJson(url)) as never);
    } catch {
      stale.push(name);
      return last;
    }
  }
  const quakes = await pick("quakes", USGS, compactQuakes, memo?.body.quakes ?? []);
  const fires = await pick("fires", gdacsUrl("WF", 60), compactAlerts, memo?.body.fires ?? []);
  const volcanoes = await pick("volcanoes", gdacsUrl("VO", 365), compactAlerts, memo?.body.volcanoes ?? []);
  if (stale.length === 3 && !memo) return json({ error: "The hazard feeds are unavailable right now." }, 502);
  const body: HazardsPayload = {
    fetched: new Date().toISOString(),
    credits: {
      quakes: "U.S. Geological Survey, Significant Earthquakes",
      fires: "Global Disaster Alert and Coordination System, GDACS",
      volcanoes: "Global Disaster Alert and Coordination System, GDACS",
    },
    quakes,
    fires,
    volcanoes,
    ...(stale.length && { stale }),
  };
  memo = { at: Date.now(), body };
  return json(body);
}
