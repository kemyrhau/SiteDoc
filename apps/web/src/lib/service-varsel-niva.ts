/**
 * Service pr. timetall — terskelnivå for maskin-detalj-banneret (del D).
 *
 * Ren funksjon, speiler api-siden (apps/api/.../service-varsel.ts). Web kan ikke
 * importere fra api, og @sitedoc/shared er frosset denne runden, så logikken bor
 * her — slik EuKontrollBanner allerede inliner sine dags-terskler web-side.
 */

export type ServiceVarselNiva = "forfalt" | "snart" | "planlagt" | "ok" | "ingen";

// Terskler i driftstimer — samme verdier som api (service-varsel.ts).
export const SERVICE_SNART_TIMER = 50;
export const SERVICE_PLANLAGT_TIMER = 200;

export function serviceVarselNiva(
  driftstimer: number | null | undefined,
  nesteServiceTimer: number | null | undefined,
): { niva: ServiceVarselNiva; timerIgjen: number } {
  if (nesteServiceTimer == null || driftstimer == null) {
    return { niva: "ingen", timerIgjen: 0 };
  }
  const timerIgjen = nesteServiceTimer - driftstimer;
  if (timerIgjen < 0) return { niva: "forfalt", timerIgjen };
  if (timerIgjen < SERVICE_SNART_TIMER) return { niva: "snart", timerIgjen };
  if (timerIgjen < SERVICE_PLANLAGT_TIMER) return { niva: "planlagt", timerIgjen };
  return { niva: "ok", timerIgjen };
}
