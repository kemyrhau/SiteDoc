/**
 * Firmamodul-sync (Steg 1c Fase B + Steg 1e Fase A).
 *
 * Synkroniserer ProjectModule-rader når en firmamodul (timer/maskin) aktiveres
 * eller deaktiveres for et firma. Brukes av:
 *   - organisasjon.settFirmamodul (eksplisitt toggle)
 *   - timer.onboarding.aktiverNivaa1 / aktiverTomKatalog (onboarding-flow)
 *
 * Steg 1e Fase A (2026-05-05): nye dual-write-helpere skriver også til den
 * generiske OrganizationModule-tabellen i samme $transaction. har_*_modul-
 * flagget er fortsatt sannhetskilde for alle eksisterende callsites; dual-
 * write garanterer at OrganizationModule-tabellen holder seg synkron til
 * Fase B migrerer callsites og Fase C dropper flaggene.
 */
import { prisma, type Prisma } from "@sitedoc/db";

type TxClient = Prisma.TransactionClient;
export type FirmamodulSlug = "timer" | "maskin";

/**
 * Soft-sjekk mot OrganizationModule-tabellen — returnerer boolean.
 *
 * Steg 1e Fase A: ikke i bruk på lese-vei ennå (callsites leser fortsatt fra
 * Organization.har_*_modul). Klar for Fase B-migrering.
 */
export async function erFirmamodulAktivert(
  organizationId: string,
  slug: FirmamodulSlug,
): Promise<boolean> {
  const rad = await prisma.organizationModule.findUnique({
    where: { organizationId_moduleSlug: { organizationId, moduleSlug: slug } },
    select: { status: true },
  });
  return rad?.status === "aktiv";
}

/**
 * Dual-write hjelper for aktivering: skriv OrganizationModule-rad i samme
 * transaction som Organization.har_*_modul-flagget oppdateres.
 *
 * Idempotent via upsert. aktivertVed oppdateres ved reaktivering. Eksisterende
 * deaktivert_ved/deaktivert_av_user_id nullstilles.
 */
export async function skrivOrganizationModuleAktiver(
  tx: TxClient,
  organizationId: string,
  slug: FirmamodulSlug,
  aktivertAvUserId: string | null,
): Promise<void> {
  await tx.organizationModule.upsert({
    where: { organizationId_moduleSlug: { organizationId, moduleSlug: slug } },
    create: {
      organizationId,
      moduleSlug: slug,
      status: "aktiv",
      aktivertAvUserId,
    },
    update: {
      status: "aktiv",
      aktivertVed: new Date(),
      aktivertAvUserId,
      deaktivertVed: null,
      deaktivertAvUserId: null,
    },
  });
}

/**
 * Dual-write hjelper for deaktivering: marker OrganizationModule-rad som
 * arkivert. Rad beholdes — historikk bevares.
 *
 * No-op hvis raden ikke finnes (skjer hvis flagget aldri har vært aktivert
 * via dual-write-flyten — fanges som forsvar i dybden).
 */
export async function skrivOrganizationModuleDeaktiver(
  tx: TxClient,
  organizationId: string,
  slug: FirmamodulSlug,
  deaktivertAvUserId: string | null,
): Promise<void> {
  await tx.organizationModule.updateMany({
    where: { organizationId, moduleSlug: slug, status: "aktiv" },
    data: {
      status: "arkivert",
      deaktivertVed: new Date(),
      deaktivertAvUserId,
    },
  });
}

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
