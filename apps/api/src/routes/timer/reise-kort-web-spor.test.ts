import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST 2026-11-15 (13) L2 commit 8 — web-reisekortet lagrer reise-sporet via
 * tilfoyTimerRad. Sporet går gjennom SAMME C2/C3 som synken
 * (byggReiseFelterForSynk): oppmøtestedet må høre til sedelens firma,
 * overføring krever retning/kjøretid/rute, og sporet lagres kun med en kilde
 * på en reise-art.
 */

const findUniqueSetting = vi.fn();
const kontorAvstand = vi.fn();
vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn().mockResolvedValue(undefined),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  hentBrukersOrg: vi.fn(),
  krevBrukersOrg: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
  resolverOrgForEgenTimeføring: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
  verifiserAnsattIFirma: vi.fn().mockResolvedValue(undefined),
  resolverOrgFraInput: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
}));
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn().mockResolvedValue(undefined),
  hentEffektivArbeidstid: vi.fn().mockResolvedValue({ startTid: "07:00", sluttTid: "15:00", pauseMin: 30, dagsnorm: 7.5, normKilde: "fast", pauseEtterTimer: 4, pauseReferanse: "ankomst" }),
}));
vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationSetting: { findUnique: (...a: unknown[]) => findUniqueSetting(...a) },
    organizationReiseGrense: { findMany: vi.fn().mockResolvedValue([]) },
    reisetidMatrise: { findMany: vi.fn().mockResolvedValue([]) },
    oppmotested: { findMany: vi.fn().mockResolvedValue([{ id: "77777777-7777-7777-7777-777777777777" }, { id: "78787878-7878-7878-7878-787878787878" }]) },
    oppmotestedAvstand: { findMany: (...a: unknown[]) => kontorAvstand(...a) },
    byggeplass: {
      findFirst: vi.fn().mockResolvedValue({ id: "bp" }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    project: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@sitedoc/db-maskin", () => ({
  prismaMaskin: { equipment: { findFirst: vi.fn().mockResolvedValue({ id: "utstyr" }) } },
}));

import { dagsseddelRouter } from "./dagsseddel";

const USER = "user-1";
const ORG = "11111111-1111-1111-1111-111111111111";
const SHEET = "22222222-2222-2222-2222-222222222222";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const ORDINAER = "44444444-4444-4444-4444-444444444444";
const REISE = "45454545-4545-4545-4545-454545454545";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const OPPMOTE = "77777777-7777-7777-7777-777777777777";
const KONTOR_B = "78787878-7878-7878-7878-787878787878";
const FREMMED = "79797979-7979-7979-7979-797979797979";

const ARTER: Record<string, { id: string; navn: string; satsEnhet: string }> = {
  [ORDINAER]: { id: ORDINAER, navn: "Ordinær", satsEnhet: "per_time" },
  [REISE]: { id: REISE, navn: "Reisetid", satsEnhet: "per_time" },
};

function lagCtx() {
  const sheet = {
    id: SHEET, clientUuid: SHEET, userId: USER, organizationId: ORG,
    status: "draft", pauseMin: 0, dato: new Date("2026-11-14T00:00:00Z"),
  };
  const timerCreate = vi.fn(async (a: { data: unknown }) => ({ id: "ny", ...(a.data as object) }));
  const transaction = vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      sheetTimer: {
        create: timerCreate,
        aggregate: vi.fn().mockResolvedValue({ _sum: { pauseMin: 0 } }),
      },
      dailySheet: { update: vi.fn().mockResolvedValue({}) },
    }),
  );
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: { organizationSetting: { findUnique: vi.fn().mockResolvedValue(null) } },
    prismaTimer: {
      $transaction: transaction,
      dailySheet: { findUnique: vi.fn().mockResolvedValue(sheet) },
      lonnsart: {
        findFirst: vi.fn(async (a: { where: { id: string } }) => ARTER[a.where.id] ?? null),
      },
      aktivitet: { findFirst: vi.fn().mockResolvedValue({ id: AKTIVITET }) },
      sheetTimer: { findMany: vi.fn().mockResolvedValue([]), create: timerCreate },
      sheetMachine: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
  return { ctx, timerCreate };
}

const caller = (ctx: unknown) =>
  dagsseddelRouter.createCaller(ctx as Parameters<typeof dagsseddelRouter.createCaller>[0]);

const basis = (lonnsartId: string) => ({
  sheetId: SHEET, projectId: PROSJEKT, lonnsartId, aktivitetId: AKTIVITET,
  timer: 0.5, fraTid: "06:30", tilTid: "07:00", pauseMin: 0,
});
const regel = { enhet: "min", terskel: 30 };
const rute = { overforing: { fra: { type: "kontor", oppmotestedId: OPPMOTE }, til: { type: "kontor", oppmotestedId: KONTOR_B } } };

beforeEach(() => {
  vi.clearAllMocks();
  findUniqueSetting.mockResolvedValue({ reiseLonnsartId: REISE });
  kontorAvstand.mockResolvedValue([
    { fraOppmotestedId: OPPMOTE, tilOppmotestedId: KONTOR_B, avstandM: 42000, kjoretidMin: 30 },
  ]);
});

describe("tilfoyTimerRad — reise-spor fra web-reisekortet", () => {
  it("Tur (manuell) lagrer retning, oppmøtested, kjøretid, avstand og regel", async () => {
    const { ctx, timerCreate } = lagCtx();
    await caller(ctx).tilfoyTimerRad({
      ...basis(REISE), reiseKilde: "manuell", reiseRetning: "ut",
      reiseOppmotestedId: OPPMOTE, reiseKjoretidMin: 30, reiseAvstandM: 42000, reiseRegel: regel,
    });
    expect(timerCreate.mock.calls[0]![0].data).toMatchObject({
      erReise: true, reiseKilde: "manuell", reiseRetning: "ut",
      reiseOppmotestedId: OPPMOTE, reiseKjoretidMin: 30, reiseAvstandM: 42000, reiseRegel: regel,
    });
  });

  it("overføring kontor→kontor lagres med kilde overforing og C3-kontroll mot kontor-avstanden", async () => {
    const { ctx, timerCreate } = lagCtx();
    await caller(ctx).tilfoyTimerRad({
      ...basis(REISE), reiseKilde: "overforing", reiseRetning: "ut",
      reiseOppmotestedId: OPPMOTE, reiseKjoretidMin: 30, reiseAvstandM: 42000, reiseRegel: rute,
    });
    expect(kontorAvstand).toHaveBeenCalledTimes(1);
    expect(timerCreate.mock.calls[0]![0].data).toMatchObject({
      erReise: true, reiseKilde: "overforing", reiseRetning: "ut",
      reiseOppmotestedId: OPPMOTE, reiseRegel: rute, reiseAvvik: false,
    });
  });

  it("🔴 oppmøtested i et annet firma → BAD_REQUEST, ingen rad", async () => {
    const { ctx, timerCreate } = lagCtx();
    await expect(
      caller(ctx).tilfoyTimerRad({
        ...basis(REISE), reiseKilde: "manuell", reiseRetning: "ut",
        reiseOppmotestedId: FREMMED, reiseKjoretidMin: 30, reiseAvstandM: 42000, reiseRegel: regel,
      }),
    ).rejects.toThrow(/tilhører ikke firmaet|ikke tilhører firmaet/);
    expect(timerCreate).not.toHaveBeenCalled();
  });

  it("🔴 overføring uten rute i regel-snapshoten → BAD_REQUEST, ingen rad", async () => {
    const { ctx, timerCreate } = lagCtx();
    await expect(
      caller(ctx).tilfoyTimerRad({
        ...basis(REISE), reiseKilde: "overforing", reiseRetning: "ut",
        reiseOppmotestedId: OPPMOTE, reiseKjoretidMin: 30, reiseRegel: regel,
      }),
    ).rejects.toThrow(/Overføring mangler rute/);
    expect(timerCreate).not.toHaveBeenCalled();
  });

  it("🔴 spor uten kilde lagres ikke (null-spor på ordinær rad)", async () => {
    const { ctx, timerCreate } = lagCtx();
    await caller(ctx).tilfoyTimerRad({
      ...basis(ORDINAER), reiseRetning: "ut", reiseOppmotestedId: OPPMOTE, reiseKjoretidMin: 20,
    });
    const data = timerCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({ erReise: false, reiseKilde: null });
    expect(data.reiseRetning ?? null).toBeNull();
    expect(data.reiseOppmotestedId ?? null).toBeNull();
    expect(data.reiseKjoretidMin ?? null).toBeNull();
  });
});
