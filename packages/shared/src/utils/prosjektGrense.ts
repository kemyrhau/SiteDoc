// Gratis-grense for sjekklister/oppgaver per prosjekt — delt, ren beslutningslogikk
// (testbar; Prisma-agnostisk). Brukes av BEGGE guards (sjekkliste.opprett +
// oppgave.opprett) via apps/api, så regelen ikke kan divergere mellom dokumenttypene.
//
// Interim-vedtak 2026-07-26 (sjekklistegrense-provestatus-ordre): grensen er en
// prøve-gate og gjelder KUN standalone-prosjekter (uten firma-tilknytning) — samme
// akse som trial-deaktiveringen i admin.ts (`projectOrganizations: { none: {} }`).
// Firma-tilknyttede prosjekter er grenseløse; sitedoc_admin har alltid bypass.

/** Maks antall sjekklister/oppgaver per standalone-prosjekt (prøve-gate). */
export const GRATIS_DOKUMENT_GRENSE = 10;

export interface GrenseVilkaar {
  /** sitedoc_admin har alltid bypass. */
  erSitedocAdmin: boolean;
  /** True når prosjektet mangler firma-tilknytning (standalone = prøve). */
  erStandaloneProsjekt: boolean;
  /** Antall ikke-slettede dokumenter av samme type i prosjektet. */
  antallEksisterende: number;
}

/**
 * True hvis opprettelse skal blokkeres av gratis-grensen.
 *
 * - sitedoc_admin → aldri blokkert.
 * - Firma-tilknyttet prosjekt → aldri blokkert (grenseløst).
 * - Standalone-prosjekt → blokkert når antallEksisterende >= GRATIS_DOKUMENT_GRENSE.
 */
export function grenseNaadd({
  erSitedocAdmin,
  erStandaloneProsjekt,
  antallEksisterende,
}: GrenseVilkaar): boolean {
  if (erSitedocAdmin) return false;
  if (!erStandaloneProsjekt) return false;
  return antallEksisterende >= GRATIS_DOKUMENT_GRENSE;
}
