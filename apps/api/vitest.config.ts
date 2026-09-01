import { defineConfig } from "vitest/config";

/**
 * Default-konfig for `pnpm test` (turbo/CI) — kvalitetssikring-plan.md lag 3.
 *
 * Kjører KUN enhets-/rene tester. Integrasjonstester (`*.integration.test.ts`)
 * krever DB + `DATABASE_URL` og er eksplisitt ekskludert — de kjøres separat via
 * `pnpm test:integration` (se vitest.integration.config.ts, cowork-gatet).
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
  },
});
