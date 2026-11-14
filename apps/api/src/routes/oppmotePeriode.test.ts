import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST 2026-11-15 (12) D: oppmøtested med perioder — firmagrense og vakter.
 * Kjører UTEN DB (mocket prisma), samme mønster som oppmotested-avstand.test.ts.
 *
 *  - Firmaisolasjon: ansatt/oppmøtested/prosjekt i annet firma → NOT_FOUND,
 *    ingenting skrives; ikke-medlem får ikke lese egne perioder i firma B.
 *  - Ansatt kan IKKE overskrive et eksisterende fast sted (FORBIDDEN).
 *  - Nytt fast sted lukker det forrige (tilDato = ny fraDato − 1).
 *  - Overlapp avvises (CONFLICT), ingenting skrives.
 *  - Ett aktivt kontor → fast sted settes automatisk; to → trengerValg.
 *  - Sletting av oppmøtested i bruk → «I bruk — deaktiver i stedet».
 */

const m = vi.hoisted(() => ({
  medlemFindUnique: vi.fn(),
  medlemFindFirst: vi.fn(),
  stedFindFirst: vi.fn(),
  stedFindMany: vi.fn(),
  stedDelete: vi.fn(),
  prosjektFindFirst: vi.fn(),
  periodeFindMany: vi.fn(),
  periodeFindFirst: vi.fn(),
  periodeCreate: vi.fn(),
  periodeUpdate: vi.fn(),
  periodeDelete: vi.fn(),
  userFindMany: vi.fn(),
  admin: vi.fn(),
}));

const prismaMock = vi.hoisted(() => {
  const p: Record<string, unknown> = {
    organizationMember: {
      findUnique: (...a: unknown[]) => m.medlemFindUnique(...a),
      findFirst: (...a: unknown[]) => m.medlemFindFirst(...a),
    },
    oppmotested: {
      findFirst: (...a: unknown[]) => m.stedFindFirst(...a),
      findMany: (...a: unknown[]) => m.stedFindMany(...a),
      delete: (...a: unknown[]) => m.stedDelete(...a),
    },
    project: { findFirst: (...a: unknown[]) => m.prosjektFindFirst(...a) },
    oppmotePeriode: {
      findMany: (...a: unknown[]) => m.periodeFindMany(...a),
      findFirst: (...a: unknown[]) => m.periodeFindFirst(...a),
      create: (...a: unknown[]) => m.periodeCreate(...a),
      update: (...a: unknown[]) => m.periodeUpdate(...a),
      delete: (...a: unknown[]) => m.periodeDelete(...a),
    },
    user: { findMany: (...a: unknown[]) => m.userFindMany(...a) },
  };
  p.$transaction = (fn: (tx: unknown) => unknown) => fn(p);
  return p;
});

const PrismaFeil = vi.hoisted(
  () =>
    class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(code: string) {
        super(code);
        this.code = code;
      }
    },
);

vi.mock("@sitedoc/db", () => ({
  prisma: prismaMock,
  Prisma: { PrismaClientKnownRequestError: PrismaFeil },
}));
vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: (...a: unknown[]) => m.admin(...a),
  verifiserOrganisasjonTilgang: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services/rute-service", () => ({ geokodAdresse: vi.fn() }));
vi.mock("../services/reisetidMatrise", () => ({
  MANUELL_KILDE: "manuell",
  recomputeMatrise: vi.fn(),
  recomputeMatriseIBakgrunn: vi.fn(),
}));

import { oppmotePeriodeRouter, dagenFor } from "./oppmotePeriode";
import { oppmotestedRouter } from "./oppmotested";

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "99999999-9999-9999-9999-999999999999";
const MEDLEM = "22222222-2222-2222-2222-222222222222";
const NARVIK = "33333333-3333-3333-3333-333333333333";
const RAMSUND = "44444444-4444-4444-4444-444444444444";
const PROSJEKT = "55555555-5555-5555-5555-555555555555";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = { userId: "u1", prisma: prismaMock } as any;
const caller = () => oppmotePeriodeRouter.createCaller(ctx);

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const rad = (o: Partial<Record<string, unknown>>) => ({
  id: "p-ny",
  type: "kontor",
  fast: true,
  oppmotestedId: NARVIK,
  projectId: null,
  fraDato: d("2026-01-01"),
  tilDato: null,
  ...o,
});

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.admin.mockResolvedValue(undefined);
  m.medlemFindUnique.mockResolvedValue({ id: MEDLEM, status: "aktiv", createdAt: d("2026-03-10") });
  m.medlemFindFirst.mockResolvedValue({ id: MEDLEM });
  m.stedFindFirst.mockResolvedValue({ id: NARVIK });
  m.stedFindMany.mockResolvedValue([{ id: NARVIK }, { id: RAMSUND }]);
  m.prosjektFindFirst.mockResolvedValue({ id: PROSJEKT });
  m.periodeFindMany.mockResolvedValue([]);
  m.periodeFindFirst.mockResolvedValue(null);
  m.periodeCreate.mockImplementation(async (a: { data: Record<string, unknown> }) => rad(a.data));
  m.periodeUpdate.mockResolvedValue({});
  m.periodeDelete.mockResolvedValue({});
  m.userFindMany.mockResolvedValue([]);
});

describe("dagenFor", () => {
  it("krysser måned og år", () => {
    expect(dagenFor("2027-01-01")).toBe("2026-12-31");
    expect(dagenFor("2026-03-01")).toBe("2026-02-28");
  });
});

describe("hentMine", () => {
  it("ikke-medlem i firma B → FORBIDDEN, leser ingenting", async () => {
    m.medlemFindUnique.mockResolvedValue(null);
    await expect(caller().hentMine({ organizationId: ORG_B })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.periodeFindMany).not.toHaveBeenCalled();
  });

  it("deaktivert medlem → FORBIDDEN", async () => {
    m.medlemFindUnique.mockResolvedValue({ id: MEDLEM, status: "deaktivert", createdAt: d("2026-03-10") });
    await expect(caller().hentMine({ organizationId: ORG_A })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("filtrerer på eget medlemskap OG firma", async () => {
    await caller().hentMine({ organizationId: ORG_A });
    expect(m.periodeFindMany.mock.calls[0]![0]).toMatchObject({
      where: { organizationMemberId: MEDLEM, organizationId: ORG_A },
    });
  });

  it("to kontorer, ingen fast → trengerValg, ingen automatisk innsetting", async () => {
    const r = await caller().hentMine({ organizationId: ORG_A });
    expect(r.trengerValg).toBe(true);
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("ett kontor, ingen fast → settes automatisk med fraDato = medlemskapets dato", async () => {
    m.stedFindMany.mockResolvedValue([{ id: NARVIK }]);
    m.periodeFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([rad({ fraDato: d("2026-03-10") })]);
    const r = await caller().hentMine({ organizationId: ORG_A });
    expect(m.periodeCreate.mock.calls[0]![0].data).toMatchObject({
      fast: true,
      oppmotestedId: NARVIK,
      fraDato: d("2026-03-10"),
      organizationMemberId: MEDLEM,
      organizationId: ORG_A,
    });
    expect(r.perioder[0]).toMatchObject({ fast: true, oppmotestedId: NARVIK, fraDato: "2026-03-10" });
    expect(r.trengerValg).toBe(false);
  });

  it("ett kontor, samtidig kall (unik-brudd) → idempotent, ingen feil", async () => {
    m.stedFindMany.mockResolvedValue([{ id: NARVIK }]);
    m.periodeCreate.mockRejectedValue(new PrismaFeil("P2002"));
    await expect(caller().hentMine({ organizationId: ORG_A })).resolves.toBeTruthy();
  });
});

describe("settMittFaste", () => {
  it("første gang → fast sted med fraDato = medlemskapets dato", async () => {
    await caller().settMittFaste({ organizationId: ORG_A, oppmotestedId: NARVIK });
    expect(m.periodeCreate.mock.calls[0]![0].data).toMatchObject({
      fast: true,
      oppmotestedId: NARVIK,
      fraDato: d("2026-03-10"),
    });
  });

  it("finnes et fast sted fra før → FORBIDDEN, ingenting skrives (negativkontroll)", async () => {
    m.periodeFindFirst.mockResolvedValue({ id: "eksisterende" });
    await expect(caller().settMittFaste({ organizationId: ORG_A, oppmotestedId: RAMSUND })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("kappløp (unik-brudd) → også FORBIDDEN", async () => {
    m.periodeCreate.mockRejectedValue(new PrismaFeil("P2002"));
    await expect(caller().settMittFaste({ organizationId: ORG_A, oppmotestedId: NARVIK })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("oppmøtested i annet firma → NOT_FOUND", async () => {
    m.stedFindFirst.mockResolvedValue(null);
    await expect(caller().settMittFaste({ organizationId: ORG_A, oppmotestedId: NARVIK })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(m.stedFindFirst.mock.calls[0]![0]).toMatchObject({ where: { organizationId: ORG_A, aktiv: true } });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });
});

const FAST_INPUT = {
  organizationId: ORG_A,
  organizationMemberId: MEDLEM,
  type: "kontor" as const,
  fast: true,
  oppmotestedId: RAMSUND,
  fraDato: "2026-09-01",
};

describe("opprett (firmaadmin)", () => {
  it("ikke admin i firmaet → FORBIDDEN, ingenting skrives", async () => {
    m.admin.mockRejectedValue(Object.assign(new Error("x"), { code: "FORBIDDEN" }));
    await expect(caller().opprett(FAST_INPUT)).rejects.toBeTruthy();
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("ansatt i annet firma → NOT_FOUND, ingenting skrives", async () => {
    m.medlemFindFirst.mockResolvedValue(null);
    await expect(caller().opprett(FAST_INPUT)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.medlemFindFirst.mock.calls[0]![0]).toMatchObject({ where: { id: MEDLEM, organizationId: ORG_A } });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("oppmøtested i annet firma → NOT_FOUND", async () => {
    m.stedFindFirst.mockResolvedValue(null);
    await expect(caller().opprett(FAST_INPUT)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("prosjekt i annet firma → NOT_FOUND", async () => {
    m.prosjektFindFirst.mockResolvedValue(null);
    await expect(
      caller().opprett({ ...FAST_INPUT, type: "byggeplass", fast: false, oppmotestedId: null, projectId: PROSJEKT, tilDato: "2026-10-01" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.prosjektFindFirst.mock.calls[0]![0]).toMatchObject({
      where: { id: PROSJEKT, primaryOrganizationId: ORG_A },
    });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("nytt fast sted lukker det forrige (tilDato = fraDato − 1)", async () => {
    m.periodeFindMany.mockResolvedValue([rad({ id: "narvik-fast" })]);
    await caller().opprett(FAST_INPUT);
    expect(m.periodeUpdate).toHaveBeenCalledWith({ where: { id: "narvik-fast" }, data: { tilDato: d("2026-08-31") } });
    expect(m.periodeCreate.mock.calls[0]![0].data).toMatchObject({ fast: true, oppmotestedId: RAMSUND, sattAvUserId: "u1" });
  });

  it("midlertidig rører ikke det faste stedet", async () => {
    m.periodeFindMany.mockResolvedValue([rad({ id: "narvik-fast" })]);
    await caller().opprett({ ...FAST_INPUT, fast: false, tilDato: "2026-09-30" });
    expect(m.periodeUpdate).not.toHaveBeenCalled();
    expect(m.periodeCreate).toHaveBeenCalled();
  });

  it("overlappende midlertidig → CONFLICT, ingenting skrives", async () => {
    m.periodeFindMany.mockResolvedValue([rad({ id: "m1", fast: false, fraDato: d("2026-09-15"), tilDato: d("2026-10-15") })]);
    await expect(caller().opprett({ ...FAST_INPUT, fast: false, tilDato: "2026-09-30" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });

  it("midlertidig uten sluttdato avvises av Zod", async () => {
    await expect(caller().opprett({ ...FAST_INPUT, fast: false })).rejects.toBeTruthy();
    expect(m.periodeCreate).not.toHaveBeenCalled();
  });
});

describe("oppdater / slett (firmaadmin)", () => {
  it("periode i annet firma → NOT_FOUND (filtrerer på organizationId)", async () => {
    await expect(
      caller().oppdater({ id: MEDLEM, organizationId: ORG_A, fraDato: "2026-09-01", tilDato: "2026-09-30" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.periodeFindFirst.mock.calls[0]![0]).toMatchObject({ where: { id: MEDLEM, organizationId: ORG_A } });
    await expect(caller().slett({ id: MEDLEM, organizationId: ORG_A })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.periodeUpdate).not.toHaveBeenCalled();
    expect(m.periodeDelete).not.toHaveBeenCalled();
  });

  it("fast sted kan ikke oppdateres direkte", async () => {
    m.periodeFindFirst.mockResolvedValue({ ...rad({}), organizationMemberId: MEDLEM });
    await expect(
      caller().oppdater({ id: MEDLEM, organizationId: ORG_A, fraDato: "2026-09-01" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("slett gjeldende fast → forrige faste gjenåpnes", async () => {
    m.periodeFindFirst
      .mockResolvedValueOnce({ ...rad({ id: "ramsund", oppmotestedId: RAMSUND, fraDato: d("2026-09-01") }), organizationMemberId: MEDLEM })
      .mockResolvedValueOnce({ id: "narvik" });
    await caller().slett({ id: MEDLEM, organizationId: ORG_A });
    expect(m.periodeFindFirst.mock.calls[1]![0]).toMatchObject({ where: { fast: true, tilDato: d("2026-08-31") } });
    expect(m.periodeUpdate).toHaveBeenCalledWith({ where: { id: "narvik" }, data: { tilDato: null } });
  });
});

describe("oppmotested.slett — i bruk", () => {
  it("FK Restrict (P2003) → CONFLICT «I bruk — deaktiver i stedet»", async () => {
    m.stedDelete.mockRejectedValue(new PrismaFeil("P2003"));
    await expect(
      oppmotestedRouter.createCaller(ctx).slett({ id: NARVIK, organizationId: ORG_A }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "I bruk — deaktiver i stedet" });
  });
});
