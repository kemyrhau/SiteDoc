/**
 * Seed en KOMPLETT dokumentflyt på Agent-testprosjektet for e2e-riggen.
 *
 * Forutsetter at seed-testbrukere.ts allerede har kjørt (org + prosjekt +
 * test-firma/test-arbeider + ProjectMember). Bygger oppå det:
 *
 *   Faggrupper : «E2E Bestiller», «E2E Utfører»
 *   Koblinger  : test-firma → Bestiller, test-arbeider → Utfører
 *   Mal        : «E2E Sjekklistemal» (domain=bygg)
 *   Flyt       : «E2E Flyt», roller [registrator, utforer, godkjenner],
 *                faggruppeId = Bestiller (kreves av web-opprett-modalen)
 *   Medlemmer  : registrator→firma (projectMember), utforer→Utfører-faggruppe
 *                (erHovedansvarlig), godkjenner→firma (projectMember)
 *
 * → tre distinkte rolle-ledd (regresjonssignal for byggLedd) + test-arbeider
 *   gjenkjennes som utfører via faggruppe (H3 videresend-per-rolle).
 *
 * Idempotent (findFirst + betinget create). Navnene MÅ matche
 * tests/e2e/lib/flyt.ts (E2E_FLYT_NAVN / E2E_MAL_NAVN).
 *
 * Kjør mot TEST-DB:
 *   DATABASE_URL=<sitedoc_test> pnpm --filter @sitedoc/db exec \
 *     tsx scripts/seed-e2e-flyt.ts
 */

import { prisma } from "../src/index";

const PROSJEKT_NUMMER = "AGENT-TEST-0001";
const FLYT_NAVN = "E2E Flyt";
const MAL_NAVN = "E2E Sjekklistemal";
const BESTILLER_NAVN = "E2E Bestiller";
const UTFORER_NAVN = "E2E Utfører";

async function main() {
  const prosjekt = await prisma.project.findFirst({ where: { projectNumber: PROSJEKT_NUMMER } });
  if (!prosjekt) {
    throw new Error(
      `Fant ikke prosjekt ${PROSJEKT_NUMMER}. Kjør seed-testbrukere.ts først.`,
    );
  }

  const firma = await prisma.user.findUnique({ where: { email: "test-firma@sitedoc.test" } });
  const arbeider = await prisma.user.findUnique({ where: { email: "test-arbeider@sitedoc.test" } });
  if (!firma || !arbeider) {
    throw new Error("Mangler test-firma/test-arbeider. Kjør seed-testbrukere.ts først.");
  }

  const firmaMedlem = await prisma.projectMember.findFirst({
    where: { projectId: prosjekt.id, userId: firma.id },
  });
  const arbeiderMedlem = await prisma.projectMember.findFirst({
    where: { projectId: prosjekt.id, userId: arbeider.id },
  });
  if (!firmaMedlem || !arbeiderMedlem) {
    throw new Error("Mangler ProjectMember for firma/arbeider. Kjør seed-testbrukere.ts først.");
  }

  // Faggrupper
  async function sikreFaggruppe(name: string, color: string) {
    const f = await prisma.faggruppe.findFirst({ where: { projectId: prosjekt!.id, name } });
    return f ?? prisma.faggruppe.create({ data: { projectId: prosjekt!.id, name, color } });
  }
  const bestiller = await sikreFaggruppe(BESTILLER_NAVN, "#1e40af");
  const utforer = await sikreFaggruppe(UTFORER_NAVN, "#10b981");

  // Faggruppe-koblinger (bruker → faggruppe)
  async function sikreKobling(projectMemberId: string, faggruppeId: string) {
    const k = await prisma.faggruppeKobling.findFirst({ where: { projectMemberId, faggruppeId } });
    if (!k) await prisma.faggruppeKobling.create({ data: { projectMemberId, faggruppeId } });
  }
  await sikreKobling(firmaMedlem.id, bestiller.id);
  await sikreKobling(arbeiderMedlem.id, utforer.id);

  // Mal (domain=bygg → flyt-bærende, ikke HMS)
  let mal = await prisma.reportTemplate.findFirst({
    where: { projectId: prosjekt.id, name: MAL_NAVN },
  });
  if (!mal) {
    mal = await prisma.reportTemplate.create({
      data: { projectId: prosjekt.id, name: MAL_NAVN, domain: "bygg", category: "sjekkliste" },
    });
  }
  // Ett innhold-objekt så dokumentet ikke er tomt (idempotent).
  const harObjekt = await prisma.reportObject.findFirst({ where: { templateId: mal.id } });
  if (!harObjekt) {
    await prisma.reportObject.create({
      data: { templateId: mal.id, type: "traffic_light", label: "Utført korrekt", sortOrder: 0 },
    });
  }

  // Flyt
  let flyt = await prisma.dokumentflyt.findFirst({
    where: { projectId: prosjekt.id, name: FLYT_NAVN },
  });
  if (!flyt) {
    flyt = await prisma.dokumentflyt.create({
      data: {
        projectId: prosjekt.id,
        name: FLYT_NAVN,
        faggruppeId: bestiller.id,
        roller: [{ rolle: "registrator" }, { rolle: "utforer" }, { rolle: "godkjenner" }],
      },
    });
  } else if (flyt.faggruppeId !== bestiller.id) {
    flyt = await prisma.dokumentflyt.update({
      where: { id: flyt.id },
      data: {
        faggruppeId: bestiller.id,
        roller: [{ rolle: "registrator" }, { rolle: "utforer" }, { rolle: "godkjenner" }],
      },
    });
  }

  // Mal-kobling
  const malKobling = await prisma.dokumentflytMal.findFirst({
    where: { dokumentflytId: flyt.id, templateId: mal.id },
  });
  if (!malKobling) {
    await prisma.dokumentflytMal.create({ data: { dokumentflytId: flyt.id, templateId: mal.id } });
  }

  // Medlemmer (periodeSlutt=null=aktiv, steg=1)
  async function sikreMedlem(
    rolle: string,
    binding: { projectMemberId?: string; faggruppeId?: string },
    erHovedansvarlig = false,
  ) {
    const eksisterende = await prisma.dokumentflytMedlem.findFirst({
      where: { dokumentflytId: flyt!.id, rolle, ...binding },
    });
    if (!eksisterende) {
      await prisma.dokumentflytMedlem.create({
        data: { dokumentflytId: flyt!.id, rolle, steg: 1, erHovedansvarlig, ...binding },
      });
    }
  }
  await sikreMedlem("registrator", { projectMemberId: firmaMedlem.id });
  // Utfører bundet til BÅDE arbeiders projectMember (→ konkret recipientUserId,
  // «Venter på»-chip + ball-oppslag) OG Utfører-faggruppen (→ modalens
  // utforerFaggruppeId + faggruppe-rolleoppslag). Arbeider er non-admin → ekte
  // utfører-rettigheter (H3 videresend-per-rolle).
  await sikreMedlem("utforer", { projectMemberId: arbeiderMedlem.id, faggruppeId: utforer.id }, true);
  await sikreMedlem("godkjenner", { projectMemberId: firmaMedlem.id });

  console.log("E2E-flyt seedet:");
  console.log(`  Prosjekt : ${prosjekt.name} (${prosjekt.id})`);
  console.log(`  Flyt     : ${flyt.name} (${flyt.id})`);
  console.log(`  Mal      : ${mal.name} (${mal.id})`);
  console.log(`  Bestiller: ${bestiller.name} (${bestiller.id})`);
  console.log(`  Utfører  : ${utforer.name} (${utforer.id})`);
  console.log("  Roller   : registrator(firma) → utforer(Utfører-faggruppe) → godkjenner(firma)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
