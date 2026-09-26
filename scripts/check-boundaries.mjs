// Keeps the layers honest (after gods-eye-view's import-direction gates):
//   src/core    pure maths: imports nothing outside src/core, touches no DOM.
//   src/mapbox  may import core; imports mapbox-gl for TYPES only; never the site.
//   site/       may import the package by its public names only.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|mts|js|mjs)$/.test(f) ? [p] : [];
  });

const problems = [];
const imports = (src) => [...src.matchAll(/^\s*(import|export)\s+(type\s+)?[^'"]*?from\s+["']([^"']+)["']/gm)].map((m) => ({ typeOnly: !!m[2], spec: m[3] }));

for (const file of walk(join(root, "src"))) {
  const rel = relative(root, file).split(sep).join("/");
  const src = readFileSync(file, "utf8");
  for (const { typeOnly, spec } of imports(src)) {
    if (rel.startsWith("src/core/")) {
      if (!spec.startsWith("./")) problems.push(`${rel}: core must stay self-contained, imports "${spec}"`);
    }
    if (rel.startsWith("src/mapbox/")) {
      if (spec.includes("site")) problems.push(`${rel}: mapbox layer imports the site ("${spec}")`);
      if (spec === "mapbox-gl" && !typeOnly) problems.push(`${rel}: mapbox-gl must be a type-only import; the host brings the runtime`);
    }
  }
  if (rel.startsWith("src/core/")) {
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const g of ["document", "window", "navigator", "localStorage", "fetch("]) {
      if (new RegExp(`\\b${g.replace("(", "\\(")}`).test(code)) problems.push(`${rel}: core touches "${g}"`);
    }
  }
}

for (const file of walk(join(root, "site", "src"))) {
  const rel = relative(root, file).split(sep).join("/");
  for (const { spec } of imports(readFileSync(file, "utf8"))) {
    if (spec.includes("../src") || spec.includes("../../src")) problems.push(`${rel}: import the package by name, not "${spec}"`);
  }
}

if (problems.length) {
  console.error("Boundary check failed:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("Boundaries hold.");
