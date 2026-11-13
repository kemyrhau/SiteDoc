/**
 * Funn 9 (telefontest 13.11): hvilken «Nå»-linje pågår-kortet viser.
 *
 * Før viste kortet «Nå: X» bare fra andre besøk (`rekkefolge > 1`), så første
 * besøk uten oppmøtested ga ingen linje — og «Bytt byggeplass» sto uten
 * forklaring. Nå vises gjeldende sted alltid når et besøk finnes:
 *
 * - `"besok"`  → «Nå: <sted> (siden HH:MM)»; besøk uten byggeplass gir
 *   «Utenfor kjent byggeplass» via kortets `stedNavn`.
 * - `"utenfor"` → intet besøk lest (eldre dag uten besøk-rad) → «Utenfor kjent byggeplass».
 * - `null`     → første besøk er samme sted som «Startet på …» (oppmøtested og
 *   byggeplass er ulike entiteter, så navnet sammenlignes) — ingen dobbel linje.
 *   Også `null` når første besøk er uten byggeplass og oppmøtestedet har navn
 *   (B-9, Kenneth 13.11: dagen startet på verksted/kontor → bare «Startet på X»).
 */
export type NaaStedLinje = "besok" | "utenfor" | null;

const normaliser = (s: string) => s.trim().toLocaleLowerCase("nb-NO");

export function naaStedLinje(a: {
  oppmotestedNavn: string | null;
  siste: { rekkefolge: number; byggeplassId: string | null; byggeplassNavn: string | null } | null;
}): NaaStedLinje {
  const { siste, oppmotestedNavn } = a;
  if (!siste) return "utenfor";
  if (siste.rekkefolge === 1 && oppmotestedNavn && !siste.byggeplassId) return null;
  if (
    siste.rekkefolge === 1 &&
    oppmotestedNavn &&
    siste.byggeplassId &&
    siste.byggeplassNavn &&
    normaliser(siste.byggeplassNavn) === normaliser(oppmotestedNavn)
  ) {
    return null;
  }
  return "besok";
}
