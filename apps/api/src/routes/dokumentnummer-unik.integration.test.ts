import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, prisma } from "@sitedoc/db";
import { randomUUID } from "crypto";

/**
 * «Stille tomhet»-rekvittering #2: unikt løpenummer pr. mal på checklists OG tasks
 * (migrering 20260908140000_dokumentnummer_unik — TO unike indekser:
 * `checklists_template_id_number_key` og `tasks_template_id_number_key`).
 *
 * Denne testen går DIREKTE mot databasen (`prisma.checklist.create` / `prisma.task.create`),
 * IKKE gjennom medNummerRetry — retry-logikken dekkes av den rene enhetstesten
 * `utils/nummerRetry.test.ts` (som mocker). DENNE beviser at INDEKSENE faktisk biter i DB,
 * og — like viktig — at de er RIKTIG AVGRENSET: samme nummer under ulik mal er lovlig, og
 * NULL-nummer (maler uten prefix) kolliderer aldri (Postgres NULLS DISTINCT).
 *
 * En mocket test kan ikke skille en riktig avgrenset indeks fra en for bred — det krever
 * ekte Postgres-unikhet. Mål-DB: engangs-sandkasse (aldri test/prod). Seed → teardown i afterAll.
 * Negativ kontroll (P2002 → P9999) kjørt av dokgen 2026-09-16, lokalt mot engangs-Postgres.
 */

const NS = "NUMUNIK";
const ids = {
  userId: "",
  projectId: "",
  templateA: "",
  templateB: "",
  checklistIds: [] as string[],
  taskIds: [] as string[],
};

beforeAll(async () => {
  const kjoreId = randomUUID().slice(0, 8);

  const user = await prisma.user.create({
    data: { id: randomUUID(), name: `${NS} Bestiller`, email: `${NS.toLowerCase()}-${kjoreId}@numunik.test`, role: "user" },
  });
  ids.userId = user.id;

  const project = await prisma.project.create({
    data: { id: randomUUID(), projectNumber: `${NS}-${kjoreId}`, name: `${NS} Prosjekt ${kjoreId}`, primaryOrganizationId: null },
  });
  ids.projectId = project.id;

  const malA = await prisma.reportTemplate.create({
    data: { id: randomUUID(), projectId: project.id, name: `${NS} Mal A`, category: "sjekkliste", domain: "bygg" },
  });
  ids.templateA = malA.id;

  const malB = await prisma.reportTemplate.create({
    data: { id: randomUUID(), projectId: project.id, name: `${NS} Mal B`, category: "sjekkliste", domain: "bygg" },
  });
  ids.templateB = malB.id;
});

afterAll(async () => {
  if (ids.checklistIds.length)
    await prisma.checklist.deleteMany({ where: { id: { in: ids.checklistIds } } });
  if (ids.taskIds.length)
    await prisma.task.deleteMany({ where: { id: { in: ids.taskIds } } });
  await prisma.reportTemplate.deleteMany({ where: { id: { in: [ids.templateA, ids.templateB].filter(Boolean) } } });
  if (ids.projectId) await prisma.project.deleteMany({ where: { id: ids.projectId } });
  if (ids.userId) await prisma.user.deleteMany({ where: { id: ids.userId } });
});

async function lagChecklist(templateId: string, number: number | null): Promise<string> {
  const c = await prisma.checklist.create({
    data: { id: randomUUID(), templateId, bestillerUserId: ids.userId, title: `${NS} sjekkliste`, number, data: {} },
  });
  ids.checklistIds.push(c.id);
  return c.id;
}

async function lagTask(templateId: string, number: number | null): Promise<string> {
  const t = await prisma.task.create({
    data: { id: randomUUID(), templateId, bestillerUserId: ids.userId, title: `${NS} oppgave`, number },
  });
  ids.taskIds.push(t.id);
  return t.id;
}

describe("Dokumentnummer: unik (template_id, number) på checklists (#2)", () => {
  it("blokkerer to sjekklister med samme (mal, nummer) (P2002)", async () => {
    await lagChecklist(ids.templateA, 1);

    let feilkode: string | null = null;
    try {
      await lagChecklist(ids.templateA, 1); // samme mal + samme nummer → skal feile
    } catch (e) {
      feilkode = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : "UKJENT";
    }
    // Uten indeksen ville begge sluppet gjennom (feilkode = null).
    expect(feilkode).toBe("P2002");
  });

  it("tillater samme nummer under ULIK mal — indeksen er scopet til template_id", async () => {
    // Mal A har allerede nummer 1 fra testen over; samme nummer i mal B skal være lov.
    const iB = await lagChecklist(ids.templateB, 1);
    expect(iB).toBeTruthy();
  });

  it("tillater flere NULL-nummer i samme mal — NULLS DISTINCT (maler uten prefix)", async () => {
    const n1 = await lagChecklist(ids.templateA, null);
    const n2 = await lagChecklist(ids.templateA, null);
    // To NULL-nummer i SAMME mal kolliderer ikke — Postgres teller NULL som distinkt.
    expect(n1).not.toBe(n2);
  });
});

describe("Dokumentnummer: unik (template_id, number) på tasks (#2)", () => {
  it("blokkerer to oppgaver med samme (mal, nummer) (P2002)", async () => {
    await lagTask(ids.templateA, 1);

    let feilkode: string | null = null;
    try {
      await lagTask(ids.templateA, 1);
    } catch (e) {
      feilkode = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : "UKJENT";
    }
    expect(feilkode).toBe("P2002");
  });

  it("tillater samme nummer under ULIK mal (tasks)", async () => {
    const tB = await lagTask(ids.templateB, 1);
    expect(tB).toBeTruthy();
  });

  it("tillater flere NULL-nummer i samme mal (tasks, NULLS DISTINCT)", async () => {
    const t1 = await lagTask(ids.templateA, null);
    const t2 = await lagTask(ids.templateA, null);
    expect(t1).not.toBe(t2);
  });
});
