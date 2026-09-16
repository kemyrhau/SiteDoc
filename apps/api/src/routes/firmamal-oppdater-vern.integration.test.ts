import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { firmamalRouter } from "./firmamal";

/**
 * Ordre vern-oppdater-kopi (dokgen funn #21): `firmamal.oppdaterKopiFraHovedmal` (↻ i
 * prosjektet) ERSTATTER hele objekt-treet med nye id-er. Checklist/Task.data er nøklet på
 * objekt-id, så utfylte dokumenter ville mistet dataene sine. Serveren skal nekte ↻ når
 * prosjektmalens NÅVÆRENDE objekter har faktisk innhold i et aktivt dokument — samme
 * predikat/feilkode (PRECONDITION_FAILED) som mal.slettObjekt.
 *
 * Går gjennom PROSEDYREN (createCaller), ikke rett mot DB — poenget er at SPERREN biter.
 * Begge retninger (krav 5): mal med utfylt dokument → nektes; mal uten → går gjennom.
 * En sperre som nekter alltid er ubrukelig, derfor er retning 2 like viktig.
 *
 * Negativ kontroll (ordre): fjernet antallDok-sjekken i firmamal.ts → retning 1 ble grønn
 * (↻ slapp gjennom, dokument-datene ble foreldreløse). Satt tilbake → rød igjen. Verifisert
 * mot lokal pgvector 2026-09-17.
 *
 * Auth: sitedoc_admin-bruker → verifiserAdmin returnerer umiddelbart (ingen ProjectMember).
 * Mål-DB: localhost/CI-sandkasse (verifisert ikke test/prod). Seed → teardown i afterAll.
 */

const ids = {
  userId: "",
  orgId: "",
  firmamalId: "",
  firmamalObjektId: "",
  projectId: "",
  malMedDokId: "",
  malUtenDokId: "",
  objektMedDokId: "",
  checklistId: "",
};

async function lagFirmamalMedObjekt(navn: string): Promise<string> {
  const fm = await prisma.organizationTemplate.create({
    data: { organizationId: ids.orgId, name: navn, category: "sjekkliste" },
  });
  await prisma.organizationTemplateObject.create({
    data: { templateId: fm.id, type: "traffic_light", label: "Resultat", sortOrder: 1 },
  });
  return fm.id;
}

async function lagProsjektmalMedObjekt(navn: string, firmamalId: string): Promise<{ malId: string; objektId: string }> {
  const mal = await prisma.reportTemplate.create({
    data: { projectId: ids.projectId, name: navn, category: "sjekkliste", organizationTemplateId: firmamalId, versjonAvHovedmal: 1 },
  });
  const obj = await prisma.reportObject.create({
    data: { templateId: mal.id, type: "traffic_light", label: "Resultat", sortOrder: 1 },
  });
  return { malId: mal.id, objektId: obj.id };
}

beforeAll(async () => {
  const bruker = await prisma.user.create({
    data: { email: "vern-oppdater-test@sitedoc.test", name: "Vern-test admin", role: "sitedoc_admin" },
  });
  ids.userId = bruker.id;

  const org = await prisma.organization.create({ data: { name: "Test-firma vern-oppdater" } });
  ids.orgId = org.id;

  const prosjekt = await prisma.project.create({
    data: { projectNumber: "SD-VERN-OPPDATER-1", name: "Vern-oppdater-prosjekt", primaryOrganizationId: org.id },
  });
  ids.projectId = prosjekt.id;

  ids.firmamalId = await lagFirmamalMedObjekt("Firmamal for ↻");

  // Prosjektmal MED utfylt dokument (retning 1).
  const medDok = await lagProsjektmalMedObjekt("Prosjektmal med dokument", ids.firmamalId);
  ids.malMedDokId = medDok.malId;
  ids.objektMedDokId = medDok.objektId;
  const cl = await prisma.checklist.create({
    data: {
      templateId: medDok.malId,
      bestillerUserId: ids.userId,
      title: "Utfylt sjekkliste",
      // data nøklet på objekt-id, med FAKTISK verdi → teller som «i bruk».
      data: { [medDok.objektId]: { verdi: "green" } },
    },
  });
  ids.checklistId = cl.id;

  // Prosjektmal UTEN dokument (retning 2).
  const utenDok = await lagProsjektmalMedObjekt("Prosjektmal uten dokument", ids.firmamalId);
  ids.malUtenDokId = utenDok.malId;
});

afterAll(async () => {
  if (ids.checklistId) await prisma.checklist.deleteMany({ where: { id: ids.checklistId } });
  await prisma.reportObject.deleteMany({ where: { template: { projectId: ids.projectId } } });
  await prisma.reportTemplate.deleteMany({ where: { projectId: ids.projectId } });
  if (ids.projectId) await prisma.project.deleteMany({ where: { id: ids.projectId } });
  await prisma.organizationTemplateObject.deleteMany({ where: { templateId: ids.firmamalId } });
  if (ids.firmamalId) await prisma.organizationTemplate.deleteMany({ where: { id: ids.firmamalId } });
  if (ids.orgId) await prisma.organization.deleteMany({ where: { id: ids.orgId } });
  if (ids.userId) await prisma.user.deleteMany({ where: { id: ids.userId } });
});

function lagCaller() {
  const ctx = {
    userId: ids.userId,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: () => {}, warn: () => {} } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return firmamalRouter.createCaller(ctx);
}

describe("firmamal.oppdaterKopiFraHovedmal — vern mot foreldreløs dokumentdata (funn #21)", () => {
  it("(1) NEKTER ↻ når prosjektmalens objekter har innhold i et aktivt dokument", async () => {
    let feilkode: string | null = null;
    let melding = "";
    try {
      await lagCaller().oppdaterKopiFraHovedmal({ templateId: ids.malMedDokId });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      feilkode = err.code ?? "UKJENT";
      melding = err.message ?? "";
    }
    expect(feilkode).toBe("PRECONDITION_FAILED");
    expect(melding).toContain("Hent fra arkiv");

    // Vernet skrev ingenting: objektet (med sin id) står fortsatt, dokumentet er intakt.
    const objekt = await prisma.reportObject.findUnique({ where: { id: ids.objektMedDokId } });
    expect(objekt).not.toBeNull();
  });

  it("(2) TILLATER ↻ når prosjektmalen ikke har utfylte dokumenter", async () => {
    const res = await lagCaller().oppdaterKopiFraHovedmal({ templateId: ids.malUtenDokId });
    expect(res.id).toBe(ids.malUtenDokId);
    // Treet ble erstattet fra firmamalen (ett objekt kopiert inn).
    const antall = await prisma.reportObject.count({ where: { templateId: ids.malUtenDokId } });
    expect(antall).toBeGreaterThan(0);
  });
});
