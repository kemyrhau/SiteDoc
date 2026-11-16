import {
  klassifiserArbeidstid,
  OVERTID_NIVAA_50,
  type ArbeidstidSegment,
} from "@sitedoc/shared";

/**
 * ORDRE 2026-11-16 (27b), spec `prosjektkort-kortid-spec.md` § 6 L1–L3:
 * lønnsart-forslaget for et nytt kort regnes mot døgnets registreringer.
 *
 * Alt arbeid som alt står på datoens sedel bruker opp normen først; kortet som
 * bygges får normaltid opp til resten, deretter overtid. Reglene bor her til
 * ordre a2 flytter dem inn i `klassifiserArbeidstid` (`bruktAvNorm`,
 * `packages/shared/src/utils/lonnsregel.ts`) — begge funksjonene er rene, og
 * signaturen er den a2 skal gi `klassifiserArbeidstid`.
 */

/** Minste radform `bruktAvNorm` leser — lokale rader og forslagsrader. */
export type DognRad = {
  timer: number;
  /** Ferdig avgjort reise (`erReiseRadVisning`) — reise teller aldri (V1). */
  erReise: boolean;
  /** Lokale rader bærer ikke status; serverrader kan være `erstattet`. */
  attestertStatus?: string | null;
  /**
   * ORDRE (28) B8 (Kenneth 2026-11-16): raden står på en fravær-art
   * (`type = 'fravaer'`). Fravær bruker ikke normen — arbeid etter fravær er
   * vanlig arbeidstid, ikke overtid. Udefinert = arbeid (som før).
   */
  erFravaer?: boolean;
};

/**
 * L1: timer som alt bruker av normen — alle kort, også overtidsrader. Reise,
 * `erstattet` og fravær (B8) teller ikke.
 */
export function bruktAvNorm(rader: readonly DognRad[]): number {
  const sum = rader
    .filter((r) => !r.erReise && !r.erFravaer && r.attestertStatus !== "erstattet")
    .reduce((s, r) => s + (Number.isFinite(r.timer) ? r.timer : 0), 0);
  return Math.round(sum * 100) / 100;
}

/**
 * L2/L3: del kortets arbeidstimer i normaltid og overtid mot resten av normen.
 *
 *  - Ukjent norm (`dagsnorm ≤ 0`) → ingen splitt, alt normaltid (markøren
 *    `normStatus 'ukjent'` settes av kalleren som før).
 *  - Rest 0 (normen er brukt) → alt overtid. Egen gren: `klassifiserArbeidstid`
 *    tolker norm 0 som «ingen norm», så rest 0 må aldri sendes dit.
 *  - Ellers `klassifiserArbeidstid` med resten som norm.
 *
 * `bruktAvNorm` 0 gir nøyaktig dagens svar (alle eksisterende kallere).
 */
export function klassifiserMotDognet(input: {
  arbeidstimer: number;
  dagsnorm: number;
  bruktAvNorm: number;
}): ArbeidstidSegment[] {
  const { arbeidstimer, dagsnorm } = input;
  if (arbeidstimer <= 0) return [];
  if (!(dagsnorm > 0)) return klassifiserArbeidstid({ arbeidstimer, dagsnorm: 0 });
  const brukt = Math.max(0, input.bruktAvNorm || 0);
  const rest = Math.round((dagsnorm - brukt) * 100) / 100;
  if (rest <= 0) return [{ overtidsnivaa: OVERTID_NIVAA_50, timer: arbeidstimer }];
  return klassifiserArbeidstid({ arbeidstimer, dagsnorm: rest });
}
