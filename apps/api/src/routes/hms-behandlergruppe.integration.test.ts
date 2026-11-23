import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@sitedoc/db";
import { oppgaveRouter } from "./oppgave";
import { sjekklisteRouter } from "./sjekkliste";
import { seedStandardProsjektoppsett } from "../services/prosjektSeed";
import { buildTestContext } from "../test-harness/context";

/**
 * H1 (2026-11-23) — nye HMS-meldinger går til HMS-behandleren.
 *
 * Kenneth 2026-11-23: «Kun HMS behandler skal kunne behandle disse». `oppgave.opprett` og
 * `sjekkliste.opprett` slo opp mottakergruppa på `domains array_contains ["hms"]`. Standard-
 * seeden oppretter «Prosjektadministratorer» (domener bygg+hms+kvalitet) FØR «HMS»
 * (`hms-ledere`, systemNokkel "hms"), så oppslaget traff prosjektadministratorene. Nå slås
 * gruppa opp på systemNokkel, samme nøkkel som `sikreHmsGruppe`.
 *
 * Prosjektet bygges med den ekte seeden (samme rekkefølge som `prosjekt.opprett`), og
 * melderen er et vanlig medlem. Går gjennom prosedyren (createCaller) mot ekte DB, så
 * Prisma-semantikken for JSON-filteret er den virkelige. Mål-DB: localhost-sandkasse.
 */

const ids = { userId: "", projectId: "", hmsGruppeId: "", adminGruppeId: "" };
const maler: Record<string, string> = {};

beforeAll(async () => {
  const bruker = await prisma.user.create({
    data: { email: "h1-hms-melder@sitedoc.test", name: "H1 melder", role: "user" },
  });
  ids.userId = bruker.id;

  const prosjekt = await prisma.project.create({
    data: { projectNumber: "SD-H1-HMS-1", name: "H1 HMS-behandler" },
  });
  ids.projectId = prosjekt.id;

  await prisma.$transaction(async (tx) => {
    await tx.projectMember.create({ data: { userId: ids.userId, projectId: ids.projectId, role: "member" } });
    await seedStandardProsjektoppsett(tx, ids.projectId, ids.userId);
  });

  const grupper = await prisma.projectGroup.findMany({
    where: { projectId: ids.projectId, slug: { in: ["hms-ledere", "prosjekt-admin"] } },
    select: { id: true, slug: true },
  });
  ids.hmsGruppeId = grupper.find((g) => g.slug === "hms-ledere")!.id;
  ids.adminGruppeId = grupper.find((g) => g.slug === "prosjekt-admin")!.id;

  const hmsMaler = await prisma.reportTemplate.findMany({
    where: { projectId: ids.projectId, domain: "hms" },
    select: { id: true, prefix: true },
  });
  for (const m of hmsMaler) if (m.prefix) maler[m.prefix] = m.id;
});

afterAll(async () => {
  if (!ids.projectId) return;
  const iProsjekt = { template: { projectId: ids.projectId } };
  await prisma.documentTransfer.deleteMany({ where: { OR: [{ task: iProsjekt }, { checklist: iProsjekt }] } });
  await prisma.task.deleteMany({ where: iProsjekt });
  await prisma.checklist.deleteMany({ where: iProsjekt });
  await prisma.dokumentflyt.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.reportTemplate.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.faggruppe.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.projectGroup.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.projectModule.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.projectMember.deleteMany({ where: { projectId: ids.projectId } });
  await prisma.project.deleteMany({ where: { id: ids.projectId } });
  if (ids.userId) await prisma.user.deleteMany({ where: { id: ids.userId } });
});

describe("H1: HMS-meldinger går til HMS-behandlergruppa, ikke prosjektadministratorene", () => {
  it("forutsetning: Prosjektadministratorer bærer domenet hms og er opprettet før HMS-gruppa", async () => {
    const rekkefolge = await prisma.projectGroup.findMany({
      where: { projectId: ids.projectId, domains: { array_contains: ["hms"] } },
      select: { id: true },
    });
    expect(rekkefolge.map((g) => g.id)).toContain(ids.adminGruppeId);
    expect(rekkefolge.map((g) => g.id)).toContain(ids.hmsGruppeId);
    expect(Object.keys(maler).sort()).toEqual(["HMS", "RUH", "SJA"]);
  });

  it("🔴 ny HMS-melding (oppgave) → hms-ledere", async () => {
    const o = await oppgaveRouter
      .createCaller(buildTestContext(ids.userId))
      .opprett({ templateId: maler.HMS!, title: "Løs stillas" });
    const rad = await prisma.task.findUniqueOrThrow({ where: { id: o.id }, select: { recipientGroupId: true } });
    expect(rad.recipientGroupId).toBe(ids.hmsGruppeId);
  });

  it("🔴 ny RUH (oppgave) → hms-ledere", async () => {
    const o = await oppgaveRouter
      .createCaller(buildTestContext(ids.userId))
      .opprett({ templateId: maler.RUH!, title: "Nesten fall" });
    const rad = await prisma.task.findUniqueOrThrow({ where: { id: o.id }, select: { recipientGroupId: true } });
    expect(rad.recipientGroupId).toBe(ids.hmsGruppeId);
  });

  it("🔴 ny SJA (sjekkliste) → hms-ledere", async () => {
    const s = await sjekklisteRouter
      .createCaller(buildTestContext(ids.userId))
      .opprett({ templateId: maler.SJA!, title: "Løft" });
    const rad = await prisma.checklist.findUniqueOrThrow({ where: { id: s.id }, select: { recipientGroupId: true } });
    expect(rad.recipientGroupId).toBe(ids.hmsGruppeId);
  });
});
