import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * The standalone site imports the library by its published names, resolved to
 * source here, so the site always runs exactly what the package exports.
 */
export default defineConfig({
  root: here("."),
  envDir: here(".."),
  publicDir: here("public"),
  resolve: {
    alias: {
      "now-on-earth/core": here("../src/core/index.ts"),
      "now-on-earth/mapbox": here("../src/mapbox/index.ts"),
    },
  },
  build: {
    outDir: here("dist"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5178 },
});
