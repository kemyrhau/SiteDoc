// ============================================================================
//  A4 — ukelinja i attesteringen (plan § 4.17 del B, B50 A, B52 A, B53 A, B54 A,
//  B57, B85 ja). Ren visningsmodell: tallene er serverens ukeregnestykke
//  (`beregnUkeregnestykke` i @sitedoc/shared, sendt som `uke` på hver sedel).
//  Skjermen regner ikke uka selv — da finnes bare ett regnestykke (retter AM12).
// ============================================================================

import { harUkevarsel, type Ukeregnestykke } from "@sitedoc/shared";

/** Ukas regnestykke slik serveren sender det på sedelen (`hentTilAttesteringFirma`). */
export interface AttUke {
  /** Mandagen (ISO). */
  ukestart: string;
  regnestykke: Ukeregnestykke;
  /** Alle arbeidsdager er sendt eller attestert, eller uka er over (B53 A). */
  komplett: boolean;
  /** Arbeidsdagene uten sendt eller attestert dagsseddel (ISO). */
  manglerDager: string[];
}

export interface UkeMerke {
  tekst: string;
  forklaring: string;
  /** Gult (uka er komplett) eller grått («uka så langt»). */
  gul: boolean;
}

/** Tekstene ukelinja trenger (komponenten sender `t()`). Tallene kommer ferdig formatert. */
export interface UkeTekster {
  underNorm: (timer: string) => string;
  kanTrekkes: (timer: string, overtid: string) => string;
  overNorm: (timer: string) => string;
  regnestykke: (r: {
    norm: string;
    sum: string;
    mangler: string;
    over: string;
    godtatt: string;
    fort: string;
    trekkes: string;
    reise: string;
  }) => string;
}

/** Ukas regnestykke for en gruppe dager (første sedel som har det — likt for hele uka). */
export function ukeFor(dager: readonly { sedel: { uke?: AttUke | null } }[]): AttUke | null {
  for (const d of dager) if (d.sedel.uke) return d.sedel.uke;
  return null;
}

/**
 * Merkene på ukelinja: «Under ukenorm N t», «N t av M t overtid kan trekkes» og
 * «+N t over ukenorm». Gule når uka er komplett, ellers grå. Hover = hele regnestykket.
 */
export function ukeMerker(uke: AttUke, tekst: UkeTekster, tall: (n: number) => string): UkeMerke[] {
  const r = uke.regnestykke;
  const forklaring = tekst.regnestykke({
    norm: tall(r.ukenorm),
    sum: tall(r.ukesum),
    mangler: tall(r.mangler),
    over: tall(r.overDagsnorm),
    godtatt: tall(r.godtattOvertid),
    fort: tall(r.sumOvertid),
    trekkes: tall(r.kanTrekkes),
    reise: tall(r.reise),
  });
  const gul = uke.komplett;
  const ut: UkeMerke[] = [];
  if (r.ukenorm > 0 && r.mangler > 0.005) ut.push({ tekst: tekst.underNorm(tall(r.mangler)), forklaring, gul });
  if (r.kanTrekkes > 0.005) ut.push({ tekst: tekst.kanTrekkes(tall(r.kanTrekkes), tall(r.sumOvertid)), forklaring, gul });
  if (r.overIkkeFort > 0.005) ut.push({ tekst: tekst.overNorm(tall(r.overIkkeFort)), forklaring, gul });
  return ut;
}

/**
 * «N t kan trekkes» på dagen (B85): ukas tall, aldri mer enn overtiden ført den dagen.
 * 0 når uka ikke er komplett (varselet er grått til da, B53 A) eller dagen ikke har overtid.
 */
export function dagKanTrekkes(uke: AttUke | null | undefined, dato: string): number {
  if (!uke || !uke.komplett) return 0;
  return uke.regnestykke.dager.find((d) => d.dato === dato)?.kanTrekkes ?? 0;
}

/**
 * B53 A: attesterte dager som skal stå under ukelinja med ↺ — dager med overtid som kan
 * trekkes, i en komplett uke med ukevarsel. Uka må kunne rettes også når dagen er attestert.
 */
export function attesterteMedUkevarsel<S extends { dato: Date | string; uke?: AttUke | null }>(
  attesterte: readonly S[],
): S[] {
  return attesterte.filter((s) => {
    const uke = s.uke;
    if (!uke || !uke.komplett || !harUkevarsel(uke.regnestykke)) return false;
    return dagKanTrekkes(uke, isoAv(s.dato)) > 0.005;
  });
}

function isoAv(d: Date | string): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date(d).toISOString().slice(0, 10);
}

/** Ukelinjas tall: «1,0», «36,5», «0,25» — én desimal, to når den andre trengs. */
export function ukeTall(n: number): string {
  const r = Math.round(n * 100) / 100;
  return (Number.isInteger(Math.round(r * 100) / 10) ? r.toFixed(1) : r.toFixed(2)).replace(".", ",");
}
