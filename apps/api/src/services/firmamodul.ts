/**
 * Firmamodul-sync (Steg 1c Fase B).
 *
 * Synkroniserer ProjectModule-rader når en firmamodul (timer/maskin) aktiveres
 * eller deaktiveres for et firma. Brukes av:
 *   - organisasjon.settFirmamodul (eksplisitt toggle)
 *   - timer.onboarding.aktiverNivaa1 / aktiverTomKatalog (onboarding-flow)
 *
 * Forutsetter at den kallende koden allerede har satt har_*_modul-flagget på
 * Organization-raden i samme transaction. Disse helperne berører kun
 * ProjectModule-tabellen.
 */
import type { Prisma } from "@sitedoc/db";

type TxClient = Prisma.TransactionClient;
export type FirmamodulSlug = "timer" | "maskin";

/**
 * Aktiver firmamodul: opprett eller reaktiver ProjectModule-rader for alle
 * prosjekter firmaet er knyttet til (primary eller partner via
 * ProjectOrganization).
 */
export async function syncProjektModulerPaaAktiver(
  tx: TxClient,
  organizationId: string,
  slug: FirmamodulSlug,
): Promise<void> {
  const prosjekter = await tx.project.findMany({
    where: {
      OR: [
        { primaryOrganizationId: organizationId },
        { projectOrganizations: { some: { organizationId } } },
      ],
    },
    select: { id: true },
  });

  if (prosjekter.length === 0) return;

  await tx.projectModule.updateMany({
    where: {
      organizationId,
      moduleSlug: slug,
      status: { not: "aktiv" },
    },
    data: { status: "aktiv" },
  });

  await tx.projectModule.createMany({
    data: prosjekter.map((p) => ({
      projectId: p.id,
      moduleSlug: slug,
      organizationId,
      status: "aktiv",
    })),
    skipDuplicates: true,
  });
}

/**
 * Deaktiver firmamodul: marker alle aktive ProjectModule-rader for firmaet
 * som arkivert. Rader beholdes — historikk bevares.
 */
export async function syncProjektModulerPaaDeaktiver(
  tx: TxClient,
  organizationId: string,
  slug: FirmamodulSlug,
): Promise<void> {
  await tx.projectModule.updateMany({
    where: {
      organizationId,
      moduleSlug: slug,
      status: "aktiv",
    },
    data: { status: "arkivert" },
  });
}
