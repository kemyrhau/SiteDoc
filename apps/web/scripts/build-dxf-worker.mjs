#!/usr/bin/env node
// Bygger den frittstående dxf-viewer-worker-bunten med esbuild, FØR next dev/build/
// typecheck (se package.json). Output er en statisk fil i public/workers/ — ALDRI en
// Next-chunk (orkestrator-krav, relay/inbox-dokgen-arbeidstegning-f1.md § "worker-bunt
// med esbuild, GODKJENT"): forrige forsøk brukte Next sin native worker-bundling
// (`new Worker(new URL(..., import.meta.url))`) og en KALD build avslørte en
// manglende-chunk-defekt. Filnavnet er innholds-hashet (cache-busting); `manifest.json`
// forteller klienten hvilket navn som gjelder nå (DxfViewerTegning.tsx henter den).
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const entry = path.join(webDir, "src/workers/dxfViewerWorker.entry.ts");
const outDir = path.join(webDir, "public/workers");

const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
});

const [output] = result.outputFiles;
if (!output) {
  throw new Error("esbuild ga ingen output for dxf-viewer-worker");
}

const hash = createHash("sha256").update(output.contents).digest("hex").slice(0, 10);
const filnavn = `dxf-viewer-worker.${hash}.js`;

await mkdir(outDir, { recursive: true });

// Rydd forrige bunt(er) — ingen opphoping av gamle hash-navngitte filer i public/.
const eksisterende = await readdir(outDir).catch(() => []);
await Promise.all(
  eksisterende
    .filter((f) => /^dxf-viewer-worker\.[0-9a-f]+\.js$/.test(f) && f !== filnavn)
    .map((f) => rm(path.join(outDir, f))),
);

await writeFile(path.join(outDir, filnavn), output.contents);
await writeFile(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ url: `/workers/${filnavn}` }),
);

console.log(`[build-dxf-worker] ${filnavn} (${(output.contents.byteLength / 1024).toFixed(1)} kB)`);
