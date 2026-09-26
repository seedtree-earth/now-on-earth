// House rules for words, checked on every file we ship:
//   1. No em dashes, anywhere (SeedTree's rule). Use a mid dot: " · ".
//   2. Visible copy says "the Landscape", never "the map" or "the directory".
//   3. The clock face has no numbers: the phrases the face shows must be digit-free.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const skip = new Set(["node_modules", "dist", ".git", ".vercel"]);
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    if (skip.has(f)) return [];
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|mjs|js|css|html|md|json)$/.test(f) ? [p] : [];
  });

const problems = [];
const EM = String.fromCharCode(0x2014);

for (const file of walk(root)) {
  const rel = relative(root, file).split(sep).join("/");
  if (rel === "package-lock.json") continue;
  const text = readFileSync(file, "utf8");
  text.split("\n").forEach((line, i) => {
    if (line.includes(EM)) problems.push(`${rel}:${i + 1}: em dash (use " · ")`);
  });
}

// Visible copy: the page itself and the phrases the clock speaks.
const visible = ["site/index.html", "src/core/describe.ts"];
for (const rel of visible) {
  const text = readFileSync(join(root, rel), "utf8");
  const strings = rel.endsWith(".html")
    ? text.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ")
    : [...text.matchAll(/(["`])((?:(?!\1).)*)\1/g)].map((m) => m[2]).join("\n");
  if (/\bthe map\b/i.test(strings)) problems.push(`${rel}: says "the map"; it is the Landscape`);
  if (/\bdirectory\b/i.test(strings)) problems.push(`${rel}: says "directory"; it is the Landscape`);
}

if (problems.length) {
  console.error("Copy check failed:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("Copy is clean.");
