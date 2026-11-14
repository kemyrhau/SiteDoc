import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST 2026-11-14 (10) B: manuell avstand — firmagrense og validering. Kjører UTEN DB.
 *
 *  - byggeplass i et annet firma → NOT_FOUND, ingenting skrives (negativkontroll).
 *  - oppmøtested i et annet firma → NOT_FOUND, ingenting skrives.
 *  - gyldig par → upsert med kilde "manuell"; km lagres som meter.
 *  - km uten kjent kjøretid → BAD_REQUEST (kjøretid er påkrevd i matrisen).
 *  - Zod: 0 og over taket avvises.
 */

const m = vi.hoisted(() => ({
  oppmotestedFindFirst: vi.fn(),
  byggeplassFindFirst: vi.fn(),
  matriseFindFirst: vi.fn(),
  matriseUpsert: vi.fn(),
  matriseDeleteMany: vi.fn(),
  recompute: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  oppmotested: { findFirst: (...a: unknown[]) => m.oppmotestedFindFirst(...a) },
  byggeplass: { findFirst: (...a: unknown[]) => m.byggeplassFindFirst(...a) },
  reisetidMatrise: {
    findFirst: (...a: unknown[]) => m.matriseFindFirst(...a),
    upsert: (...a: unknown[]) => m.matriseUpsert(...a),
    deleteMany: (...a: unknown[]) => m.matriseDeleteMany(...a),
  },
}));

vi.mock("@sitedoc/db", () => ({ prisma: prismaMock, Prisma: {} }));
vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserOrganisasjonTilgang: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/rute-service", () => ({ geokodAdresse: vi.fn() }));
vi.mock("../services/reisetidMatrise", () => ({
  MANUELL_KILDE: "manuell",
  recomputeMatrise: (...a: unknown[]) => m.recompute(...a),
  recomputeMatriseIBakgrunn: vi.fn(),
}));

import { oppmotestedRouter } from "./oppmotested";

const ORG = "11111111-1111-1111-1111-111111111111";
const KONTOR = "22222222-2222-2222-2222-222222222222";
const PLASS = "33333333-3333-3333-3333-333333333333";

function caller() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return oppmotestedRouter.createCaller({ userId: "u1", prisma: prismaMock } as any);
}

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.oppmotestedFindFirst.mockResolvedValue({ id: KONTOR, organizationId: ORG });
  m.byggeplassFindFirst.mockResolvedValue({ id: PLASS });
  m.matriseFindFirst.mockResolvedValue({ kjoretidMin: 25, avstandM: 20000 });
  m.matriseUpsert.mockResolvedValue({});
  m.matriseDeleteMany.mockResolvedValue({ count: 1 });
  m.recompute.mockResolvedValue({ rader: 1, manglerPunkt: [], uoppnaaelige: 0 });
});

const BASE = { organizationId: ORG, oppmotestedId: KONTOR, byggeplassId: PLASS };

describe("oppmotested.oppdaterAvstand — firmagrense", () => {
  it("byggeplass i annet firma → NOT_FOUND, ingen skriving", async () => {
    m.byggeplassFindFirst.mockResolvedValue(null);
    await expect(caller().oppdaterAvstand({ ...BASE, avstandKm: 12 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(m.byggeplassFindFirst.mock.calls[0]![0]).toMatchObject({
      where: { id: PLASS, project: { primaryOrganizationId: ORG } },
    });
    expect(m.matriseUpsert).not.toHaveBeenCalled();
  });

  it("oppmøtested i annet firma → NOT_FOUND, ingen skriving", async () => {
    m.oppmotestedFindFirst.mockResolvedValue(null);
    await expect(caller().oppdaterAvstand({ ...BASE, kjoretidMin: 30 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(m.matriseUpsert).not.toHaveBeenCalled();
  });

  it("tilbakestill i annet firma → NOT_FOUND, ingen sletting", async () => {
    m.byggeplassFindFirst.mockResolvedValue(null);
    await expect(caller().tilbakestillAvstand(BASE)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.matriseDeleteMany).not.toHaveBeenCalled();
    expect(m.recompute).not.toHaveBeenCalled();
  });
});

describe("oppmotested.oppdaterAvstand — lagring", () => {
  it("km → meter, kjøretid beholdes, kilde manuell", async () => {
    await caller().oppdaterAvstand({ ...BASE, avstandKm: 12.4 });
    const arg = m.matriseUpsert.mock.calls[0]![0];
    expect(arg.update).toMatchObject({ kjoretidMin: 25, avstandM: 12400, kilde: "manuell" });
    expect(arg.create).toMatchObject({ organizationId: ORG, kilde: "manuell" });
  });

  it("km uten kjent kjøretid → BAD_REQUEST", async () => {
    m.matriseFindFirst.mockResolvedValue(null);
    await expect(caller().oppdaterAvstand({ ...BASE, avstandKm: 12 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(m.matriseUpsert).not.toHaveBeenCalled();
  });

  it("Zod: 0 og over taket avvises", async () => {
    await expect(caller().oppdaterAvstand({ ...BASE, avstandKm: 0 })).rejects.toBeDefined();
    await expect(caller().oppdaterAvstand({ ...BASE, kjoretidMin: 5000 })).rejects.toBeDefined();
    await expect(caller().oppdaterAvstand(BASE)).rejects.toBeDefined();
    expect(m.matriseUpsert).not.toHaveBeenCalled();
  });

  it("tilbakestill sletter paret i firmaet og beregner byggeplassen på nytt", async () => {
    await caller().tilbakestillAvstand(BASE);
    expect(m.matriseDeleteMany).toHaveBeenCalledWith({
      where: { organizationId: ORG, oppmotestedId: KONTOR, byggeplassId: PLASS },
    });
    expect(m.recompute).toHaveBeenCalledWith({ organizationId: ORG, byggeplassId: PLASS });
  });
});
