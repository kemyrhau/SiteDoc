import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createTestCaller } from "../test-harness/context";
import { byggeplassFilterViaTegning } from "../services/byggeplassFilter";

/**
 * ORDRE 28 — byggeplass følger dokumentet (`tasks.byggeplass_id`), mot ekte Postgres.
 *
 * Låser fire ting en mocket test ikke kan skille fra feil oppførsel:
 *  1. Backfillen i migreringsfila (kjøres ORDRETT herfra) fyller kun rader uten egen byggeplass
 *     med en tegning som selv har byggeplass — prosjekt-tegning/uten tegning forblir NULL.
 *  2. `oppgave.opprett` lagrer klientens byggeplass, lar tegningens vinne, og avviser en
 *     byggeplass fra et annet prosjekt.
 *  3. `oppgave.oppdater` med ny tegning flytter byggeplassen og nullstiller punktet.
 *  4. Filteret (fire ledd) gir riktig sett i ekte SQL.
 *
 * Mål-DB: engangs-sandkasse (aldri test/prod). Seed → teardown i afterAll.
 */

const NS = "TASKBP";
const ids = {
  userId: "",
  projectId: "",
  fremmedProjectId: "",
  bp1: "",
  bp2: "",
  fremmedBp: "",
  tegningBp1: "",
  tegningBp2: "",
  tegningProsjekt: "",
  templateId: "",
  groupId: "",
  taskIds: [] as string[],
};

beforeAll(async () => {
  const kjoreId = randomUUID().slice(0, 8);
  // sitedoc_admin: hopper over gratis-grense og medlemskaps-oppslag — testen gjelder byggeplass.
  const user = await prisma.user.create({
    data: { id: randomUUID(), name: `${NS} Admin`, email: `${NS.toLowerCase()}-${kjoreId}@taskbp.test`, role: "sitedoc_admin" },
  });
  ids.userId = user.id;

  const [p, fremmed] = await Promise.all([
    prisma.project.create({ data: { id: randomUUID(), projectNumber: `${NS}-${kjoreId}`, name: `${NS} ${kjoreId}` } }),
    prisma.project.create({ data: { id: randomUUID(), projectNumber: `${NS}F-${kjoreId}`, name: `${NS} fremmed ${kjoreId}` } }),
  ]);
  ids.projectId = p.id;
  ids.fremmedProjectId = fremmed.id;

  const [bp1, bp2, fremmedBp] = await Promise.all([
    prisma.byggeplass.create({ data: { projectId: p.id, name: `${NS} Bygg 1` } }),
    prisma.byggeplass.create({ data: { projectId: p.id, name: `${NS} Bygg 2` } }),
    prisma.byggeplass.create({ data: { projectId: fremmed.id, name: `${NS} Fremmed` } }),
  ]);
  ids.bp1 = bp1.id;
  ids.bp2 = bp2.id;
  ids.fremmedBp = fremmedBp.id;

  const tegning = (byggeplassId: string | null, navn: string) =>
    prisma.drawing.create({
      data: { projectId: p.id, byggeplassId, name: `${NS} ${navn}`, fileUrl: "/uploads/x.pdf", fileType: "pdf" },
    });
  const [t1, t2, tp] = await Promise.all([tegning(bp1.id, "T1"), tegning(bp2.id, "T2"), tegning(null, "Prosjekt")]);
  ids.tegningBp1 = t1.id;
  ids.tegningBp2 = t2.id;
  ids.tegningProsjekt = tp.id;

  // HMS-mal: opprett-grenen uten faggruppe/flyt (krever kun HMS-gruppe) — minst mulig oppsett.
  const mal = await prisma.reportTemplate.create({
    data: { id: randomUUID(), projectId: p.id, name: `${NS} Avvik`, category: "oppgave", domain: "hms" },
  });
  ids.templateId = mal.id;
  const gruppe = await prisma.projectGroup.create({
    data: { projectId: p.id, name: `${NS} HMS`, slug: `hms-${kjoreId}`, domains: ["hms"] },
  });
  ids.groupId = gruppe.id;
});

afterAll(async () => {
  if (ids.taskIds.length) await prisma.task.deleteMany({ where: { id: { in: ids.taskIds } } });
  await prisma.task.deleteMany({ where: { templateId: ids.templateId } });
  if (ids.groupId) await prisma.projectGroup.deleteMany({ where: { id: ids.groupId } });
  if (ids.templateId) await prisma.reportTemplate.deleteMany({ where: { id: ids.templateId } });
  await prisma.drawing.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.byggeplass.deleteMany({ where: { projectId: { in: [ids.projectId, ids.fremmedProjectId] } } });
  await prisma.project.deleteMany({ where: { id: { in: [ids.projectId, ids.fremmedProjectId] } } });
  if (ids.userId) await prisma.user.deleteMany({ where: { id: ids.userId } });
});

async function lagTask(data: { drawingId?: string | null; byggeplassId?: string | null }): Promise<string> {
  const t = await prisma.task.create({
    data: { templateId: ids.templateId, bestillerUserId: ids.userId, title: `${NS} oppgave`, ...data },
  });
  ids.taskIds.push(t.id);
  return t.id;
}

async function byggeplassFor(id: string): Promise<string | null> {
  return (await prisma.task.findUniqueOrThrow({ where: { id }, select: { byggeplassId: true } })).byggeplassId;
}

/** Backfill-UPDATE-en ordrett fra migreringsfila — testen følger fila, ikke en kopi. */
function backfillSql(): string {
  const fil = resolve(
    __dirname,
    "../../../../packages/db/prisma/migrations/20261106120000_task_byggeplass/migration.sql",
  );
  const sql = readFileSync(fil, "utf8");
  const start = sql.indexOf('UPDATE "tasks"');
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start).trim().replace(/;$/, "");
}

describe("ORDRE 28: backfill fra migreringsfila", () => {
  it("🔴 fyller kun egen-løse oppgaver på tegning med byggeplass", async () => {
    const påBp1 = await lagTask({ drawingId: ids.tegningBp1 });
    const påProsjekt = await lagTask({ drawingId: ids.tegningProsjekt });
    const utenTegning = await lagTask({});
    const egenBp2 = await lagTask({ drawingId: ids.tegningBp1, byggeplassId: ids.bp2 });

    const mine = [påBp1, påProsjekt, utenTegning, egenBp2];
    const nullFør = await prisma.task.count({ where: { id: { in: mine }, byggeplassId: null } });
    expect(nullFør).toBe(3);

    await prisma.$executeRawUnsafe(backfillSql());

    expect(await byggeplassFor(påBp1)).toBe(ids.bp1);
    expect(await byggeplassFor(påProsjekt)).toBeNull();
    expect(await byggeplassFor(utenTegning)).toBeNull();
    expect(await byggeplassFor(egenBp2)).toBe(ids.bp2); // egen verdi overskrives aldri
    const nullEtter = await prisma.task.count({ where: { id: { in: mine }, byggeplassId: null } });
    expect(nullEtter).toBe(2);
  });
});

describe("ORDRE 28: oppgave.opprett", () => {
  it("🔴 lagrer aktiv byggeplass fra klienten når oppgaven ikke har tegning", async () => {
    const caller = createTestCaller(ids.userId);
    const opprettet = await caller.oppgave.opprett({ templateId: ids.templateId, title: "Avvik", byggeplassId: ids.bp1 });
    ids.taskIds.push(opprettet.id);
    expect(await byggeplassFor(opprettet.id)).toBe(ids.bp1);
  });

  it("🔴 tegningens byggeplass vinner over klientens", async () => {
    const caller = createTestCaller(ids.userId);
    const opprettet = await caller.oppgave.opprett({
      templateId: ids.templateId,
      title: "Avvik",
      byggeplassId: ids.bp1,
      drawingId: ids.tegningBp2,
    });
    ids.taskIds.push(opprettet.id);
    expect(await byggeplassFor(opprettet.id)).toBe(ids.bp2);
  });

  it("🔴 avviser byggeplass fra et annet prosjekt", async () => {
    const caller = createTestCaller(ids.userId);
    const feil = await caller.oppgave
      .opprett({ templateId: ids.templateId, title: "Avvik", byggeplassId: ids.fremmedBp })
      .then(() => null)
      .catch((e: unknown) => e as Error);
    expect(feil).toBeTruthy();
  });
});

describe("ORDRE 28: oppgave.oppdater — bytt tegning", () => {
  it("🔴 byggeplass følger ny tegning og punktet nullstilles", async () => {
    const id = await lagTask({ drawingId: ids.tegningBp1, byggeplassId: ids.bp1 });
    await prisma.task.update({ where: { id }, data: { positionX: 40, positionY: 60 } });

    const caller = createTestCaller(ids.userId);
    await caller.oppgave.oppdater({ id, drawingId: ids.tegningBp2 });

    const etter = await prisma.task.findUniqueOrThrow({
      where: { id },
      select: { byggeplassId: true, drawingId: true, positionX: true, positionY: true },
    });
    expect(etter).toEqual({ byggeplassId: ids.bp2, drawingId: ids.tegningBp2, positionX: null, positionY: null });
  });
});

describe("TILLEGG ORDRE 28: oppgave.oppdater — område/«hele byggeplassen» (drawingId: null)", () => {
  it("🔴 byggeplassen forsvinner ikke når web-LokasjonVelger fjerner tegningen", async () => {
    const id = await lagTask({ drawingId: ids.tegningBp1, byggeplassId: ids.bp1 });
    const caller = createTestCaller(ids.userId);
    // Samme input som oppgave-detaljens LokasjonVelger sender ved «Gjelder hele byggeplassen».
    await caller.oppgave.oppdater({
      id,
      drawingId: null,
      positionX: null,
      positionY: null,
      lokasjonOmfang: "byggeplass",
      lokasjonFritekst: null,
      omradeId: null,
    });
    const etter = await prisma.task.findUniqueOrThrow({
      where: { id },
      select: { byggeplassId: true, drawingId: true, lokasjonOmfang: true },
    });
    expect(etter).toEqual({ byggeplassId: ids.bp1, drawingId: null, lokasjonOmfang: "byggeplass" });
  });
});

describe("ORDRE 28: byggeplassFilterViaTegning i ekte SQL", () => {
  it("🔴 egen byggeplass styrer — også uten tegning og over en annen tegnings byggeplass", async () => {
    const egenUtenTegning = await lagTask({ byggeplassId: ids.bp1 });
    const egenBp2PåTegningBp1 = await lagTask({ drawingId: ids.tegningBp1, byggeplassId: ids.bp2 });
    const arvViaTegning = await lagTask({ drawingId: ids.tegningBp1 });
    const prosjektTegning = await lagTask({ drawingId: ids.tegningProsjekt });
    const utenAlt = await lagTask({});
    const mine = [egenUtenTegning, egenBp2PåTegningBp1, arvViaTegning, prosjektTegning, utenAlt];

    const treff = await prisma.task.findMany({
      where: { id: { in: mine }, ...byggeplassFilterViaTegning(ids.bp1)! },
      select: { id: true },
    });
    expect(new Set(treff.map((t) => t.id))).toEqual(
      new Set([egenUtenTegning, arvViaTegning, prosjektTegning, utenAlt]),
    );
  });
});
