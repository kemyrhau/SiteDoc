// ============================================================================
//  Lønnsregel — isolert overtid-klassifisering (Timer auto-generering)
//
//  ⭐ FORWARD-COMPAT (Nivå 1-2 lønnsregel-konfig, se BACKLOG § Lønnsregel-
//  konfig): ALL logikk som avgjør «hvilken tid er overtid, og hvilket nivå»
//  bor HER — ikke spredt i StartSluttDagKort. Da kan en senere per-firma
//  tariff-konfig bytte ut regel-kroppen (`klassifiserArbeidstid`) uten å røre
//  call-sites i mobil auto-gen.
//
//  Nivå 0 (dagens regel): alt over dagsnorm → 50 %. Én normaltid-post + én
//  overtid-post. 100 %-tiering + dag-regler (lør/søn/helligdag) er BEVISST
//  ikke implementert her ennå — se BACKLOG.
//
//  Prinsipp (payroll-kritisk): overtid velges ALDRI på fritekst-navn — kun
//  via strukturert `Lonnsart.overtidsnivaa`. Finnes ingen matchende lønnsart
//  → returnér null (call-site viser banner), aldri feil-match.
// ============================================================================

/** Overtid-nivåer (prosent-tier). Substrat for Nivå 1-2 lønnsregel-konfig. */
export const OVERTID_NIVAA_50 = 50;
export const OVERTID_NIVAA_100 = 100;

/** Ett arbeidstid-segment med sitt overtid-nivå. `null` = normaltid. */
export type ArbeidstidSegment = {
  /** null = normaltid (velg firmaets standard-lønnsart); 50/100 = overtid-tier. */
  overtidsnivaa: number | null;
  timer: number;
};

/**
 * Klassifiser en dags arbeidstimer i normaltid + overtid-segmenter.
 *
 * `dagsnorm` er den EFFEKTIVE normen (call-site har allerede trukket fra
 * reisetid der `reisetidTellerOvertid` er på). 0 → hele arbeidstiden regnes
 * som normaltid (ingen overtid).
 *
 * Nivå 0-regel: `timelønn = min(arbeid, norm)`, `overtid50 = resten`.
 * Bytt KUN denne funksjonens kropp for Nivå 1-2 (terskler/tier-liste/dag-
 * regler) — retur-kontrakten (segment-liste) holder call-sites uendret.
 */
export function klassifiserArbeidstid(input: {
  arbeidstimer: number;
  dagsnorm: number;
}): ArbeidstidSegment[] {
  const { arbeidstimer, dagsnorm } = input;
  if (arbeidstimer <= 0) return [];
  const norm = dagsnorm > 0 ? dagsnorm : arbeidstimer;
  const timelonn = Math.min(arbeidstimer, norm);
  const overtid = Math.round((arbeidstimer - timelonn) * 100) / 100;
  const segmenter: ArbeidstidSegment[] = [];
  if (timelonn > 0) segmenter.push({ overtidsnivaa: null, timer: timelonn });
  if (overtid > 0)
    segmenter.push({ overtidsnivaa: OVERTID_NIVAA_50, timer: overtid });
  return segmenter;
}

/** Minimum felter en lønnsart må ha for overtid-valg. */
export type OvertidLonnsartKandidat = {
  overtidsnivaa: number | null;
  aktiv: boolean;
  type: string;
  rekkefolge: number;
};

/**
 * Velg lønnsart for et overtid-nivå: laveste `rekkefolge` blant AKTIVE
 * `type="ordinaer"` med `overtidsnivaa === nivaa`. Aldri fritekst-navn.
 * Returnerer null hvis ingen matcher (call-site: banner, aldri feil-match).
 *
 * Merk: lærling-varianter beholdes med `overtidsnivaa=null` i backfill, så de
 * aldri auto-velges for en normal arbeider (kjernen i ③a-bugen).
 */
export function velgOvertidLonnsart<T extends OvertidLonnsartKandidat>(
  lonnsarter: T[],
  nivaa: number,
): T | null {
  return (
    lonnsarter
      .filter(
        (l) => l.aktiv && l.type === "ordinaer" && l.overtidsnivaa === nivaa,
      )
      .sort((a, b) => a.rekkefolge - b.rekkefolge)[0] ?? null
  );
}
