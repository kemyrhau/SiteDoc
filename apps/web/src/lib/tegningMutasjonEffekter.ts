/**
 * Klient-effekter for tegning-mutasjonene (invalidering + feiltekst), ekstrahert for test.
 *
 * Bakgrunn (funn på test 2026-09-24): `slett` og `rekonverterPdf` invaliderte kun den viste
 * tegningens detalj (`tegning.hentMedId`), ikke LISTA. TegningerPanel drives av
 * `bygning.hentForProsjekt` (samme query `backfillDimensjoner` invaliderer), så en sletting lot
 * den slettede raden stå — og neste klikk traff `findUniqueOrThrow` på en rad som var borte.
 * `rekonverterPdf` hadde samme hull: den endrer conversionStatus på FLERE tegninger, men bare
 * den ene detaljen ble oppdatert.
 */

/** Minimal strukturell form av trpc `useUtils()` — kun det disse effektene rører. */
export interface TegningUtils {
  bygning: { hentForProsjekt: { invalidate: (input: { projectId: string }) => unknown } };
  tegning: { hentMedId: { invalidate: (input: { id: string }) => unknown } };
}

/** Etter sletting: lista MÅ oppdateres (raden er borte). */
export function invaliderEtterSlett(utils: TegningUtils, projectId: string): void {
  utils.bygning.hentForProsjekt.invalidate({ projectId });
}

/** Etter re-konvertering: både den viste tegningen (banner) OG lista (søsken-status). */
export function invaliderEtterRekonverter(
  utils: TegningUtils,
  projectId: string,
  tegningId: string,
): void {
  utils.tegning.hentMedId.invalidate({ id: tegningId });
  utils.bygning.hentForProsjekt.invalidate({ projectId });
}

/**
 * Slettevaktens BAD_REQUEST bærer en lesbar melding (hva som bruker tegningen + antall) og vises
 * som den er. Alt annet (rå Prisma-tekst o.l.) skjules bak `generisk`. tRPC gir feilkoden på
 * `error.data.code` — samme diskriminator som prosjektoppsett/vareforbruk bruker på UI-siden.
 */
export function slettFeilTekst(
  error: { message?: string; data?: { code?: string } | null },
  generisk: string,
): string {
  return error.data?.code === "BAD_REQUEST" && error.message ? error.message : generisk;
}
