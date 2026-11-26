import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST 2026-11-15 (14) — to firmahull i timer-API-et.
 *
 *  (iv) maskin.tilfoy: prosjekt fra annet firma → FORBIDDEN, ingen rad.
 *  (v)  underprosjekt (ECO) fra annet firma/prosjekt:
 *       - maskin.tilfoy og maskin.oppdater → BAD_REQUEST, ingen skriving;
 *       - syncBatch timer- og maskinrader → vasket til null, sedelen avvises IKKE
 *         (offline-køen), som tillegg/utlegg.
 * (ii-b) RETUR (14): ny sedel/rad for et firma uten aktiv ansettelse avvises
 *       (opprett, syncBatch, tilfoyTimerRad) — før noe skrives.
 * 🔴 Feiler når firmasjekkene fjernes. Harness kopiert fra tillegg-utlegg-kort-api.test.ts.
 */

const ORG = "11111111-1111-1111-1111-111111111111";
const ANNET_ORG = "12121212-1212-1212-1212-121212121212";
const USER = "user-1";
const SHEET = "22222222-2222-2222-2222-222222222222";
const PROSJEKT_A = "33333333-3333-3333-3333-333333333333";
const PROSJEKT_B = "99999999-9999-9999-9999-999999999999";
const TILLEGG = "44444444-4444-4444-4444-444444444444";
const KATEGORI = "45454545-4545-4545-4545-454545454545";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const RAD = "66666666-6666-6666-6666-666666666666";
const BYGGEPLASS_A = "77777777-7777-7777-7777-777777777777";
const BYGGEPLASS_B = "88888888-8888-8888-8888-888888888888";
const ECO_A = "e0000000-0000-0000-0000-00000000000a";
const ECO_B = "e0000000-0000-0000-0000-00000000000b";
const PROSJEKT_ANNET_FIRMA = "aaaaaaaa-0000-0000-0000-00000000000f";
const LONNSART = "abababab-abab-abab-abab-abababababab";
const VEHICLE = "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd";
const ECO_ANNET_FIRMA = "e0000000-0000-0000-0000-0000000000cc";

const BYGGEPLASSER = [
  { id: BYGGEPLASS_A, projectId: PROSJEKT_A },
  { id: BYGGEPLASS_B, projectId: PROSJEKT_B },
];
const ECOER = [
  { id: ECO_A, projectId: PROSJEKT_A, organizationId: ORG, slettetVed: null, status: "aktiv", timerregistreringApen: true },
  { id: ECO_B, projectId: PROSJEKT_B, organizationId: ORG, slettetVed: null, status: "aktiv", timerregistreringApen: true },
  // Samme prosjekt-ID, men annet firma: skal aldri slippe gjennom.
  { id: ECO_ANNET_FIRMA, projectId: PROSJEKT_A, organizationId: ANNET_ORG, slettetVed: null, status: "aktiv", timerregistreringApen: true },
];

type InWhere = { where: { id?: { in?: string[] } | string; organizationId?: string; slettetVed?: null; projectId?: string } };

vi.mock("@sitedoc/db-maskin", () => ({
  prismaMaskin: { equipment: { findFirst: vi.fn().mockResolvedValue({ id: "utstyr" }) } },
}));
vi.mock("../../trpc/tilgangskontroll", () => ({
  // POST (14): ekte grense — PROSJEKT_ANNET_FIRMA hører ikke til ORG.
  verifiserProsjekterTilhørerFirma: vi.fn(async (ider: string[], org: string) => {
    const { TRPCError } = await import("@trpc/server");
    if (ider.includes("aaaaaaaa-0000-0000-0000-00000000000f") && org === "11111111-1111-1111-1111-111111111111") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Prosjektet tilhører ikke firmaet" });
    }
  }),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserKjoretoyTilhørerFirma: vi.fn().mockResolvedValue(undefined),
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
const activityCreate = vi.fn().mockResolvedValue({});
vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue({ role: "sitedoc_admin" }) },
    organizationSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    organizationReiseGrense: { findMany: vi.fn().mockResolvedValue([]) },
    reisetidMatrise: { findMany: vi.fn().mockResolvedValue([]) },
    oppmotested: { findMany: vi.fn().mockResolvedValue([]) },
    activity: { create: (...a: unknown[]) => activityCreate(...a) },
    byggeplass: {
      findFirst: vi.fn(async ({ where }: InWhere) =>
        BYGGEPLASSER.find((b) => b.id === where.id && b.projectId === where.projectId) ?? null,
      ),
      findMany: vi.fn(async ({ where }: InWhere) =>
        BYGGEPLASSER.filter((b) => (where.id as { in: string[] }).in.includes(b.id)),
      ),
    },
    externalCostObject: {
      findMany: vi.fn(async ({ where }: InWhere) =>
        ECOER.filter(
          (e) =>
            (where.id as { in: string[] }).in.includes(e.id) &&
            (where.organizationId === undefined || e.organizationId === where.organizationId) &&
            (where.slettetVed === undefined || e.slettetVed === null),
        ),
      ),
      findUnique: vi.fn(async ({ where }: InWhere) => ECOER.find((e) => e.id === where.id) ?? null),
    },
  },
}));

import { dagsseddelRouter } from "./dagsseddel";
import { resolverOrgForEgenTimeføring, verifiserAnsattIFirma } from "../../trpc/tilgangskontroll";

const caller = (ctx: unknown) =>
  dagsseddelRouter.createCaller(ctx as Parameters<typeof dagsseddelRouter.createCaller>[0]);


beforeEach(() => vi.clearAllMocks());

const ECO_AVVIST = /hører ikke til radens prosjekt/;

function lagMaskinCtx() {
  const sheet = { id: SHEET, clientUuid: SHEET, userId: USER, organizationId: ORG, status: "draft", pauseMin: 0, dato: new Date() };
  const ekko = (args: { data: unknown }) => Promise.resolve(args.data);
  const maskinCreate = vi.fn(ekko);
  const maskinUpdate = vi.fn(ekko);
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {},
    // Ordre d2c-1: døgn-maskin — R24 (krever timerad) er ikke det som måles her.
    prismaMaskin: {
      equipment: { findMany: vi.fn().mockResolvedValue([{ id: VEHICLE, merke: "Volvo", modell: "EC220E", internNavn: null, utleieEnhet: "doegn" }]) },
    },
    prismaTimer: {
      // w9: maskin.tilfoy/oppdater kjører interaktiv transaksjon (maskinvakten); tx = klienten selv.
      $transaction: vi.fn((arg: unknown): Promise<unknown> =>
        typeof arg === "function"
          ? (arg as (tx: unknown) => Promise<unknown>)(ctx.prismaTimer)
          : Promise.all(arg as Promise<unknown>[]),
      ),
      // O27: sporet etter sletting på PC (tomt).
      slettetFraPc: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
      dailySheet: { findUnique: vi.fn().mockResolvedValue(sheet), update: vi.fn().mockResolvedValue({}) },
      sheetTimer: {
        findMany: vi.fn().mockResolvedValue([
          { id: RAD, projectId: PROSJEKT_A, externalCostObjectId: null, timer: 8, erReise: false },
          { id: RAD, projectId: PROSJEKT_A, externalCostObjectId: ECO_A, timer: 8, erReise: false },
        ]),
      },
      sheetMachine: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ id: RAD, sheetId: SHEET, projectId: PROSJEKT_A, externalCostObjectId: null, timer: 1, vehicleId: VEHICLE, sheetTimerId: null }),
        create: maskinCreate,
        update: maskinUpdate,
        // w3a (A7): stedsbytte på timeraden tar med koblede maskiner.
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    },
  };
  return { ctx, maskinCreate, maskinUpdate };
}

const maskinInput = { sheetId: SHEET, projectId: PROSJEKT_A, vehicleId: VEHICLE, timer: 1 };

describe("(iv) maskin.tilfoy — prosjektets firma", () => {
  it("prosjekt i sedelens firma → raden lagres", async () => {
    const { ctx, maskinCreate } = lagMaskinCtx();
    await caller(ctx).maskin.tilfoy({ ...maskinInput, externalCostObjectId: ECO_A });
    expect(maskinCreate).toHaveBeenCalledTimes(1);
  });
  it("🔴 prosjekt fra annet firma → FORBIDDEN, ingen rad", async () => {
    const { ctx, maskinCreate } = lagMaskinCtx();
    await expect(
      caller(ctx).maskin.tilfoy({ ...maskinInput, projectId: PROSJEKT_ANNET_FIRMA }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(maskinCreate).not.toHaveBeenCalled();
  });
});

describe("(v) underprosjekt — maskin.tilfoy / maskin.oppdater", () => {
  for (const [navn, eco] of [["annet firma", ECO_ANNET_FIRMA], ["annet prosjekt", ECO_B]] as const) {
    it(`🔴 tilfoy: underprosjekt fra ${navn} → BAD_REQUEST, ingen rad`, async () => {
      const { ctx, maskinCreate } = lagMaskinCtx();
      await expect(
        caller(ctx).maskin.tilfoy({ ...maskinInput, externalCostObjectId: eco }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(ECO_AVVIST) });
      expect(maskinCreate).not.toHaveBeenCalled();
    });
    it(`🔴 oppdater: underprosjekt fra ${navn} → BAD_REQUEST, ingen oppdatering`, async () => {
      const { ctx, maskinUpdate } = lagMaskinCtx();
      await expect(
        caller(ctx).maskin.oppdater({ id: RAD, externalCostObjectId: eco }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(ECO_AVVIST) });
      expect(maskinUpdate).not.toHaveBeenCalled();
    });
  }
  it("oppdater: underprosjekt i radens prosjekt og firma settes; null tømmer", async () => {
    const { ctx, maskinUpdate } = lagMaskinCtx();
    await caller(ctx).maskin.oppdater({ id: RAD, externalCostObjectId: ECO_A });
    await caller(ctx).maskin.oppdater({ id: RAD, externalCostObjectId: null });
    expect(maskinUpdate.mock.calls.map((c) => (c[0] as { data: { externalCostObjectId: unknown } }).data.externalCostObjectId)).toEqual([ECO_A, null]);
  });
});

const CLIENT_UUID = "c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1";

function lagSyncCtx() {
  const tilleggCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const utleggCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const timerCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const maskinCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const hode = {
    id: CLIENT_UUID, clientUuid: CLIENT_UUID, status: "draft", userId: USER, organizationId: ORG,
    lederKommentar: null, attestertVed: null, updatedAt: new Date("2026-11-13T10:00:00Z"),
  };
  const txMock = {
    // O27: sporet etter sletting på PC (tomt).
    slettetFraPc: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
    dailySheet: {
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue(hode),
      findUniqueOrThrow: vi.fn().mockResolvedValue(hode),
      update: vi.fn().mockResolvedValue({}),
    },
    sheetTimer: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: timerCreateMany,
      aggregate: vi.fn().mockResolvedValue({ _sum: { pauseMin: 0 } }),
    },
    sheetTillegg: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: tilleggCreateMany },
    // w3a (A7): updateMany — stedsbytte på timeraden tar med koblede maskiner.
    sheetMachine: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: maskinCreateMany, updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sheetUtlegg: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: utleggCreateMany },
    sheetTimerForslag: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: { oppmotested: { findMany: vi.fn().mockResolvedValue([]) } },
    prismaTimer: {
      // O27: sporet etter sletting på PC (tomt).
      slettetFraPc: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
      dailySheet: { findUnique: vi.fn().mockResolvedValue(null) },
      aktivitet: {
        findFirst: vi.fn().mockResolvedValue({ id: AKTIVITET }),
        findMany: vi.fn().mockResolvedValue([{ id: AKTIVITET }]),
      },
      lonnsart: { findMany: vi.fn().mockResolvedValue([{ id: LONNSART, erReise: false, satsEnhet: "timer" }]) },
      tillegg: { findMany: vi.fn().mockResolvedValue([{ id: TILLEGG }]) },
      expenseCategory: { findMany: vi.fn().mockResolvedValue([{ id: KATEGORI }]) },
      sheetTimer: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn((arg: unknown) =>
        typeof arg === "function"
          ? (arg as (tx: typeof txMock) => Promise<unknown>)(txMock)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    },
  };
  return { ctx, timerCreateMany, maskinCreateMany };
}

const TIMER_ID = "f0000000-0000-0000-0000-000000000011";
const MASKIN_ID = "f0000000-0000-0000-0000-000000000012";

function sedelMedRader(timerEco: string | null, maskinEco: string | null) {
  return {
    clientUuid: CLIENT_UUID,
    projectId: PROSJEKT_A,
    aktivitetId: AKTIVITET,
    byggeplassId: null,
    dato: "2026-11-12",
    status: "draft" as const,
    timer: [{
      id: TIMER_ID, projectId: PROSJEKT_A, lonnsartId: LONNSART, aktivitetId: AKTIVITET,
      externalCostObjectId: timerEco, timer: 8, fraTid: "07:00", tilTid: "15:00",
    }],
    tillegg: [],
    maskiner: [{ id: MASKIN_ID, projectId: PROSJEKT_A, externalCostObjectId: maskinEco, vehicleId: VEHICLE, timer: 0 }],
    utlegg: [],
  };
}

describe("(v) underprosjekt — syncBatch timer-/maskinrader", () => {
  it("underprosjekt i radens prosjekt og firma beholdes", async () => {
    const { ctx, timerCreateMany, maskinCreateMany } = lagSyncCtx();
    const res = await caller(ctx).syncBatch({ sedler: [sedelMedRader(ECO_A, ECO_A)] });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(timerCreateMany.mock.calls[0]![0].data[0]).toMatchObject({ externalCostObjectId: ECO_A });
    expect(maskinCreateMany.mock.calls[0]![0].data[0]).toMatchObject({ externalCostObjectId: ECO_A });
  });
  it("🔴 underprosjekt fra annet firma/prosjekt → null (vasket), sedelen avvises IKKE", async () => {
    const { ctx, timerCreateMany, maskinCreateMany } = lagSyncCtx();
    const res = await caller(ctx).syncBatch({ sedler: [sedelMedRader(ECO_ANNET_FIRMA, ECO_B)] });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(timerCreateMany.mock.calls[0]![0].data[0]).toMatchObject({ externalCostObjectId: null });
    expect(maskinCreateMany.mock.calls[0]![0].data[0]).toMatchObject({ externalCostObjectId: null });
  });
});

describe("(ii-b) ikke aktivt ansatt i firmaet → ingen ny sedel eller rad", () => {
  const ikkeAnsatt = async () => {
    const { TRPCError } = await import("@trpc/server");
    return new TRPCError({ code: "FORBIDDEN", message: "Du er ikke ansatt i Annet firma" });
  };

  it("🔴 syncBatch: firmaet krever ansettelse → FORBIDDEN, ingen transaksjon", async () => {
    vi.mocked(resolverOrgForEgenTimeføring).mockRejectedValueOnce(await ikkeAnsatt());
    const { ctx, timerCreateMany } = lagSyncCtx();
    await expect(
      caller(ctx).syncBatch({ organizationId: ANNET_ORG, sedler: [sedelMedRader(null, null)] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(resolverOrgForEgenTimeføring).toHaveBeenCalledWith(USER, ANNET_ORG);
    expect(ctx.prismaTimer.$transaction).not.toHaveBeenCalled();
    expect(timerCreateMany).not.toHaveBeenCalled();
  });

  it("🔴 opprett: firmaet krever ansettelse → FORBIDDEN, ingen sedel", async () => {
    vi.mocked(resolverOrgForEgenTimeføring).mockRejectedValueOnce(await ikkeAnsatt());
    const create = vi.fn();
    const ctx = {
      userId: USER,
      req: { log: { info: vi.fn(), warn: vi.fn() } },
      prisma: {},
      prismaTimer: { dailySheet: { create, findUnique: vi.fn(), upsert: create }, $transaction: create },
    };
    await expect(
      caller(ctx).opprett({ clientUuid: CLIENT_UUID, aktivitetId: AKTIVITET, dato: "2026-11-15", organizationId: ANNET_ORG }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(resolverOrgForEgenTimeføring).toHaveBeenCalledWith(USER, ANNET_ORG);
    expect(create).not.toHaveBeenCalled();
  });

  it("🔴 tilfoyTimerRad: eier ikke lenger ansatt i sedelens firma → FORBIDDEN, ingen rad", async () => {
    vi.mocked(verifiserAnsattIFirma).mockRejectedValueOnce(await ikkeAnsatt());
    const timerCreate = vi.fn();
    const sheet = { id: SHEET, clientUuid: SHEET, userId: USER, organizationId: ORG, status: "draft", pauseMin: 0, dato: new Date() };
    const ctx = {
      userId: USER,
      req: { log: { info: vi.fn(), warn: vi.fn() } },
      prisma: {},
      prismaTimer: {
        // O27: sporet etter sletting på PC (tomt).
        slettetFraPc: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
        dailySheet: { findUnique: vi.fn().mockResolvedValue(sheet), update: vi.fn() },
        sheetTimer: { create: timerCreate, findMany: vi.fn().mockResolvedValue([]) },
        $transaction: timerCreate,
      },
    };
    await expect(
      caller(ctx).tilfoyTimerRad({
        sheetId: SHEET, projectId: PROSJEKT_A, lonnsartId: LONNSART, aktivitetId: AKTIVITET,
        timer: 8, fraTid: "07:00", tilTid: "15:00",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(verifiserAnsattIFirma).toHaveBeenCalledWith(USER, ORG);
    expect(timerCreate).not.toHaveBeenCalled();
  });
});

/** Gate (34) vilkår 1: underprosjekt valideres også på timer-rader (tilfoy/oppdater). */
function lagTimerCtx() {
  const sheet = { id: SHEET, clientUuid: SHEET, userId: USER, organizationId: ORG, status: "draft", pauseMin: 0, dato: new Date() };
  const ekko = (args: { data: unknown }) => Promise.resolve({ id: RAD, ...(args.data as object) });
  const timerCreate = vi.fn(ekko);
  const timerUpdate = vi.fn(ekko);
  const rad = { id: RAD, sheetId: SHEET, projectId: PROSJEKT_A, lonnsartId: LONNSART, aktivitetId: AKTIVITET, externalCostObjectId: null, timer: 8, erReise: false, fraTid: "07:00", tilTid: "15:00" };
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {},
    prismaTimer: {
      // Både batch- og interaktiv form (oppdaterTimerRad bruker callback).
      $transaction: vi.fn((arg: unknown): Promise<unknown> =>
        typeof arg === "function"
          ? (arg as (tx: unknown) => Promise<unknown>)(ctx.prismaTimer)
          : Promise.all(arg as Promise<unknown>[]),
      ),
      // O27: sporet etter sletting på PC (tomt).
      slettetFraPc: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
      dailySheet: { findUnique: vi.fn().mockResolvedValue(sheet), update: vi.fn().mockResolvedValue({}) },
      lonnsart: {
        findFirst: vi.fn().mockResolvedValue({ id: LONNSART, satsEnhet: "time", erReise: false }),
        findMany: vi.fn().mockResolvedValue([{ id: LONNSART, satsEnhet: "time", erReise: false }]),
      },
      aktivitet: {
        findFirst: vi.fn().mockResolvedValue({ id: AKTIVITET }),
        findMany: vi.fn().mockResolvedValue([{ id: AKTIVITET }]),
      },
      sheetTimer: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(rad),
        create: timerCreate,
        update: timerUpdate,
        aggregate: vi.fn().mockResolvedValue({ _sum: { pauseMin: 0 } }),
      },
      // w3a (A7): updateMany — stedsbytte på timeraden tar med koblede maskiner.
      sheetMachine: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      sheetTillegg: { findMany: vi.fn().mockResolvedValue([]) },
      sheetUtlegg: { findMany: vi.fn().mockResolvedValue([]) },
    },
    // w3a (A7): koblede varer følger stedsbyttet.
    prismaVarelager: { $executeRawUnsafe: vi.fn().mockResolvedValue(0) },
  };
  return { ctx, timerCreate, timerUpdate };
}

const timerInput = {
  sheetId: SHEET, projectId: PROSJEKT_A, lonnsartId: LONNSART, aktivitetId: AKTIVITET,
  timer: 8, fraTid: "07:00", tilTid: "15:00",
};

describe("(v) underprosjekt — tilfoyTimerRad / oppdaterTimerRad (gate 34)", () => {
  for (const [navn, eco] of [["annet firma", ECO_ANNET_FIRMA], ["annet prosjekt", ECO_B]] as const) {
    it(`🔴 tilfoyTimerRad: underprosjekt fra ${navn} → BAD_REQUEST, ingen rad`, async () => {
      const { ctx, timerCreate } = lagTimerCtx();
      await expect(
        caller(ctx).tilfoyTimerRad({ ...timerInput, externalCostObjectId: eco }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(ECO_AVVIST) });
      expect(timerCreate).not.toHaveBeenCalled();
      expect(ctx.prismaTimer.$transaction).not.toHaveBeenCalled();
    });
    it(`🔴 oppdaterTimerRad: underprosjekt fra ${navn} → BAD_REQUEST, ingen oppdatering`, async () => {
      const { ctx, timerUpdate } = lagTimerCtx();
      await expect(
        caller(ctx).oppdaterTimerRad({ id: RAD, fraTid: "07:00", tilTid: "15:00", externalCostObjectId: eco }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(ECO_AVVIST) });
      expect(timerUpdate).not.toHaveBeenCalled();
      expect(ctx.prismaTimer.$transaction).not.toHaveBeenCalled();
    });
  }
  it("tilfoyTimerRad: underprosjekt i radens prosjekt og firma passerer valideringen", async () => {
    const { ctx } = lagTimerCtx();
    const svar = caller(ctx).tilfoyTimerRad({ ...timerInput, externalCostObjectId: ECO_A });
    await svar.catch((e: { message?: string }) => expect(e.message ?? "").not.toMatch(ECO_AVVIST));
  });
  it("oppdaterTimerRad: underprosjekt i radens prosjekt og firma settes; null tømmer", async () => {
    const { ctx, timerUpdate } = lagTimerCtx();
    await caller(ctx).oppdaterTimerRad({ id: RAD, fraTid: "07:00", tilTid: "15:00", externalCostObjectId: ECO_A });
    await caller(ctx).oppdaterTimerRad({ id: RAD, fraTid: "07:00", tilTid: "15:00", externalCostObjectId: null });
    expect(timerUpdate.mock.calls.map((c) => (c[0] as { data: { externalCostObjectId: unknown } }).data.externalCostObjectId)).toEqual([ECO_A, null]);
  });
});
