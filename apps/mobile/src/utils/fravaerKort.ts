import { erFravaerArt, harNormtak, restForFravaerMedTak } from "@sitedoc/shared";
import type { NormtakArt, NormtakDagRad } from "./fravaerNormtakMobil";

/**
 * ORDRE (33) c2 — fraværskortet på telefon (kort-id-spec § 11.5, § 11.10.4).
 * Rene regler: forhåndsutfylling (U3), taket pr. linje (B10, TF22), −/+ i firmaets
 * tidsrunding, validering (U11, TF3) og chips/søkeliste (U2). Regnestykket for resten
 * er det delte i shared (`restForFravaerMedTak`) — én kilde.
 */

type FinnArt = (lonnsartId: string | null) => NormtakArt | null;

/** En linje i kortet (lagret eller ny). `key` er stabil i skjermens levetid. */
export interface KortLinje {
  key: string;
  lonnsartId: string | null;
  timer: number | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Resten av dagsnormen for linja `key` (eller en ny linje når `key` er null):
 * norm − arbeid − alt annet fravær på datoen (dagens øvrige rader + kortets andre linjer).
 * `dagRader` er dagens rader UTEN kortets egne. Reise teller ikke (N8). `null` = ukjent norm.
 */
export function fravaerRest(args: {
  dagsnorm: number | null;
  dagRader: readonly NormtakDagRad[];
  kortLinjer: readonly KortLinje[];
  key: string | null;
  finnArt: FinnArt;
}): number | null {
  if (args.dagsnorm == null || !(args.dagsnorm > 0)) return null;
  let arbeid = 0;
  let annetFravaer = 0;
  for (const r of args.dagRader) {
    if (r.erReise) continue;
    if (erFravaerArt(args.finnArt(r.lonnsartId))) annetFravaer += r.timer;
    else arbeid += r.timer;
  }
  for (const l of args.kortLinjer) {
    if (l.key === args.key) continue;
    annetFravaer += l.timer ?? 0;
  }
  return restForFravaerMedTak({ dagsnorm: args.dagsnorm, arbeid: round2(arbeid), annetFravaer: round2(annetFravaer) });
}

/** U3: rest > 0 forhåndsutfylles; ukjent norm eller rest 0 → tomt felt (`null`). */
export function forhandsutfyllTimer(rest: number | null): number | null {
  return rest != null && rest > 0 ? rest : null;
}

/** Øvre grense for linja: resten når arten har tak (B10), ellers ingen (`null`, F10). */
export function linjeGrense(args: {
  dagsnorm: number | null;
  dagRader: readonly NormtakDagRad[];
  kortLinjer: readonly KortLinje[];
  key: string;
  lonnsartId: string | null;
  finnArt: FinnArt;
}): number | null {
  if (!harNormtak(args.finnArt(args.lonnsartId))) return null;
  return fravaerRest(args);
}

/**
 * −/+ (`retning` −1/+1) i steg på `steg` timer; `retning` 0 klemmer bare (bytte av art).
 * Aldri under 0, aldri over `grense` når den finnes.
 */
export function stegFravaerTimer(timer: number, retning: -1 | 0 | 1, steg: number, grense: number | null): number {
  const neste = round2(Math.max(0, timer + retning * steg));
  return grense != null ? Math.min(neste, grense) : neste;
}

/** TF22: rest 0 → arter med tak nedtones i velgeren (art uten tak aldri). */
export function artNedtonet(art: NormtakArt | null, rest: number | null): boolean {
  return harNormtak(art) && rest != null && rest <= 0;
}

export type FravaerKortFeil = "ingenLinjer" | "manglerArt" | "manglerTimer" | "ikkeFravaerArt" | "manglerBeskrivelse";

/** U11/F4 + TF3: kortet kan bare lagres med fravær-art, timer > 0 og beskrivelse. */
export function validerFravaerKort(args: {
  linjer: readonly { lonnsartId: string | null; timer: number | null }[];
  beskrivelse: string | null;
  finnArt: FinnArt;
}): FravaerKortFeil | null {
  if (args.linjer.length === 0) return "ingenLinjer";
  for (const l of args.linjer) {
    if (!l.lonnsartId) return "manglerArt";
    if (!erFravaerArt(args.finnArt(l.lonnsartId))) return "ikkeFravaerArt";
    if (l.timer == null || !(l.timer > 0)) return "manglerTimer";
  }
  if (!(args.beskrivelse ?? "").trim()) return "manglerBeskrivelse";
  return null;
}

/** U2 (samme regel som V3): chips når firmaet har inntil seks fravær-arter. */
export function visSomChips(antallArter: number): boolean {
  return antallArter <= 6;
}

/** Steget for −/+: firmaets tidsrunding i timer; uten runding 0,5 t. */
export function fravaerSteg(tidsrundingMinutter: number | null | undefined): number {
  return tidsrundingMinutter && tidsrundingMinutter > 0 ? tidsrundingMinutter / 60 : 0.5;
}
