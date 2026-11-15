/**
 * TILLEGG 2026-11-15 (14), Kenneth: «for meg som er sitedoc admin -> så ønsker jeg
 * varsel når timer skjules -> for å se timer må du impersere en ansatt».
 *
 * Timer-lista (mobil `DagsseddelListe`, web «Mine timer») er filtrert på valgt
 * firma og viser bare egne sedler. En sitedoc_admin som ikke er aktivt ansatt i
 * valgt firma, får derfor en tom liste. I stedet vises et varsel som peker
 * til impersonering. Andre brukere og ukjent ansatt-status → ingen varsel.
 */
export function skalVarsleSkjulteTimer(args: {
  rolle: string | null | undefined;
  erAnsatt: boolean | null | undefined;
}): boolean {
  return args.rolle === "sitedoc_admin" && args.erAnsatt === false;
}
