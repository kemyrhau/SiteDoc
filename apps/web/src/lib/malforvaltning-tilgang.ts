/**
 * Malforvaltning — gating av nivåfanene (ordre malforvaltning, Krav 1).
 *
 * Lese ≠ redigere (Kenneth 15.09): Malforvaltning er FORVALTNINGS-flaten. Prosjektbruker/
 * -admin ser den ALDRI (de leser/henter fra arkivene inne i sjekkliste-/oppgave-/HMS-
 * malbyggeren i stedet). Firmaadmin forvalter firmaarkivet; SiteDoc-admin forvalter
 * SiteDoc-arkivet.
 *
 * Ren funksjon (som `gateDypeSider`) så den negative kontrollen kan bevises uten React-
 * kontekst. Hele flaten er synlig HVIS OG BARE HVIS minst én fane er synlig — det
 * generaliserer «kanAdministrereFirma || erSitedocAdmin» korrekt etter hvert som faner
 * legges til (firmaarkiv i PR 2, papirkurv i egen skjemarunde).
 *
 * PR 2: firmaarkiv-fanen (én liste + maltype-filter) er lagt til FØR sitedoc — den krever
 * `kanAdministrereFirma`. Hele flaten er dermed synlig for `kanAdministrereFirma ||
 * erSitedocAdmin`, uttrykt korrekt gjennom fane-predikatene. Papirkurv-fanen kommer i en
 * senere skjemarunde (soft-delete på OrganizationTemplate finnes ikke ennå). Ingen tom/
 * placeholder-fane bygges.
 */

export type MalforvaltningFaneId = "firmaarkiv" | "sitedoc";

export interface MalforvaltningTilgang {
  kanAdministrereFirma: boolean;
  erSitedocAdmin: boolean;
}

export interface MalforvaltningFane {
  id: MalforvaltningFaneId;
  labelKey: string;
  krever: (t: MalforvaltningTilgang) => boolean;
}

// Fane-registeret. `firmaarkiv` FØR `sitedoc`: en firma-admin lander på sitt eget arkiv.
export const MALFORVALTNING_FANER: MalforvaltningFane[] = [
  {
    id: "firmaarkiv",
    labelKey: "malforvaltning.fane.firmaarkiv",
    krever: (t) => t.kanAdministrereFirma,
  },
  { id: "sitedoc", labelKey: "malforvaltning.fane.sitedoc", krever: (t) => t.erSitedocAdmin },
];

/** Fanene brukeren faktisk ser. Tom liste = ingen tilgang → hele flaten skjules. */
export function gateMalforvaltningFaner(
  faner: MalforvaltningFane[],
  tilgang: MalforvaltningTilgang,
): MalforvaltningFane[] {
  return faner.filter((f) => f.krever(tilgang));
}
