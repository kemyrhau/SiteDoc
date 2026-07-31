import { defineConfig } from "vitest/config";

/**
 * Flytmodell Fase 5a — OPT-IN integrasjons-konfig (grense-flagg B, cowork-gatet).
 *
 * Kjøres KUN via `pnpm test:integration` (ikke default `turbo test`), fordi den
 * krever DB + `DATABASE_URL` (localhost-sandkasse, verifisert ikke test/prod).
 * Glob-separert på `*.integration.test.ts`. Sekvensiell (delt DB, ingen isolasjon).
 */
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
