import { PrismaClient } from "@prisma/client";

/**
 * Delte seed-hjelpere for firma-tilknytning.
 *
 * Bakgrunn (funnet 2026-09-05): seks seed-filer inlinet hver sin `project.create`
 * og tre av dem glemte firma → orphan-prosjekter (`primaryOrganizationId = null`)
 * som ikke er synlige fra firmakontekst. Det bryter CLAUDE.md § «Firma påkrevd ved
 * prosjekt-opprettelse» (vedtak 2026-05-20), som API-mutasjonene alt håndhever.
 * Én kilde her framfor N punktfikser — neste seed arver riktig oppførsel.
 *
 * UNNTAK: `apps/api/src/test-harness/seed.ts` setter `primaryOrganizationId = null`
 * BEVISST — det tester standalone-prosjektet, som er en gyldig permanent tilstand
 * (CLAUDE.md § Organisasjonsmodellen). Det skal IKKE bruke disse hjelperne.
 */

// Fast id → ÉN stabil demo-firma-rad. Upsert skjer på `id`, ikke navn/org.nr
// (ingen av dem er `@unique` i schemaet) og ALDRI som ny rad per kjøring — et seed
// som lager nytt firma hver gang gir rot på test.
export const DEMO_FIRMA_ID = "de30de30-de30-4de3-8de3-de30de30de30";
export const DEMO_FIRMA_NAVN = "SiteDoc Demo AS";

/** Ett stabilt demo-firma, idempotent. Returnerer organizationId. */
export async function finnEllerOpprettDemoFirma(prisma: PrismaClient): Promise<string> {
  const firma = await prisma.organization.upsert({
    where: { id: DEMO_FIRMA_ID },
    update: {},
    create: {
      id: DEMO_FIRMA_ID,
      name: DEMO_FIRMA_NAVN,
      organizationNumber: "999888777",
      erKunde: true, // reelt kundefirma → firmakontekst + moduler virker i demo
    },
  });
  return firma.id;
}

/**
 * Idempotent firma-medlemskap (unik: `userId_organizationId`). Prosjektet festes
 * til firmaet via `primaryOrganizationId`; DETTE medlemskapet gjør at brukeren ser
 * prosjektet FRA firmakonteksten — ellers finnes prosjektet uten å være synlig,
 * som var hele funnet 2026-09-05.
 */
export async function sikreFirmamedlem(
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
): Promise<void> {
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    update: {},
    create: { userId, organizationId, ansattRolle: "ansatt" },
  });
}
