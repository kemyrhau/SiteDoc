/**
 * «Krever vurdering»-predikatet for en dagsseddel (2026-08-23).
 *
 * Kriteriet er «krever et aktivt valg av attestanten» (Kenneth), IKKE «avviker fra normen»
 * alene. Standard-ekspanderingen i firma-attestering åpner disse sedlene ved lasting, og
 * «Krever vurdering»-knappen gjenoppretter settet. Delt kilde så page-en (kontrollert expand)
 * og SeddelKort (intern auto-expand i DagsKort-bruken) aldri drifter fra hverandre.
 *
 * B ∪ C (Kenneth-vedtak 2026-08-23):
 *  - B «norm-avvik»: ført ≠ dagsnorm (dag-nivå; radene bak 9,00t / 7,50t). Bruker eksisterende
 *    felt (`totaltimer`/`dagsnorm`), ingen ny beregning.
 *  - C «vurderingsflagg»: tilleggskrav ∨ mertid ∨ maskin-over — dag-nivå anomalier som i dag
 *    auto-åpner SeddelKort. Beholdt så de sedlene ikke slutter å auto-åpne (regresjonsvern).
 *
 * IKKE med: `overtidsgrunnlag.avvik` (beregnet overtid ≠ ført overtid) — det er UKE-nivå og
 * formidles alt av ukesbadgen; som per-sedel-trigger ville den åpnet alle dagene i uken.
 */

/** Minimal strukturell form — både SeddelKortData og page-ens Sedel-type oppfyller den. */
export interface VurderingsSedel {
  tilleggHarKrav: boolean;
  dagsnorm: number;
  totaltimer: number;
  pauseMin: number;
  maskiner: Array<{ timer: unknown }>;
}

function tilTall(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** B — ført ≠ dagsnorm (begge retninger). Krever dagsnorm > 0 (ellers false positive). */
export function sedelHarNormAvvik(s: VurderingsSedel): boolean {
  return s.dagsnorm > 0 && Math.abs(s.totaltimer - s.dagsnorm) > 0.001;
}

/** C1 — tillegg med krav (skal godkjennes eller ikke). */
export function sedelHarTilleggKrav(s: VurderingsSedel): boolean {
  return s.tilleggHarKrav;
}

/** C2 — mertid: arbeidet mer enn dagsnorm (delmengde av norm-avvik, men beholdt eksplisitt). */
export function sedelHarMertid(s: VurderingsSedel): boolean {
  return s.dagsnorm > 0 && s.totaltimer > s.dagsnorm + 0.001;
}

/**
 * C3 — maskin-av-arbeid-invarianten brutt: sum maskintimer > arbeidstimer + pausebuffer.
 * Pause-buffer fordi døgn-utleide maskiner går mens operatør pauser (T.7).
 */
export function sedelHarMaskinOver(s: VurderingsSedel): boolean {
  const sumMaskin = s.maskiner.reduce((acc, r) => acc + tilTall(r.timer), 0);
  return sumMaskin > 0 && sumMaskin > s.totaltimer + s.pauseMin / 60 + 0.001;
}

/** B ∪ C — sedelen krever et aktivt attestant-valg → standard-ekspandert. */
export function sedelKreverVurdering(s: VurderingsSedel): boolean {
  return (
    sedelHarNormAvvik(s) ||
    sedelHarTilleggKrav(s) ||
    sedelHarMertid(s) ||
    sedelHarMaskinOver(s)
  );
}
