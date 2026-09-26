import type { GeoJSONSource } from "mapbox-gl";
import type { LayerContext } from "../types.js";

type Data = Parameters<GeoJSONSource["setData"]>[0];

/** Add or refresh a GeoJSON source. */
export function setSource(ctx: LayerContext, name: string, data: unknown): void {
  const id = ctx.id(name);
  const src = ctx.map.getSource(id) as GeoJSONSource | undefined;
  if (src) src.setData(data as Data);
  else ctx.map.addSource(id, { type: "geojson", data: data as Data, tolerance: 0.2 });
}

export function removeAll(ctx: LayerContext, layers: string[], sources: string[]): void {
  for (const l of layers) if (ctx.map.getLayer(ctx.id(l))) ctx.map.removeLayer(ctx.id(l));
  for (const s of sources) if (ctx.map.getSource(ctx.id(s))) ctx.map.removeSource(ctx.id(s));
}

export function setVisibility(ctx: LayerContext, layers: string[], visible: boolean): void {
  for (const l of layers) {
    if (ctx.map.getLayer(ctx.id(l))) {
      ctx.map.setLayoutProperty(ctx.id(l), "visibility", visible ? "visible" : "none");
    }
  }
}

/** Only pass beforeId when that layer actually exists on the map. */
export function before(ctx: LayerContext): string | undefined {
  return ctx.beforeId && ctx.map.getLayer(ctx.beforeId) ? ctx.beforeId : undefined;
}
