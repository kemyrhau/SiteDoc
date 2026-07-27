import { defineConfig, devices } from "@playwright/test";
import { BASE_URL } from "./lib/miljo";

/**
 * Røyk-suite mot test.sitedoc.no. Bevisst smal og streng:
 *  - retries: 0 — en flaky test fikses/fjernes samme dag, aldri maskeres av retry.
 *  - workers: 1 — delt test-DB; serielt unngår kappløp på felles prosjektdata.
 *  - globalSetup minter dev-login-tokens; globalTeardown soft-sletter runId-docs.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
