/**
 * Seed 4-ledds DISTINKT-PERSON pilot-flyt for 5b UI-e2e (Kenneths 31.07-sekvens).
 *
 * Forutsetter seed-testbrukere.ts (org + prosjekt + firma/arbeider/bestiller/godkjenner
 * + ProjectMember). Bygger en flyt der HVERT ledд er en ULIK person — det er nettopp
 * distinkt-person-flyten som utøver pilot-buggen (posisjons-ruting), i motsetning til
 * «E2E Flyt» (3-ledд, firma gjenbrukt på reg+godk). Ligger VED SIDEN AV 3-ledds-flyten
 * (erstatter den ikke — de 7 eksisterende spec-ene er urørt).
 *
 *   Faggrupper : «E2E Pilot Bestiller», «E2E Pilot Utfører»
 *   Mal        : «E2E Pilot Sjekklistemal» (domain=bygg)
 *   Flyt       : «E2E Pilot Flyt», 4 ledд med steg 1–4 + klassifisering:
 *     1 registrator (utfor)   → firma        (bestiller-faggruppe = flyt.faggruppeId)
 *     2 bestiller   (kontroll)→ test-bestiller
 *     3 utforer     (utfor)   → arbeider      (utfører-faggruppe, erHovedansvarlig)
 *     4 godkjenner  (kontroll)→ test-godkjenner
 *
 * Idempotent (findFirst + betinget create). Navnene MÅ matche tests/e2e/lib/pilot.ts.
 *
 * Kjør mot TEST-DB (Kenneth, server-ny):
 *   DATABASE_URL=<sitedoc_test> pnpm --filter @sitedoc/db exec tsx scripts/seed-e2e-pilot.ts
 */

import { prisma } from "../src/index";

const PROSJEKT_NUMMER = "AGENT-TEST-0001";
const FLYT_NAVN = "E2E Pilot Flyt";
const MAL_NAVN = "E2E Pilot Sjekklistemal";
const BESTILLER_NAVN = "E2E Pilot Bestiller";
const UTFORER_NAVN = "E2E Pilot Utfører";

async function main() {
  const prosjekt = await prisma.project.findFirst({ where: { projectNumber: PROSJEKT_NUMMER } });
  if (!prosjekt) throw new Error(`Fant ikke prosjekt ${PROSJEKT_NUMMER}. Kjør seed-testbrukere.ts først.`);

  // Fire distinkte personer.
  const eposter = {
    firma: "test-firma@sitedoc.test",
    bestiller: "test-bestiller@sitedoc.test",
    arbeider: "test-arbeider@sitedoc.test",
    godkjenner: "test-godkjenner@sitedoc.test",
  } as const;
  const brukere: Record<keyof typeof eposter, { id: string }> = {} as never;
  for (const [rolle, epost] of Object.entries(eposter) as [keyof typeof eposter, string][]) {
    const u = await prisma.user.findUnique({ where: { email: epost } });
    if (!u) throw new Error(`Mangler ${epost}. Kjør seed-testbrukere.ts først.`);
    brukere[rolle] = u;
  }
  // ProjectMember per person.
  const medlem: Record<keyof typeof eposter, { id: string }> = {} as never;
  for (const rolle of Object.keys(eposter) as (keyof typeof eposter)[]) {
    const pm = await prisma.projectMember.findFirst({ where: { projectId: prosjekt.id, userId: brukere[rolle].id } });
    if (!pm) throw new Error(`Mangler ProjectMember for ${eposter[rolle]}. Kjør seed-testbrukere.ts først.`);
    medlem[rolle] = pm;
  }

  // Faggrupper (bestiller = flyt.faggruppeId; utfører = ledд 3s faggruppe).
  async function sikreFaggruppe(name: string, color: string) {
    const f = await prisma.faggruppe.findFirst({ where: { projectId: prosjekt!.id, name } });
    return f ?? prisma.faggruppe.create({ data: { projectId: prosjekt!.id, name, color } });
  }
  const bestillerFg = await sikreFaggruppe(BESTILLER_NAVN, "#1e40af");
  const utforerFg = await sikreFaggruppe(UTFORER_NAVN, "#10b981");

  async function sikreKobling(projectMemberId: string, faggruppeId: string) {
    const k = await prisma.faggruppeKobling.findFirst({ where: { projectMemberId, faggruppeId } });
    if (!k) await prisma.faggruppeKobling.create({ data: { projectMemberId, faggruppeId } });
  }
  await sikreKobling(medlem.firma.id, bestillerFg.id);
  await sikreKobling(medlem.arbeider.id, utforerFg.id);

  // Mal (domain=bygg → flyt-bærende).
  let mal = await prisma.reportTemplate.findFirst({ where: { projectId: prosjekt.id, name: MAL_NAVN } });
  if (!mal) {
    mal = await prisma.reportTemplate.create({
      data: { projectId: prosjekt.id, name: MAL_NAVN, domain: "bygg", category: "sjekkliste" },
    });
  }
  const harObjekt = await prisma.reportObject.findFirst({ where: { templateId: mal.id } });
  if (!harObjekt) {
    await prisma.reportObject.create({
      data: { templateId: mal.id, type: "traffic_light", label: "Utført korrekt", sortOrder: 0 },
    });
  }

  // Flyt (4 roller).
  const roller = [{ rolle: "registrator" }, { rolle: "bestiller" }, { rolle: "utforer" }, { rolle: "godkjenner" }];
  let flyt = await prisma.dokumentflyt.findFirst({ where: { projectId: prosjekt.id, name: FLYT_NAVN } });
  if (!flyt) {
    flyt = await prisma.dokumentflyt.create({
      data: { projectId: prosjekt.id, name: FLYT_NAVN, faggruppeId: bestillerFg.id, roller },
    });
  } else if (flyt.faggruppeId !== bestillerFg.id) {
    flyt = await prisma.dokumentflyt.update({ where: { id: flyt.id }, data: { faggruppeId: bestillerFg.id, roller } });
  }

  const malKobling = await prisma.dokumentflytMal.findFirst({ where: { dokumentflytId: flyt.id, templateId: mal.id } });
  if (!malKobling) await prisma.dokumentflytMal.create({ data: { dokumentflytId: flyt.id, templateId: mal.id } });

  // Medlemmer — steg 1–4 + klassifisering, hver bundet til sin distinkte persons projectMember.
  // Ledд 3 (utfører) bindes òg til utfører-faggruppen (opprett-modalens utforerFaggruppeId).
  async function sikreMedlem(
    rolle: string,
    steg: number,
    klassifisering: string,
    binding: { projectMemberId?: string; faggruppeId?: string },
    erHovedansvarlig = false,
  ) {
    const eks = await prisma.dokumentflytMedlem.findFirst({ where: { dokumentflytId: flyt!.id, rolle, steg } });
    if (!eks) {
      await prisma.dokumentflytMedlem.create({
        data: { dokumentflytId: flyt!.id, rolle, steg, klassifisering, erHovedansvarlig, ...binding },
      });
    }
  }
  await sikreMedlem("registrator", 1, "utfor", { projectMemberId: medlem.firma.id });
  await sikreMedlem("bestiller", 2, "kontroll", { projectMemberId: medlem.bestiller.id });
  await sikreMedlem("utforer", 3, "utfor", { projectMemberId: medlem.arbeider.id, faggruppeId: utforerFg.id }, true);
  await sikreMedlem("godkjenner", 4, "kontroll", { projectMemberId: medlem.godkjenner.id });

  console.log("E2E PILOT-flyt (4-ledд distinkt-person) seedet:");
  console.log(`  Prosjekt : ${prosjekt.name} (${prosjekt.id})`);
  console.log(`  Flyt     : ${flyt.name} (${flyt.id})`);
  console.log(`  Mal      : ${mal.name} (${mal.id})`);
  console.log(`  Bestiller-faggruppe: ${bestillerFg.name} (${bestillerFg.id})`);
  console.log(`  Utfører-faggruppe  : ${utforerFg.name} (${utforerFg.id})`);
  console.log("  Ledд: 1 firma(reg) → 2 bestiller → 3 arbeider(utf) → 4 godkjenner — FIRE distinkte personer");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
