/**
 * Bibliotekmal (sentralarkiv) → objekt-rader (@sitedoc/shared).
 *
 * Vei C del 1 (ordre bibliotekmal-objekttabell): sentralmalens innhold flyttes fra en
 * flat `BibliotekMal.malInnhold`-JSON til `BibliotekMalObjekt`-RADER som speiler
 * `OrganizationTemplateObject` felt for felt. Radene er ENESTE kilde etter migreringen;
 * `malInnhold` fryses.
 *
 * Overskriftene («Kontroll FØR/UNDER/ETTER utførelse») lå ALDRI i JSON — de ble generert
 * ved lån/import fra `fase` (`firmamal.ts:161-176`, `bibliotek.ts:191-206`). Design B
 * (fabels avviksgodkjenning 2026-09-14): overskriftene MATERIALISERES som egne rader nå,
 * slik at lånevegen kan KOPIERE dem verbatim i stedet for å generere dem — og sitedoc-rader
 * blir strukturelt like firma-/prosjektrader (spesialtilfellet fjernes).
 *
 * Denne funksjonen er den delte spesifikasjonen: seeden bruker den til å skrive nye maler,
 * migreringens SQL speiler den for eksisterende data, og round-trip-testen bruker den som
 * fasit mot den gamle JSON-genereringen. ÉN regel, tre kallsteder — de kan ikke drifte.
 */

/** Ett felt slik det ligger i en bibliotekmals `malInnhold`-JSON (speiler seedens `FeltDef`). */
export interface BibliotekFeltData {
  label: string;
  type: string;
  zone?: string;
  fase?: string | null;
  config?: Record<string, unknown> | null;
  required?: boolean;
  sortOrder?: number;
}

/**
 * Én rad klar for `BibliotekMalObjekt.create` (uten id — DB genererer). `parentId` er
 * alltid null: sentralarkivet nester ikke i dag (målt), men rad-modellen bærer feltet så
 * evnen finnes (Kenneths MAL-METODE, C gir evnen — del 2/senere).
 */
export interface BibliotekRadData {
  type: string;
  label: string;
  config: Record<string, unknown>;
  translations: Record<string, unknown>;
  sortOrder: number;
  required: boolean;
  parentId: null;
}

/**
 * Overskriftsteksten lånevegen genererer i dag — kopiert, ikke diktet (ordre Krav 2-B).
 * Ukjent fase faller til «ETTER» slik den gamle ternæren gjorde (`firmamal.ts:168-173`).
 */
export function bibliotekFaseHeadingLabel(fase: string): string {
  return fase === "FØR"
    ? "Kontroll FØR utførelse"
    : fase === "UNDER"
      ? "Kontroll UNDER utførelse"
      : "Kontroll ETTER utførelse";
}

/**
 * Bygg rad-listen fra `malInnhold`. Rekkefølge og gruppering er IDENTISK med
 * `byggFirmamalObjekterFraBibliotek` (den gamle genereringen), med to bevisste forskjeller
 * som Design B krever:
 *   - Overskriftsraden har TOM `config` (den gamle satte `{ zone: "datafelter" }`; en
 *     overskrift trenger ikke sone — tom config faller til datafelter i tre-byggeren).
 *   - Radene bærer `translations` (tom med norsk fallback) fordi rad-modellen har feltet.
 *
 * `sortOrder` er global og inkrementell i lån-rekkefølgen: pr. distinkt fase (i den
 * rekkefølgen fasen først opptrer i arrayet) én overskrift + fasens felt i array-orden;
 * felt uten fase legges til slutt UTEN overskrift.
 */
export function byggBibliotekRader(malInnhold: BibliotekFeltData[]): BibliotekRadData[] {
  if (!Array.isArray(malInnhold) || malInnhold.length === 0) return [];

  const rader: BibliotekRadData[] = [];
  let sortOrder = 0;

  const feltRad = (f: BibliotekFeltData): BibliotekRadData => ({
    type: f.type,
    label: f.label,
    // Samme form som den gamle lånevegen: sone først, feltets egen config vinner.
    config: { zone: f.zone ?? "datafelter", ...(f.config ?? {}) },
    translations: {},
    sortOrder: ++sortOrder,
    required: f.required ?? false,
    parentId: null,
  });

  // Distinkte faser i første-opptreden-rekkefølge (tomme/null = «uten fase»).
  const faser = [...new Set(malInnhold.map((f) => f.fase).filter(Boolean))] as string[];

  for (const fase of faser) {
    rader.push({
      type: "heading",
      label: bibliotekFaseHeadingLabel(fase),
      config: {},
      translations: {},
      sortOrder: ++sortOrder,
      required: false,
      parentId: null,
    });
    for (const f of malInnhold.filter((x) => x.fase === fase)) rader.push(feltRad(f));
  }

  for (const f of malInnhold.filter((x) => !x.fase)) rader.push(feltRad(f));

  return rader;
}
