/**
 * Pause-bevisst tidsberegning for timer-rader (Fase 1, 2026-07-08).
 *
 * 30 min pause (`standardPauseMin`) er obligatorisk i løpet av arbeidsdagen og
 * ligger i vinduet [`pauseVinduFra(skiftStart, standardPauseEtterTimer)`,
 * +`standardPauseMin`] — dvs. relativt til skiftets start (default 4,0 t inn →
 * 07:00-start gir 11:00–11:30). Når en timer-rad faktisk spenner over
 * pausevinduet, trekkes overlappen fra radens effektive timer:  antall =
 * spennvidde − overlapp (eks. 10:00–12:00 med pause 11:00–11:30 → 1,50 t).
 *
 * Full auto-synk mellom «antall timer» og «fra/til»:
 *   - endrer fra/til → antall = effektiveTimerFraSpenn(...)
 *   - skriver antall → til   = tilFraAntall(...) (pausevinduet skyves inn når
 *     arbeidet krysser lunsj)
 *
 * KUN mobil-flyt foreløpig (mobil-først, jf. mobil-dagsseddel-ui-spec) — ikke
 * speilet i web-lib.
 */

/** Firma-default: pause starter 4,0 t inn i skiftet når org ikke har konfigurert. */
export const DEFAULT_PAUSE_ETTER_TIMER = 4.0;

/**
 * Pausevindu-start (HH:MM) = skiftstart + `etterTimer` timer. Erstatter det
 * gamle faste klokkeslettet (`standardPauseFra`) — pausen faller nå naturlig
 * innenfor skiftet uansett tid på døgnet (07:00-start → 11:00; nattskift
 * 21:00-start → 01:00).
 */
export function pauseVinduFra(skiftStart: string, etterTimer: number): string {
  return minTilHhmm(hhmmTilMin(skiftStart) + Math.round(etterTimer * 60));
}

/** HH:MM → minutter siden midnatt. Ugyldig input → 0. */
export function hhmmTilMin(hhmm: string): number {
  const deler = hhmm.split(":");
  const t = Number(deler[0] ?? 0);
  const m = Number(deler[1] ?? 0);
  if (isNaN(t) || isNaN(m)) return 0;
  return t * 60 + m;
}

/** Minutter siden midnatt → HH:MM. Clampes til 00:00–23:59 (samme dag). */
export function minTilHhmm(min: number): string {
  const clamped = Math.max(0, Math.min(Math.round(min), 23 * 60 + 59));
  const t = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(t).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Overlapp i minutter mellom radens spenn [fraMin, tilMin] og pausevinduet
 * [pauseFraMin, pauseFraMin + pauseMin]. 0 når raden ikke berører pausen.
 */
export function pauseOverlappMin(
  fraMin: number,
  tilMin: number,
  pauseFraMin: number,
  pauseMin: number,
): number {
  const pauseSlutt = pauseFraMin + pauseMin;
  return Math.max(0, Math.min(tilMin, pauseSlutt) - Math.max(fraMin, pauseFraMin));
}

/**
 * Effektive arbeidstimer for en rad = (spennvidde − pauseoverlapp) / 60.
 * Returnerer 0 når til ≤ fra. Avrundet til 2 desimaler.
 */
export function effektiveTimerFraSpenn(
  fra: string,
  til: string,
  pauseFra: string,
  pauseMin: number,
): number {
  const fraMin = hhmmTilMin(fra);
  const tilMin = hhmmTilMin(til);
  if (tilMin <= fraMin) return 0;
  const overlapp = pauseOverlappMin(fraMin, tilMin, hhmmTilMin(pauseFra), pauseMin);
  return Math.round(((tilMin - fraMin - overlapp) / 60) * 100) / 100;
}

/**
 * Til-tid gitt fra + antall ARBEIDStimer, med pausevinduet skjøvet inn når
 * arbeidet krysser lunsj. Speiler `effektiveTimerFraSpenn` (invers):
 *   fra 10:00 + 1,5 t → 12:00  (30 min lunsj legges til når vi passerer 11:00)
 *   fra 09:00 + 2,0 t → 11:00  (rekker akkurat frem til lunsj, ingen pause)
 * Starter raden i/etter pausevinduet, legges ingen (ny) pause inn.
 */
export function tilFraAntall(
  fra: string,
  antallTimer: number,
  pauseFra: string,
  pauseMin: number,
): string {
  const fraMin = hhmmTilMin(fra);
  const antallMin = Math.round(antallTimer * 60);
  const pauseFraMin = hhmmTilMin(pauseFra);
  const pauseSlutt = pauseFraMin + pauseMin;
  // Starter i eller etter pausevinduet → pausen ligger allerede før raden.
  if (fraMin >= pauseFraMin) return minTilHhmm(fraMin + antallMin);
  // Arbeidskapasitet før lunsj.
  const forPause = pauseFraMin - fraMin;
  if (antallMin <= forPause) return minTilHhmm(fraMin + antallMin);
  // Arbeidet krysser lunsj → skyv resten forbi pausevinduet.
  return minTilHhmm(pauseSlutt + (antallMin - forPause));
}
