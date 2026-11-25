import type { OppmoteResultat, ReiseKategori, ReiseKortResultat, ManuellReiseSpor } from "@sitedoc/shared";

/* ============================================================================
 *  O22 (vedtak-timer-web.md § Reisevinduet pkt 28, Kenneth 2026-11-25): mobilens
 *  reise-kort uten oppmøtested.
 *
 *  Mangler oppmøtestedet, gir `løsReiseKort` manuell modus (`utenKjoretid:
 *  "utenOppmote"`): tidspunktet som henger på arbeidet er fylt ut, arbeideren
 *  skriver det andre. Ren logikk — ingen nettkall, ingen RN — så kortet virker
 *  offline og reglene kan testes uten simulator.
 * ============================================================================ */

/** Arbeiderens egne valg i manuell modus. Nullstilles når retningen byttes. */
export type ReiseKortManuellValg = {
  startTid: string | null;
  sluttTid: string | null;
  /** km-firma: avhuket «Reisen er mer enn …» → reisetid; ellers firmaets under-type. */
  kategoriValg: ReiseKategori | null;
};

export const TOMT_MANUELL_VALG: ReiseKortManuellValg = { startTid: null, sluttTid: null, kategoriValg: null };

/**
 * Feltene `løsReiseKort` får fra arbeideren. Bare når oppmøtestedet mangler — med valgt
 * sted regnes reisen som før (O22 pkt 3), og ingenting arbeideren skrev blander seg inn.
 */
export function manuellReiseInput(
  oppmote: OppmoteResultat,
  valg: ReiseKortManuellValg,
): Partial<ReiseKortManuellValg> {
  if (oppmote.kilde !== "ikkeValgt") return {};
  return { startTid: valg.startTid, sluttTid: valg.sluttTid, kategoriValg: valg.kategoriValg };
}

/** O22: kortet er i manuell modus (tidsfelt + blå hint). */
export function erUtenOppmote(resultat: ReiseKortResultat): boolean {
  return resultat.utenKjoretid === "utenOppmote";
}

/**
 * Lagre virker når resultatet har tid, art og spor og ingen sperre. Slutt før (eller lik)
 * start gir 0 timer — sperret med «Slutt-tid må være etter start-tid» (samme regel som web).
 */
export function reiseKortKanLagre(a: {
  resultat: ReiseKortResultat;
  kontorKonflikt: boolean;
  aktivitetId: string | null;
}): boolean {
  const r = a.resultat;
  return (
    r.sperre == null &&
    !a.kontorKonflikt &&
    !!a.aktivitetId &&
    !!r.spor &&
    !!r.klassifisering?.lonnsartId &&
    !!r.fraTid &&
    !!r.tilTid &&
    r.timer > 0
  );
}

/** Slutt er skrevet og ikke etter start — egen forklaring i kortet. */
export function reiseKortSluttForStart(resultat: ReiseKortResultat): boolean {
  return resultat.sperre == null && !!resultat.fraTid && !!resultat.tilTid && resultat.timer <= 0;
}

export type ReiseKortRad = {
  lonnsartId: string;
  timer: number;
  fraTid: string;
  tilTid: string;
  reiseSpor: ManuellReiseSpor;
};

/** Raden kortet gir videre til `onLagre` (kalleren skriver den lokalt). null = sperret. */
export function reiseKortRad(a: {
  resultat: ReiseKortResultat;
  kontorKonflikt: boolean;
  aktivitetId: string | null;
}): ReiseKortRad | null {
  if (!reiseKortKanLagre(a)) return null;
  const r = a.resultat;
  return {
    lonnsartId: r.klassifisering!.lonnsartId!,
    timer: r.timer,
    fraTid: r.fraTid!,
    tilTid: r.tilTid!,
    reiseSpor: r.spor!,
  };
}
