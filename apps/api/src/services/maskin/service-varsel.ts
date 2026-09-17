/**
 * Service pr. timetall — ren beregning (kundeønske #1, 2026-09-18).
 *
 * To rene funksjoner, ingen I/O:
 *  - beregnNesteService: fremskriving (del C). Neste service = driftstimer ved
 *    service + intervall. Returnerer null når intervall mangler — INGEN automatikk
 *    uten et intervall (Kenneth 2026-09-18: manuelt, ingen oppdiktet default).
 *  - beregnServiceVarsel: terskelstatus (del D). Speiler EuKontrollBanner-trappa,
 *    men i driftstimer i stedet for dager.
 *
 * Både api (fremskriving + test) og web (banner) trenger logikken. shared er
 * frosset denne runden, så den bor her; web-banneret inlinet samme trapp slik
 * EuKontrollBanner allerede gjør for dager.
 */

export type ServiceVarselStatus = "forfalt" | "snart" | "planlagt" | "ok";

// Terskler i driftstimer (justerbart via Kenneths visuelle gate).
export const SERVICE_VARSEL_SNART_TIMER = 50; // oransje: service rett rundt hjørnet
export const SERVICE_VARSEL_PLANLAGT_TIMER = 200; // gul: planlegg service

/**
 * Fremskriving: neste service = driftstimer ved service + intervall.
 * Returnerer null når intervallet ikke er satt (ingen fremskriving mulig).
 */
export function beregnNesteService(
  timerVedService: number,
  serviceIntervallTimer: number | null | undefined,
): number | null {
  if (serviceIntervallTimer == null || serviceIntervallTimer <= 0) return null;
  return timerVedService + serviceIntervallTimer;
}

/**
 * Terskelstatus for maskin-detalj-banneret. Null når det ikke finnes grunnlag
 * for et varsel (ingen framskrevet terskel eller ingen kjent driftstimer).
 */
export function beregnServiceVarsel(
  driftstimer: number | null | undefined,
  nesteServiceTimer: number | null | undefined,
): { status: ServiceVarselStatus; timerIgjen: number } | null {
  if (nesteServiceTimer == null || driftstimer == null) return null;
  const timerIgjen = nesteServiceTimer - driftstimer;
  if (timerIgjen < 0) return { status: "forfalt", timerIgjen };
  if (timerIgjen < SERVICE_VARSEL_SNART_TIMER) return { status: "snart", timerIgjen };
  if (timerIgjen < SERVICE_VARSEL_PLANLAGT_TIMER)
    return { status: "planlagt", timerIgjen };
  return { status: "ok", timerIgjen };
}
