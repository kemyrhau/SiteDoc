import { defineConfig } from "vitest/config";

/**
 * Mobil-harness (2026-09-16, ordre mobil-harness). Samme runner som api/pdf/shared/web —
 * én konvensjon i monorepoet. Kjører KUN ren TS: rene utils og offline-DB-laget, der
 * `react-native`/`expo-sqlite` mockes i testfila (RN-komponenter testes ikke her).
 *
 * Metro og EAS røres ikke: denne fila leses aldri av Metro (kun av vitest-CLI), og
 * `*.test.ts` importeres ikke av produksjonskode → havner aldri i bundelen.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
