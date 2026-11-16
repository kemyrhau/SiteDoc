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
 * `dagsnorm` er den EFFEKTIVE normen. `arbeidstimer` er ALLEREDE uten reise —
 * reisetid er aldri overtid (V1, LAG 2): call-site (beregnOvertidsgrunnlag)
 * ekskluderer reise-rader HELT før klassifiseringen, i stedet for det tidligere
 * `reisetidTellerOvertid`-fradraget i normen (flagget er deprecated, C5). 0 →
 * hele arbeidstiden regnes som normaltid (ingen overtid).
 *
 * Nivå 0-regel: `timelønn = min(arbeid, norm)`, `overtid50 = resten`.
 * Bytt KUN denne funksjonens kropp for Nivå 1-2 (terskler/tier-liste/dag-
 * regler) — retur-kontrakten (segment-liste) holder call-sites uendret.
 *
 * ORDRE (29) a2, spec `prosjektkort-kortid-spec.md` § 6 L1–L3: `bruktAvNorm`
 * = timer døgnet alt har registrert (`bruktAvNorm(rader)` under). Arbeidet
 * får normaltid opp til resten av normen, deretter overtid. Rest 0 → alt
 * overtid; ukjent norm (`dagsnorm ≤ 0`) → alt normaltid uansett brukt — to
 * ulike grener. Utelatt/0 → nøyaktig som før (alle kallere uten feltet).
 */
export function klassifiserArbeidstid(input: {
  arbeidstimer: number;
  dagsnorm: number;
  bruktAvNorm?: number;
}): ArbeidstidSegment[] {
  const { arbeidstimer } = input;
  if (arbeidstimer <= 0) return [];
  const brukt = input.dagsnorm > 0 ? Math.max(0, input.bruktAvNorm || 0) : 0;
  const dagsnorm =
    brukt > 0 ? Math.round((input.dagsnorm - brukt) * 100) / 100 : input.dagsnorm;
  if (brukt > 0 && dagsnorm <= 0)
    return [{ overtidsnivaa: OVERTID_NIVAA_50, timer: arbeidstimer }];
  const norm = dagsnorm > 0 ? dagsnorm : arbeidstimer;
  const timelonn = Math.min(arbeidstimer, norm);
  const overtid = Math.round((arbeidstimer - timelonn) * 100) / 100;
  const segmenter: ArbeidstidSegment[] = [];
  if (timelonn > 0) segmenter.push({ overtidsnivaa: null, timer: timelonn });
  if (overtid > 0)
    segmenter.push({ overtidsnivaa: OVERTID_NIVAA_50, timer: overtid });
  return segmenter;
}

/** Minste radform `bruktAvNorm` leser — lokale rader, serverrader og forslagsrader. */
export type DognRad = {
  timer: number;
  /** Ferdig avgjort reise — reise teller aldri (V1). */
  erReise: boolean;
  /** Lokale rader bærer ikke status; serverrader kan være `erstattet`. */
  attestertStatus?: string | null;
  /**
   * B8 (Kenneth 2026-11-16): raden står på en fravær-art (`type = 'fravaer'`).
   * Fravær bruker ikke normen — arbeid etter fravær er vanlig arbeidstid.
   * Udefinert = arbeid.
   */
  erFravaer?: boolean;
};

/**
 * L1 (ORDRE (29) a2): timer døgnet alt bruker av normen — alle kort, også
 * overtidsrader. Reise, `erstattet` og fravær (B8) teller ikke. Inndata til
 * `klassifiserArbeidstid({ bruktAvNorm })`.
 */
export function bruktAvNorm(rader: readonly DognRad[]): number {
  const sum = rader
    .filter((r) => !r.erReise && !r.erFravaer && r.attestertStatus !== "erstattet")
    .reduce((s, r) => s + (Number.isFinite(r.timer) ? r.timer : 0), 0);
  return Math.round(sum * 100) / 100;
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
