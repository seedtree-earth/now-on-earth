import { defineConfig } from "tsup";

export default defineConfig({
  entry: { "core/index": "src/core/index.ts", "mapbox/index": "src/mapbox/index.ts" },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["mapbox-gl"],
});
