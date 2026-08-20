// ============================================================================
//  Overtidsgrunnlag — «beregnet vs. valgt» klassifisering (ORDRE 2, § D2).
//
//  Backstop-prinsippet (Kenneth-presisering): serveren BEREGNER klassifisering
//  for alle rader og gjør den etterprøvbar — men OVERSTYRER aldri brukerens
//  lonnsartId. Avviket mellom beregnet og valgt er noe attestanten skal SE,
//  ikke noe systemet retter stille. Denne modulen er ren aritmetikk over
//  ferdig-uthentede rader — den rører ingen data, gjør ingen DB-kall.
//
//  · «valgt»    = det brukeren faktisk førte (rad.overtidsnivaa fra lonnsart)
//  · «beregnet» = det regelen (klassifiserArbeidstid) sier ut fra norm
//
//  Norm er dagsnorm (dag-nivå, lese-avledning i visningene) ELLER ukenorm
//  (uke-nivå, snapshot ved attestering) — samme regnestykke, ulik norm.
// ============================================================================

import { klassifiserArbeidstid } from "./lonnsregel";

/** En timer-rad redusert til det klassifiseringen trenger. */
export interface OvertidRad {
  timer: number;
  /** Fra lonnsart. null = ordinær/normaltid; 50/100 = overtid-tier. */
  overtidsnivaa: number | null;
}

export interface Overtidsgrunnlag {
  /** Normen sammenligningen skjer mot: dagsnorm (dag) eller ukenorm (uke). */
  norm: number;
  totaltimer: number;
  /** Valgt: timer ført på rader UTEN overtidsnivaa. */
  sumOrdinaert: number;
  /** Valgt: timer ført på rader MED overtidsnivaa (bruker-tagget overtid). */
  sumOvertid: number;
  /** Beregnet: timer regelen legger over normen (klassifiserArbeidstid). */
  beregnetOvertid: number;
  /** true når beregnet og valgt overtid spriker (utover 0,01 t). */
  avvik: boolean;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Beregn overtidsgrunnlag for et sett rader mot en norm. REN — muterer ikke
 * input, gjør ingen DB-kall, rører ingen lonnsartId.
 */
export function beregnOvertidsgrunnlag(
  rader: OvertidRad[],
  norm: number,
): Overtidsgrunnlag {
  const totaltimer = round2(rader.reduce((s, r) => s + r.timer, 0));
  const sumOvertid = round2(
    rader.filter((r) => r.overtidsnivaa !== null).reduce((s, r) => s + r.timer, 0),
  );
  const sumOrdinaert = round2(totaltimer - sumOvertid);
  const segmenter = klassifiserArbeidstid({ arbeidstimer: totaltimer, dagsnorm: norm });
  const beregnetOvertid = round2(
    segmenter.filter((s) => s.overtidsnivaa !== null).reduce((s, x) => s + x.timer, 0),
  );
  const avvik = Math.abs(beregnetOvertid - sumOvertid) > 0.01;
  return { norm, totaltimer, sumOrdinaert, sumOvertid, beregnetOvertid, avvik };
}

/**
 * Les overtidsgrunnlag ut av et attestertSnapshot-Json. GATE (§ D2): eldre
 * snapshots ble skrevet FØR dette feltet fantes — de mangler `overtidsgrunnlag`.
 * Da returneres `null` (aldri et fabrikkert 0 som ser ut som et faktum).
 * Lesesiden må behandle `null` som «ikke registrert», ikke som «0 timer».
 */
export function lesOvertidsgrunnlagFraSnapshot(
  snapshot: unknown,
): Overtidsgrunnlag | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const o = (snapshot as Record<string, unknown>).overtidsgrunnlag;
  if (!o || typeof o !== "object") return null;
  const g = o as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const norm = num(g.norm);
  const totaltimer = num(g.totaltimer);
  const sumOrdinaert = num(g.sumOrdinaert);
  const sumOvertid = num(g.sumOvertid);
  const beregnetOvertid = num(g.beregnetOvertid);
  // Krev at alle tall-feltene finnes — ellers er dette en gammel snapshot-form.
  if (
    norm === null ||
    totaltimer === null ||
    sumOrdinaert === null ||
    sumOvertid === null ||
    beregnetOvertid === null
  ) {
    return null;
  }
  return {
    norm,
    totaltimer,
    sumOrdinaert,
    sumOvertid,
    beregnetOvertid,
    avvik: g.avvik === true,
  };
}
