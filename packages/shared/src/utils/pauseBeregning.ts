/**
 * Pause-bevisst tidsberegning for timer-rader.
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
 * Opprinnelig mobil-only (`apps/mobile/src/utils/pauseBeregning.ts`); løftet hit
 * for web-paritet (D3, timer web-vs-mobil-paritet 2026-07-08). Ren, uten
 * avhengigheter — deles av mobil og web, jf. `maskinKapasitet.ts`.
 */

/** Firma-default: pause starter 4,0 t inn i skiftet når org ikke har konfigurert. */
export const DEFAULT_PAUSE_ETTER_TIMER = 4.0;

/**
 * F-e (2026-07-13, AML §10-9): pausefradrag gjelder først når den DAGLIGE
 * arbeidstiden overstiger 5,5 t. Under terskelen trekkes ingen pause. Fast
 * lovkonstant (ikke per-firma) — kan promoteres til org-innstilling senere om en
 * tariff-kunde krever det (jf. `arbeidstidVarselTimer`-mønsteret; BACKLOG-post).
 */
export const PAUSE_TERSKEL_TIMER = 5.5;

/**
 * Effektiv pause-lengde (min) for en dag, gitt dagens TOTALE brutto arbeidstimer
 * (sum av rad-spenn FØR fradrag). Returnerer `standardPauseMin` over terskel,
 * ellers 0 (ingen pause). Gaten ligger her fordi den er DAGSTOTAL-basert, ikke
 * per rad — en dag splittet i flere rader skal verken miste eller få pause
 * avhengig av rad-splitten (F-e; radspenn-basis avvist = 38-min-avviket).
 * Kalleren summerer sedelens rader og sender totalen inn; de rene per-rad-
 * helperne (`effektiveTimerFraSpenn`/`tilFraAntall`) får da `pauseMin=0` når
 * terskelen ikke er nådd, og trekker dermed ingen pause.
 */
export function pauseMinForDag(
  dagsTotalBruttoTimer: number,
  standardPauseMin: number,
): number {
  return dagsTotalBruttoTimer > PAUSE_TERSKEL_TIMER ? standardPauseMin : 0;
}

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
 *   fra 11:15 + 2,0 t → 13:30  (starter inne i vinduet — kun resterende pause
 *                               11:15–11:30 skyves inn, ikke hele 30 min)
 * Starter raden i/etter pauseslutt, legges ingen (ny) pause inn.
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
  // Starter raden i eller etter HELE pausevinduet → pausen ligger før raden.
  // (Grensefiks 2026-07-09: tidligere `>= pauseFraMin` hoppet over pausen når
  // raden startet nøyaktig ved pausestart eller inne i vinduet → ikke lenger
  // invers av effektiveTimerFraSpenn ved fraMin i [pauseFraMin, pauseSlutt).)
  if (fraMin >= pauseSlutt) return minTilHhmm(fraMin + antallMin);
  // Arbeidskapasitet før lunsj — clampes til 0 når raden starter inne i vinduet.
  const forPause = Math.max(0, pauseFraMin - fraMin);
  if (antallMin <= forPause) return minTilHhmm(fraMin + antallMin);
  // Krysser (eller starter inne i) lunsj → skyv resten forbi pausevinduet.
  return minTilHhmm(pauseSlutt + (antallMin - forPause));
}
