import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Tests resolve the package's public names to source, as the site does.
export default defineConfig({
  resolve: {
    alias: {
      "now-on-earth/core": here("./src/core/index.ts"),
      "now-on-earth/mapbox": here("./src/mapbox/index.ts"),
    },
  },
});
