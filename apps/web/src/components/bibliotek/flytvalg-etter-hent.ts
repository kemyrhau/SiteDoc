/**
 * Flytvalg rett etter «Hent fra arkiv» (Kenneth-observasjon 2026-09-18): når en mal
 * hentes ned i prosjektet skal brukeren straks få tilbud om å knytte den til en
 * dokumentflyt — med to LIKESTILTE utganger: «Velg» eller «Hopp over».
 *
 * Ren beslutnings-logikk, holdt utenfor komponenten så den kan testes uten trpc/DOM.
 *
 * 🔴 Gjelder KUN firma-arkiv-henten (`kopierTilProsjekt`), som er den eneste veien som
 * lager en prosjekt-`ReportTemplate`. SiteDoc-arkiv-lånet (`laanFraSentralarkiv`) lager
 * en firma-`OrganizationTemplate` uten `projectId` — og `Dokumentflyt`/`DokumentflytMal`
 * er prosjekt-scoped, så det finnes ingen prosjekt-flyt å knytte til der (schema-umulig).
 */

/** De to likestilte utgangene Kenneth ba om. «hoppOver» er alltid en vei ut. */
export const FLYTVALG_UTGANGER = ["velg", "hoppOver"] as const;
export type FlytvalgUtgang = (typeof FLYTVALG_UTGANGER)[number];

/**
 * Skal flytvalg-steget vises etter en hent?
 *  - `antallFlyter === 0` → skjul (ingenting å knytte til; et tomt «velg» er en blindvei).
 *  - `kategori === "hms"` → skjul (HMS-maler er flyt-løse, jf. MalListe skjuler flyt-velgeren).
 * Ellers: vis steget.
 */
export function skalTilbyFlytvalg(input: { antallFlyter: number; kategori: string }): boolean {
  return input.antallFlyter > 0 && input.kategori !== "hms";
}

/**
 * Oversetter et utgangs-valg til en handling.
 *  - «hoppOver» knytter ALDRI — malen blir hentet, men uten flyt. Dette er veien ut.
 *  - «velg» knytter de valgte flytene (tomt utvalg = ingen kobling, men eksplisitt valgt).
 */
export function flytvalgHandling(
  utgang: FlytvalgUtgang,
  valgteFlytIder: string[],
): { knytt: boolean; workflowIds: string[] } {
  if (utgang === "hoppOver") return { knytt: false, workflowIds: [] };
  return { knytt: valgteFlytIder.length > 0, workflowIds: valgteFlytIder };
}
