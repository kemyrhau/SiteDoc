import type { PrismaClient } from "@sitedoc/db";

// API-side DB-hjelper for gratis-grensen (sjekkliste.opprett + oppgave.opprett).
// Ren beslutningslogikk ligger i @sitedoc/shared (grenseNaadd) — denne fila holder
// kun DB-oppslaget, så begge guards deler både query og beslutning uten duplisering.

/**
 * True når prosjektet mangler firma-tilknytning (standalone = prøve).
 *
 * Speiler admin.ts' trial-deaktivering eksakt: et standalone-prosjekt er ett med
 * `projectOrganizations: { none: {} }`. Firma-tilknyttede prosjekter deaktiveres
 * aldri og er dermed per definisjon ordinære (grenseløse). Ingen nytt felt/migrering.
 */
export async function erStandaloneProsjekt(
  prisma: PrismaClient,
  projectId: string,
): Promise<boolean> {
  const antall = await prisma.projectOrganization.count({ where: { projectId } });
  return antall === 0;
}
