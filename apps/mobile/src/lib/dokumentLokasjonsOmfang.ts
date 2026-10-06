/**
 * Utleder dokumentets LOKASJONSOMFANG til en visnings-beslutning, delt av de to
 * mobil-detaljskjermene (sjekkliste + oppgave, som også bærer HMS-dokumentene).
 *
 * 🔴 Ren funksjon — mobil-harness render-tester ikke RN, så laster/terminal-skillet må
 * være testbart uten å montere skjermen. Her bor gate-kriteriene: område vises med
 * navn, mangler navnet vises en nøytral tekst (aldri tomt felt), og byggeplass/punkt/
 * null er uendret.
 *
 * Speiler PDF-grenen (`packages/pdf/src/arkivmal/tegningsfelt.ts`): et definert område
 * er — som byggeplass — et bevisst lokasjonsvalg. Navnet er stedet, områdetypen er
 * dempet kontekst. Er navnet borte (området slettet, `Omrade` → `SetNull`, eller ennå
 * ikke sammenstilt) skrives en nøytral linje, så et dokument som HADDE et sted ikke ser
 * ut som det aldri hadde noe. Komponenten oversetter `typeNokkel`/nøytraltekst via `t()`.
 *
 *  - `byggeplass` → `sted` = fritekst når satt, ellers null (komponenten faller til
 *    «Gjelder hele byggeplassen»). Uendret fra før.
 *  - `omrade`     → `navn` (null når utilgjengelig) + `typeNokkel` (null for ukjent/
 *    manglende type → ingen kontekstlinje, som PDFs `omradeTypeEtikett`).
 *  - `ingen`      → punkt/null: fall tilbake til eksisterende tegningsmarkør-logikk.
 */

/** Områdetyper med i18n-etikett (`omrade.type.<type>`). Speiler PDFs `omradeTypeEtikett`. */
const KJENTE_OMRADETYPER = ["sone", "rom", "etasje", "trase"] as const;

export interface DokumentOmfangInput {
  lokasjonOmfang?: string | null;
  lokasjonFritekst?: string | null;
  omrade?: { navn?: string | null; type?: string | null } | null;
}

export type LokasjonsOmfangVisning =
  | { slag: "byggeplass"; sted: string | null }
  | { slag: "omrade"; navn: string | null; typeNokkel: string | null }
  | { slag: "ingen" };

export function dokumentLokasjonsOmfang(dok: DokumentOmfangInput): LokasjonsOmfangVisning {
  if (dok.lokasjonOmfang === "byggeplass") {
    return { slag: "byggeplass", sted: dok.lokasjonFritekst || null };
  }
  if (dok.lokasjonOmfang === "omrade") {
    const navn = dok.omrade?.navn || null;
    const type = dok.omrade?.type;
    const typeNokkel =
      type && (KJENTE_OMRADETYPER as readonly string[]).includes(type)
        ? `omrade.type.${type}`
        : null;
    return { slag: "omrade", navn, typeNokkel };
  }
  return { slag: "ingen" };
}
