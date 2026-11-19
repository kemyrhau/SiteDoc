// ============================================================================
//  Maskin → timerad (kort-id-spec § 12.2 R24, H12, H15 = A).
//
//  Én regel for hvilke maskiner som krever en timerad, og om koblingen en
//  maskinrad har er gyldig. Brukes av serveren (attestantens skriveveier,
//  leserne), og av nettleseren og telefonen når d2b/d2c bygges.
//
//  «Arbeid» er det samme som maskin-taket bruker: `arbeidUtenReise` i
//  reiseSkille.ts (reise og erstattede rader gir 0). Maskin-taket
//  (maskinKapasitet.ts, pr. jobb fra w9) kommer i tillegg, og bruker
//  maskinKreverTimerad for hvilke maskiner som krever fører.
// ============================================================================

import { arbeidUtenReise } from "./reiseSkille";

/**
 * R24: krever maskinen en timerad? «time» ja, «doegn» nei. Ikke satt enhet
 * krever timerad (H15 = A, Kenneth 2026-11-16).
 */
export function maskinKreverTimerad(utleieEnhet: string | null | undefined): boolean {
  return utleieEnhet !== "doegn";
}

/** Timeraden koblingen vurderes mot. */
export interface KoblingTimerRad {
  id: string;
  /** Sedelen raden står på. Utelatt → kalleren har bare sendt én sedels rader. */
  sheetId?: string | null;
  kortId: string | null;
  /** null = fravær uten prosjekt (§ 11) — teller ikke som arbeid. */
  projectId: string | null;
  timer: number;
  erReise?: boolean | null;
  attestertStatus?: string | null;
}

/** Maskinraden som vurderes. */
export interface KoblingMaskinRad {
  sheetId?: string | null;
  kortId: string | null;
  sheetTimerId?: string | null;
  utleieEnhet?: string | null;
}

/**
 * Er koblingen gyldig (R24)? Timeraden finnes, står på samme sedel og i samme
 * kort, er ikke reise, er ikke fravær uten prosjekt og har mer enn 0 timer
 * arbeid. Enheten vurderes ikke her.
 */
export function erGyldigTimeradKobling(
  maskin: KoblingMaskinRad,
  timerader: readonly KoblingTimerRad[],
): boolean {
  if (!maskin.sheetTimerId) return false;
  const t = timerader.find((r) => r.id === maskin.sheetTimerId);
  if (!t) return false;
  if (maskin.sheetId != null && t.sheetId != null && maskin.sheetId !== t.sheetId) return false;
  if ((maskin.kortId ?? null) !== (t.kortId ?? null)) return false;
  if (t.projectId === null) return false;
  return arbeidUtenReise([{ timer: t.timer, erReise: t.erReise, attestertStatus: t.attestertStatus }]) > 0;
}

/** Timerad med fra–til, for valg av rad (w9-tillegget). */
export interface KandidatTimerRad extends KoblingTimerRad {
  fraTid?: string | null;
  tilTid?: string | null;
}

function minutter(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function overlappMin(a: { fraTid?: string | null; tilTid?: string | null }, b: { fraTid?: string | null; tilTid?: string | null }): number {
  const [af, at, bf, bt] = [minutter(a.fraTid), minutter(a.tilTid), minutter(b.fraTid), minutter(b.tilTid)];
  if (af === null || at === null || bf === null || bt === null) return 0;
  return Math.max(0, Math.min(at, bt) - Math.max(af, bf));
}

/**
 * w9-tillegget (R24, «alt som kan utledes, utledes»): timeraden en maskin som
 * mangler gyldig kobling, kobles til. Kandidater er rader i samme sedel og jobb
 * (`kortId`) som er gyldige koblinger (`erGyldigTimeradKobling`). Har maskinen
 * fra–til, vinner størst overlapp (> 0); ellers flest timer. Likt → tidligste
 * fra-tid, så rekkefølgen radene er gitt i. `null` = jobben har ikke arbeid.
 */
export function velgTimeradForMaskin(
  maskin: { sheetId?: string | null; kortId: string | null; fraTid?: string | null; tilTid?: string | null },
  timerader: readonly KandidatTimerRad[],
): string | null {
  const kandidater = timerader
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => erGyldigTimeradKobling({ sheetId: maskin.sheetId, kortId: maskin.kortId, sheetTimerId: t.id }, [t]));
  if (kandidater.length === 0) return null;
  const fraEllerSist = (t: KandidatTimerRad) => minutter(t.fraTid) ?? Number.MAX_SAFE_INTEGER;
  const etterStorrelse = [...kandidater].sort(
    (a, b) => b.t.timer - a.t.timer || fraEllerSist(a.t) - fraEllerSist(b.t) || a.i - b.i,
  );
  const medOverlapp = etterStorrelse
    .map((k) => ({ ...k, o: overlappMin(maskin, k.t) }))
    .filter((k) => k.o > 0)
    .sort((a, b) => b.o - a.o); // stabil: likt overlapp beholder størrelsesrekkefølgen
  return (medOverlapp[0] ?? etterStorrelse[0])!.t.id;
}

/**
 * Maskinene som krever timerad og mangler gyldig kobling (merket «Maskin uten
 * timerad», og sperren i attestantens veier). Døgn-maskiner gis aldri tilbake.
 */
export function finnMaskinerUtenTimerad<M extends KoblingMaskinRad>(
  maskiner: readonly M[],
  timerader: readonly KoblingTimerRad[],
): M[] {
  return maskiner.filter(
    (m) => maskinKreverTimerad(m.utleieEnhet) && !erGyldigTimeradKobling(m, timerader),
  );
}
