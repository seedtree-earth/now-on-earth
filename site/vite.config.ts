import { fileURLToPath } from "node:url";
import { type Plugin, defineConfig } from "vite";
import { GET as aurora } from "../api/aurora";
import { GET as hazards } from "../api/hazards";
import { GET as weather } from "../api/weather";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * In development, serve the same functions Vercel runs from /api, so the
 * site behaves locally as it does deployed.
 */
const devApi = (): Plugin => ({
  name: "now-on-earth-dev-api",
  configureServer(server) {
    for (const [path, handler] of [
      ["/api/aurora", aurora],
      ["/api/hazards", hazards],
      ["/api/weather", weather],
    ] as const) {
      server.middlewares.use(path, async (req, res) => {
        const r = await handler(new Request(`http://localhost${req.originalUrl ?? req.url}`));
        res.statusCode = r.status;
        r.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await r.text());
      });
    }
  },
});

/**
 * The standalone site imports the library by its published names, resolved to
 * source here, so the site always runs exactly what the package exports.
 */
export default defineConfig({
  root: here("."),
  envDir: here(".."),
  publicDir: here("public"),
  plugins: [devApi()],
  resolve: {
    alias: {
      "now-on-earth/core": here("../src/core/index.ts"),
      "now-on-earth/mapbox": here("../src/mapbox/index.ts"),
      "now-on-earth/events": here("../events"),
    },
  },
  build: {
    outDir: here("dist"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5173, strictPort: true },
});
