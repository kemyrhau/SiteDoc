/**
 * Next-instrumentation — kjører når web-prosessen starter.
 *
 * Boot-guard (S1, lærdom 2026-08-07): tRPC-serveren kjører i WEB-containeren via
 * route-handleren `app/api/trpc/[...trpc]/route.ts` som importerer `appRouter`.
 * Signeringen av `/uploads/privat/`-URL-er skjer derfor HER, ikke i api. En
 * manglende `FIL_SIGNING_SECRET` i web-prosessen ga et helt døgn med 207-svar
 * («dagsseddelen finnes ikke») fordi feilen først slo til ved bruk. Denne guarden
 * feiler i stedet ved boot i produksjon — samme delte sjekk som api bruker.
 */
export async function register() {
  // Kun node-runtime signerer/verifiserer (crypto). Edge-runtime hopper over.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertFilSigneringEnv } = await import("@sitedoc/api/src/utils/hmac");
    assertFilSigneringEnv("web");
  }
}
