/**
 * Seed dedikerte testbrukere for dev-login (agent- + simulator-testing).
 *
 * Tre roller som dekker paritetstestene:
 *   - test-admin@sitedoc.test    → sitedoc_admin
 *   - test-firma@sitedoc.test    → company_admin (medlem av Testfirma AS)
 *   - test-arbeider@sitedoc.test → user, prosjektmedlem UTEN manage_field
 *     (trengs for søke-gating-testen fra steg iv)
 *
 * Alle med canLogin: true. Frikoblet fra personlige OAuth-kontoer.
 *
 * Kjør mot TEST-DB:
 *   DATABASE_URL=<sitedoc_test> pnpm --filter @sitedoc/db exec \
 *     tsx scripts/seed-testbrukere.ts
 *
 * Idempotent (upsert på epost / findFirst på navn). Eposter må matche
 * whitelisten i apps/api/src/routes/dev-login.ts.
 */

import { prisma } from "../src/index";

const ORG_NAVN = "Testfirma AS (agent-test)";
const PROSJEKT_NAVN = "Agent-testprosjekt";

async function main() {
  // Kundefirma for company_admin + arbeider
  let org = await prisma.organization.findFirst({ where: { name: ORG_NAVN } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: ORG_NAVN, erKunde: true },
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: "test-admin@sitedoc.test" },
    create: { email: "test-admin@sitedoc.test", name: "Test Admin", role: "sitedoc_admin", canLogin: true },
    update: { role: "sitedoc_admin", canLogin: true },
  });

  const firma = await prisma.user.upsert({
    where: { email: "test-firma@sitedoc.test" },
    create: { email: "test-firma@sitedoc.test", name: "Test Firmaadmin", role: "company_admin", canLogin: true },
    update: { role: "company_admin", canLogin: true },
  });
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: firma.id, organizationId: org.id } },
    create: { userId: firma.id, organizationId: org.id, ansattRolle: "ansatt", firmaRoller: ["admin"] },
    update: { firmaRoller: ["admin"] },
  });

  const arbeider = await prisma.user.upsert({
    where: { email: "test-arbeider@sitedoc.test" },
    create: { email: "test-arbeider@sitedoc.test", name: "Test Arbeider", role: "user", canLogin: true },
    update: { role: "user", canLogin: true },
  });
  // Firmamedlem (gir firma-kontekst) men vanlig ansatt — ingen firma-admin.
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: arbeider.id, organizationId: org.id } },
    create: { userId: arbeider.id, organizationId: org.id, ansattRolle: "ansatt", firmaRoller: [] },
    update: { firmaRoller: [] },
  });

  // Prosjekt eid av Testfirma — arbeider legges som member UTEN manage_field.
  let prosjekt = await prisma.project.findFirst({ where: { name: PROSJEKT_NAVN } });
  if (!prosjekt) {
    prosjekt = await prisma.project.create({
      data: {
        projectNumber: "AGENT-TEST-0001",
        name: PROSJEKT_NAVN,
        status: "active",
        primaryOrganizationId: org.id,
      },
    });
  }
  const finnesMedlem = await prisma.projectMember.findFirst({
    where: { projectId: prosjekt.id, userId: arbeider.id },
  });
  if (!finnesMedlem) {
    await prisma.projectMember.create({
      data: { projectId: prosjekt.id, userId: arbeider.id, role: "member" },
    });
  }
  // Firmaadmin som prosjekt-admin (så han ser prosjektet i egen kontekst).
  const finnesFirmaMedlem = await prisma.projectMember.findFirst({
    where: { projectId: prosjekt.id, userId: firma.id },
  });
  if (!finnesFirmaMedlem) {
    await prisma.projectMember.create({
      data: { projectId: prosjekt.id, userId: firma.id, role: "admin" },
    });
  }

  console.log("Testbrukere seedet:");
  console.log(`  ${admin.email}     → sitedoc_admin`);
  console.log(`  ${firma.email}     → company_admin (${ORG_NAVN})`);
  console.log(`  ${arbeider.email}  → user, prosjektmedlem uten manage_field`);
  console.log(`  Org: ${org.name} (${org.id})`);
  console.log(`  Prosjekt: ${prosjekt.name} (${prosjekt.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
