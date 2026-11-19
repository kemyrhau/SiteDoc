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
