/**
 * R1 (Kenneth 2026-11-23, (a) og b1): felles regler for arbeiderens sedel — hvilke rader som
 * teller, hva en overlappmelding peker på, og hvilke linjer som kan flyttes på en returnert dag.
 *
 * Ren, uten avhengigheter. Brukt av API-et (`sjekkTimerOverlapp`, `lagreJobbTid`,
 * `flyttHeleJobben`, `flyttJobbTilSted`) og web-dagssiden (modal-sjekk, overlappvarsel,
 * forslag for ny jobb, kortvisning og nedtrekkene for sted og underprosjekt).
 */

import { erArbeidstidReise } from "./arbeidstidReise";
import { hhmmTilMin } from "./pauseBeregning";

/**
 * Radene som teller på sedelen: alt unntatt `erstattet` (revisjonsspor etter leders retting).
 * Samme utvalg som serveren bruker i overlappsperren.
 */
export function aktiveTimerRader<T extends { attestertStatus?: string | null }>(rader: readonly T[]): T[] {
  return rader.filter((r) => r.attestertStatus !== "erstattet");
}

/** Det en overlappmelding trenger å vite om en rad. */
export interface OverlappRad {
  fraTid?: string | null;
  tilTid?: string | null;
  kortId?: string | null;
  erReise?: boolean | null;
  arbeidReiseRetning?: string | null;
  byggeplassId?: string | null;
  projectId?: string | null;
}

/** Hva som sperrer, og kortet det står i (byggeplass og kortets fra–til, som kortets hode). */
export interface OverlappSted {
  hva: "reise" | "rad";
  fra: string;
  til: string;
  kort: { byggeplassId: string | null; projectId: string | null; fra: string; til: string } | null;
}

const tidligst = (a: string, b: string) => (hhmmTilMin(b) < hhmmTilMin(a) ? b : a);
const senest = (a: string, b: string) => (hhmmTilMin(b) > hhmmTilMin(a) ? b : a);

/**
 * (a): beskriv raden `treff` som en ny tid overlapper. Kortets fra–til regnes som kortets hode
 * (`page.tsx` `ProsjektKort`): av arbeidet (`!erReise`), eller av reisene når kortet bare har reise.
 * Byggeplassen er kortets når alle radene som gir fra–til har samme, ellers `null` (kalleren
 * viser da prosjektnavnet). Rad uten kort gir `kort: null`.
 */
export function beskrivOverlapp(treff: OverlappRad, alle: readonly OverlappRad[]): OverlappSted {
  const hva = treff.erReise === true || erArbeidstidReise(treff) ? "reise" : "rad";
  // Treffet fra `finnOverlappendeTidsrom` har alltid begge tider.
  const grunn = { hva, fra: treff.fraTid ?? "", til: treff.tilTid ?? "" } as const;
  if (!treff.kortId) return { ...grunn, kort: null };
  const iKort = alle.filter(
    (r): r is OverlappRad & { fraTid: string; tilTid: string } => r.kortId === treff.kortId && !!r.fraTid && !!r.tilTid,
  );
  const arbeid = iKort.filter((r) => r.erReise !== true);
  const kilde = arbeid.length > 0 ? arbeid : iKort;
  if (kilde.length === 0) return { ...grunn, kort: null };
  const byggeplasser = new Set(kilde.map((r) => r.byggeplassId ?? null));
  const forste = [...kilde].sort((a, b) => hhmmTilMin(a.fraTid) - hhmmTilMin(b.fraTid))[0]!;
  return {
    ...grunn,
    kort: {
      byggeplassId: byggeplasser.size === 1 ? (forste.byggeplassId ?? null) : null,
      projectId: forste.projectId ?? null,
      fra: kilde.map((r) => r.fraTid).reduce(tidligst),
      til: kilde.map((r) => r.tilTid).reduce(senest),
    },
  };
}

/**
 * (a): reisene i et kort som ligger utenfor arbeidet, sortert på fra. Kortets hode viser dem
 * («· reise 12:00–15:00»), ellers sees reisens klokkeslett bare når kortet åpnes. Kort uten arbeid
 * gir tom liste (hodet viser alt reisens klokke).
 */
export function reiseUtenforArbeid(timer: readonly OverlappRad[]): { fra: string; til: string }[] {
  const medTid = timer.filter((r): r is OverlappRad & { fraTid: string; tilTid: string } => !!r.fraTid && !!r.tilTid);
  const arbeid = medTid.filter((r) => r.erReise !== true);
  if (arbeid.length === 0) return [];
  const start = hhmmTilMin(arbeid.map((r) => r.fraTid).reduce(tidligst));
  const slutt = hhmmTilMin(arbeid.map((r) => r.tilTid).reduce(senest));
  return medTid
    .filter((r) => r.erReise === true && !(hhmmTilMin(r.fraTid) >= start && hhmmTilMin(r.tilTid) <= slutt))
    .sort((a, b) => hhmmTilMin(a.fraTid) - hhmmTilMin(b.fraTid))
    .map((r) => ({ fra: r.fraTid, til: r.tilTid }));
}

/**
 * b1: kan linjen flyttes (sted, prosjekt eller underprosjekt)? `pending` alltid. `returnert` bare
 * på arbeiderens egen sedel som er `returned` — da regnes den som `pending`. `attestert` aldri.
 * Leders flyt sender `egenSedel: false` og er uendret.
 */
export function linjeKanFlyttes(
  attestertStatus: string | null | undefined,
  sedel: { status: string; egenSedel: boolean },
): boolean {
  if (attestertStatus == null || attestertStatus === "pending") return true;
  return attestertStatus === "returnert" && sedel.egenSedel && sedel.status === "returned";
}
