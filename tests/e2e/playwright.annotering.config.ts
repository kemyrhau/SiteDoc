import { defineConfig, devices } from "@playwright/test";

/**
 * Lokal berørings-suite for den delte annoterings-HTML-en (RETUR velg-alle, 2026-10-28).
 * Ingen innlogging og ingen test.sitedoc.no: HTML-en bygges fra kildekoden og Fabric hentes fra
 * cdnjs (samme URL som appen). Kjøres med:
 *   pnpm --filter @sitedoc/e2e exec playwright test -c playwright.annotering.config.ts
 * Chromium (iPhone 13-emulering) fordi bare CDP kan injisere ekte touch-DRA (touchmove);
 * Playwrights WebKit kan bare `touchscreen.tap()`.
 */
export default defineConfig({
  testDir: "./annotering",
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  projects: [{ name: "chromium-iphone", use: { ...devices["iPhone 13"], browserName: "chromium" } }],
});
