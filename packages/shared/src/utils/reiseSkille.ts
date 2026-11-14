// ============================================================================
//  Skille reisetid fra arbeid (ordre 2026-11-14 (6), Kenneth-hjemmel)
//
//  Tre delte regler — web, mobil og server leser samme kilde:
//    1. løsReiseKnappLonnsart: hvilken lønnsart «+ Reise» fører på (eller om
//       knappen skjules).
//    2. arbeidUtenReise: arbeidstimer som maskin-kontrollen og «Arbeidstimer
//       (N t)» måles mot — uten reise og uten erstattede rader.
//    3. sendDagenTekst: «Send dagen (7,5 t · reise 2 t)» / «Send dagen (7,5 t)».
// ============================================================================

import { REISE_LONNSART_REGEX } from "./reise";

/** Minste lønnsart-form resolveren trenger (Prisma, tRPC og mobil-SQLite). */
export interface ReiseKnappLonnsart {
  id: string;
  navn: string;
  type: string;
  aktiv: boolean;
}

/**
 * Resultat for «+ Reise»:
 *  - `valgt`: firmaet har valgt reise-lønnsart eksplisitt.
 *  - `automatisk`: ingen eksplisitt valg, men nøyaktig ÉN aktiv ordinær
 *    lønnsart matcher navne-regelen.
 *  - `ingen`: ingen kandidat — knappen skjules.
 *  - `flere`: ≥ 2 kandidater uten eksplisitt valg — knappen skjules til
 *    firmaadmin velger én.
 */
export type ReiseKnappResultat =
  | { status: "valgt"; lonnsartId: string }
  | { status: "automatisk"; lonnsartId: string }
  | { status: "ingen" }
  | { status: "flere"; kandidater: string[] };

/** Aktive ordinære lønnsarter hvis navn matcher reise-regelen. */
export function reiseLonnsartKandidater(
  lonnsarter: readonly ReiseKnappLonnsart[],
): ReiseKnappLonnsart[] {
  return lonnsarter.filter(
    (l) => l.aktiv && l.type === "ordinaer" && REISE_LONNSART_REGEX.test(l.navn),
  );
}

/**
 * ÉN resolver for hvilken lønnsart «+ Reise» fører på.
 *
 * Eksplisitt valg (`OrganizationSetting.reiseLonnsartId`) vinner når arten
 * finnes og er aktiv. Er den deaktivert/slettet, blir resultatet `ingen` — IKKE
 * navne-regelen: serverens `erReiseLonnsart` bruker ikke navne-match når et
 * valg er satt, så en regex-fallback ville gitt en rad serveren avviser.
 * Automatisk (ingen valg) krever nøyaktig én aktiv ordinær match; to eller
 * flere er tvetydig og skjuler knappen.
 */
export function løsReiseKnappLonnsart(
  reiseLonnsartId: string | null | undefined,
  lonnsarter: readonly ReiseKnappLonnsart[],
): ReiseKnappResultat {
  if (reiseLonnsartId) {
    const valgt = lonnsarter.find((l) => l.id === reiseLonnsartId);
    if (valgt && valgt.aktiv) return { status: "valgt", lonnsartId: valgt.id };
    return { status: "ingen" };
  }
  const kandidater = reiseLonnsartKandidater(lonnsarter);
  if (kandidater.length === 1) {
    return { status: "automatisk", lonnsartId: kandidater[0]!.id };
  }
  if (kandidater.length === 0) return { status: "ingen" };
  return { status: "flere", kandidater: kandidater.map((k) => k.id) };
}

/** Rad-form for arbeid/reise-summer (timer kan være Decimal/streng/number). */
export interface ArbeidReiseRad {
  timer: unknown;
  erReise?: boolean | null;
  attestertStatus?: string | null;
}

function tilTall(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Arbeid og reise hver for seg. Erstattede rader (attestertStatus
 * "erstattet") teller ikke — samme regel som prosjektkortets summer.
 */
export function arbeidOgReise(rader: readonly ArbeidReiseRad[]): {
  arbeid: number;
  reise: number;
} {
  let arbeid = 0;
  let reise = 0;
  for (const r of rader) {
    if (r.attestertStatus === "erstattet") continue;
    if (r.erReise) reise += tilTall(r.timer);
    else arbeid += tilTall(r.timer);
  }
  return { arbeid, reise };
}

/**
 * Arbeidstimer uten reise og uten erstattede rader — grunnlaget for
 * maskin-kontrollen (maskin ≤ arbeid + pause) og «Arbeidstimer (N t)».
 */
export function arbeidUtenReise(rader: readonly ArbeidReiseRad[]): number {
  return arbeidOgReise(rader).arbeid;
}

export type SendDagenTekst =
  | { nokkel: "timer.detalj.sendPaaNytt" }
  | { nokkel: "timer.prosjektkort.sendDagen"; timer: number }
  | { nokkel: "timer.prosjektkort.sendDagenMedReise"; timer: number; reise: number };

/**
 * Tekst på «Send dagen»-knappen: arbeid uten reise, og reise separat når > 0.
 * Returnert sedel viser «Send på nytt» uansett.
 */
export function sendDagenTekst(
  status: string,
  arbeid: number,
  reise: number,
): SendDagenTekst {
  if (status === "returned") return { nokkel: "timer.detalj.sendPaaNytt" };
  if (reise > 0) {
    return { nokkel: "timer.prosjektkort.sendDagenMedReise", timer: arbeid, reise };
  }
  return { nokkel: "timer.prosjektkort.sendDagen", timer: arbeid };
}
