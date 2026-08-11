/**
 * Røyktest #10 — sjekkliste-/oppgavegrensen (interim-vedtak 2026-07-26).
 *
 * EGEN røyktest, IKKE del av Playwright-e2e-suiten (tests/e2e/) — grensen skal
 * aldri treffe agentprosjektet (firma-tilknyttet → grenseløst), så den får sin
 * egen isolerte verifisering her. Testkandidat #10.
 *
 * Verifiserer mot EKTE test-DB:
 *   1. erStandaloneProsjekt() (apps/api) — count av ProjectOrganization:
 *        standalone-prosjekt (uten firma) → true
 *        firma-tilknyttet prosjekt        → false
 *   2. grenseNaadd() (@sitedoc/shared) — hele DoD-matrisen med de EKTE
 *      standalone-flaggene fra (1):
 *        standalone under 10  → ok
 *        standalone på 10     → FORBIDDEN
 *        firma på 10 (+ over) → ok (grenseløst)
 *        sitedoc_admin        → alltid ok (bypass)
 *
 * Seeder to isolerte prosjekter (idempotent pre-clean), asserter, rydder opp.
 * Ingen sjekklister opprettes (grenseNaadd tar antallet som parameter) → ingen
 * varsling/transaksjoner/side-effekter mot delt testdata.
 *
 * Kjør mot TEST-DB (aldri prod):
 *   DATABASE_URL=<sitedoc_test> pnpm --filter @sitedoc/api exec \
 *     tsx scripts/roykt-grense.ts
 */

import { prisma } from "@sitedoc/db";
import { grenseNaadd, GRATIS_DOKUMENT_GRENSE } from "@sitedoc/shared";
import { erStandaloneProsjekt } from "../src/utils/prosjektGrense";

const STANDALONE_NR = "GRENSE-ROYKT-STANDALONE";
const FIRMA_NR = "GRENSE-ROYKT-FIRMA";
const ORG_NAVN = "Grense-røyktest firma";

let feil = 0;
function sjekk(navn: string, faktisk: unknown, forventet: unknown) {
  const ok = faktisk === forventet;
  if (!ok) feil++;
  console.log(`  ${ok ? "✓" : "✗"} ${navn} (forventet ${forventet}, fikk ${faktisk})`);
}

async function ryddOpp() {
  // Prosjektene har ingen barn utover ProjectOrganization i denne røyktesten.
  const prosjekter = await prisma.project.findMany({
    where: { projectNumber: { in: [STANDALONE_NR, FIRMA_NR] } },
    select: { id: true },
  });
  const ider = prosjekter.map((p) => p.id);
  if (ider.length) {
    await prisma.projectOrganization.deleteMany({ where: { projectId: { in: ider } } });
    await prisma.project.deleteMany({ where: { id: { in: ider } } });
  }
}

async function main() {
  // Idempotent: rydd bort eventuelle rester fra en avbrutt kjøring.
  await ryddOpp();

  // Firma til det firma-tilknyttede prosjektet (find-or-create, egen røyktest-org).
  let org = await prisma.organization.findFirst({ where: { name: ORG_NAVN } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: ORG_NAVN, erKunde: true } });
  }

  // Standalone-prosjekt: INGEN ProjectOrganization → prøve.
  const standalone = await prisma.project.create({
    data: { name: "Grense-røyktest standalone", projectNumber: STANDALONE_NR },
  });

  // Firma-prosjekt: primaryOrganizationId + ProjectOrganization → ordinært.
  const firma = await prisma.project.create({
    data: {
      name: "Grense-røyktest firma-prosjekt",
      projectNumber: FIRMA_NR,
      primaryOrganizationId: org.id,
      projectOrganizations: { create: { organizationId: org.id } },
    },
  });

  try {
    console.log("1) erStandaloneProsjekt() mot ekte DB:");
    const standaloneErStandalone = await erStandaloneProsjekt(prisma, standalone.id);
    const firmaErStandalone = await erStandaloneProsjekt(prisma, firma.id);
    sjekk("standalone-prosjekt → true", standaloneErStandalone, true);
    sjekk("firma-prosjekt → false", firmaErStandalone, false);

    console.log(`\n2) grenseNaadd() med ekte standalone-flagg (grense=${GRATIS_DOKUMENT_GRENSE}):`);
    sjekk(
      "standalone under grensen → ikke nådd",
      grenseNaadd({
        erSitedocAdmin: false,
        erStandaloneProsjekt: standaloneErStandalone,
        antallEksisterende: GRATIS_DOKUMENT_GRENSE - 1,
      }),
      false,
    );
    sjekk(
      "standalone på grensen → nådd (FORBIDDEN)",
      grenseNaadd({
        erSitedocAdmin: false,
        erStandaloneProsjekt: standaloneErStandalone,
        antallEksisterende: GRATIS_DOKUMENT_GRENSE,
      }),
      true,
    );
    sjekk(
      "firma på grensen → ikke nådd (grenseløst)",
      grenseNaadd({
        erSitedocAdmin: false,
        erStandaloneProsjekt: firmaErStandalone,
        antallEksisterende: GRATIS_DOKUMENT_GRENSE,
      }),
      false,
    );
    sjekk(
      "firma langt over grensen → ikke nådd (grenseløst)",
      grenseNaadd({
        erSitedocAdmin: false,
        erStandaloneProsjekt: firmaErStandalone,
        antallEksisterende: 500,
      }),
      false,
    );
    sjekk(
      "sitedoc_admin på standalone over grensen → ikke nådd (bypass)",
      grenseNaadd({
        erSitedocAdmin: true,
        erStandaloneProsjekt: standaloneErStandalone,
        antallEksisterende: 999,
      }),
      false,
    );
  } finally {
    await ryddOpp();
  }

  console.log(`\n${feil === 0 ? "RØYKTEST #10 GRØNN ✅" : `RØYKTEST #10 FEILET (${feil}) ❌`}`);
  return feil;
}

main()
  .then((f) => process.exit(f === 0 ? 0 : 1))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
