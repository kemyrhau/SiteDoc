import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { prisma } from "@sitedoc/db";
import { createTestCaller } from "../test-harness/context";

/**
 * T2 Tegningsserie — DoD-testene 10, 11 og 12 (tegning-serieopplasting-spec § 4).
 * Kjører HELE tRPC-laget (authz + mutasjoner) mot ekte DB, så FK-atferden (SetNull)
 * og at «flytt» ikke rører metadata, bevises på ekte lagringsatferd — ikke i en stubb.
 *
 * Integrasjonstest (DB + DATABASE_URL) → ekskludert fra `pnpm test`, kjøres via
 * `pnpm test:integration` (cowork/Kenneth, mot sandkasse). Mål-DB: localhost-sandkasse.
 *
 * Seed committes (authz-hjelperne bruker modul-prisma-singleton → interaktiv tx-rollback
 * gir split-brain); eksplisitt teardown på sporede ID-er (revers-FK) i afterAll.
 */

const NS = "T2SERIE";

interface Scenario {
  userId: string;
  projectId: string;
  byggeplassId: string;
  d1: string;
  d2: string;
}

let s: Scenario;
const serieIder: string[] = [];

beforeAll(async () => {
  const kjoreId = randomUUID().slice(0, 8);

  const bruker = await prisma.user.create({
    data: { id: randomUUID(), name: `${NS} Bruker`, email: `${NS.toLowerCase()}-${kjoreId}@t2.test`, role: "user" },
  });

  // Standalone-prosjekt (primaryOrganizationId null — gyldig permanent tilstand).
  const project = await prisma.project.create({
    data: {
      id: randomUUID(),
      projectNumber: `${NS}-${kjoreId}`,
      name: `${NS} Prosjekt ${kjoreId}`,
      primaryOrganizationId: null,
    },
  });
  await prisma.projectMember.create({
    data: { id: randomUUID(), userId: bruker.id, projectId: project.id, role: "member" },
  });

  const byggeplass = await prisma.byggeplass.create({
    data: { id: randomUUID(), projectId: project.id, name: `${NS} Byggeplass` },
  });

  // To tegninger med SATT fag + opphav — så test 11 kan bevise at «flytt» ikke rører dem.
  const d1 = await prisma.drawing.create({
    data: {
      id: randomUUID(),
      projectId: project.id,
      byggeplassId: byggeplass.id,
      name: `${NS} Plan 1`,
      discipline: "ARK",
      originator: "Opprinnelig rådgiver",
      fileUrl: "/uploads/t2-d1.png",
      fileType: "png",
    },
  });
  const d2 = await prisma.drawing.create({
    data: {
      id: randomUUID(),
      projectId: project.id,
      byggeplassId: byggeplass.id,
      name: `${NS} Plan 2`,
      discipline: "ARK",
      fileUrl: "/uploads/t2-d2.png",
      fileType: "png",
    },
  });

  s = { userId: bruker.id, projectId: project.id, byggeplassId: byggeplass.id, d1: d1.id, d2: d2.id };
});

afterAll(async () => {
  // Revers-FK teardown. Tegninger løsnes fra serie allerede (SetNull), men slett eksplisitt.
  await prisma.drawing.deleteMany({ where: { projectId: s?.projectId } });
  await prisma.tegningsserie.deleteMany({ where: { id: { in: serieIder } } });
  await prisma.byggeplass.deleteMany({ where: { projectId: s?.projectId } });
  await prisma.projectMember.deleteMany({ where: { projectId: s?.projectId } });
  await prisma.project.deleteMany({ where: { id: s?.projectId } });
  await prisma.user.deleteMany({ where: { id: s?.userId } });
});

describe("T2 tegningsserie — DoD 10/11/12 (ekte DB)", () => {
  it("test 12: hentForByggeplass returnerer tegninger MED serieId-felt (null tillatt)", async () => {
    const caller = createTestCaller(s.userId);
    const rader = await caller.tegning.hentForByggeplass({ byggeplassId: s.byggeplassId });
    expect(rader.length).toBeGreaterThanOrEqual(2);
    for (const r of rader) {
      expect("serieId" in r).toBe(true); // feltet FINNES …
    }
    expect(rader.find((r) => r.id === s.d1)?.serieId ?? null).toBeNull(); // … og er null før kobling
  });

  it("test 11: «flytt til serie» endrer serieId, men ALDRI fag/opphav", async () => {
    const caller = createTestCaller(s.userId);
    // Serie med ET ANNET fag enn tegningen — for å bevise at tegningens fag ikke overskrives.
    const serie = await caller.tegningsserie.opprett({
      projectId: s.projectId,
      byggeplassId: s.byggeplassId,
      name: `${NS} RIB-serie`,
      discipline: "RIB",
      originator: "Annen rådgiver",
    });
    serieIder.push(serie.id);

    await caller.tegningsserie.flyttTegninger({ drawingIds: [s.d1], serieId: serie.id });

    const d1 = await prisma.drawing.findUniqueOrThrow({ where: { id: s.d1 } });
    expect(d1.serieId).toBe(serie.id); // koblet …
    expect(d1.discipline).toBe("ARK"); // … men fag urørt (serien er RIB)
    expect(d1.originator).toBe("Opprinnelig rådgiver"); // … og opphav urørt
  });

  it("test 10: sletting av serie setter serieId = null og BEVARER tegningen", async () => {
    const caller = createTestCaller(s.userId);
    const serie = await caller.tegningsserie.opprett({
      projectId: s.projectId,
      byggeplassId: s.byggeplassId,
      name: `${NS} Slett-serie`,
      drawingIds: [s.d2],
    });
    // Koblet ved opprettelse
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: s.d2 } })).serieId).toBe(serie.id);

    await caller.tegningsserie.slett({ id: serie.id });

    const d2 = await prisma.drawing.findUnique({ where: { id: s.d2 } });
    expect(d2).not.toBeNull(); // tegningen lever …
    expect(d2?.serieId).toBeNull(); // … og er løsnet fra serien
    // Serien er borte
    expect(await prisma.tegningsserie.findUnique({ where: { id: serie.id } })).toBeNull();
  });

  it("R10: «bruk på alle i serien» skriver seriens fag på tegningene (eksplisitt)", async () => {
    const caller = createTestCaller(s.userId);
    const serie = await caller.tegningsserie.opprett({
      projectId: s.projectId,
      byggeplassId: s.byggeplassId,
      name: `${NS} Bruk-på-alle`,
      discipline: "RIV",
      drawingIds: [s.d1],
    });
    serieIder.push(serie.id);

    const res = await caller.tegningsserie.brukPaAlle({ serieId: serie.id });
    expect(res.antall).toBe(1);
    expect((await prisma.drawing.findUniqueOrThrow({ where: { id: s.d1 } })).discipline).toBe("RIV");
  });
});
