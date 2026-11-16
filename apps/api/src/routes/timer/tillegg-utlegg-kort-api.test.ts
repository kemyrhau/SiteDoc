import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T2–T4 + B7 (spec tillegg-utlegg-prosjektkort-spec.md § 9) — tillegg og utlegg
 * bærer kortets byggeplass og underprosjekt (ECO) i API-et.
 *
 *  - T2: interaktive skriveveier (tilfoy/oppdater tillegg+utlegg) avviser byggeplass
 *        eller underprosjekt fra annet prosjekt (BAD_REQUEST, ingen skriving);
 *        utelatt felt i oppdater er urørt.
 *  - T3: syncBatch bærer feltene; utelatt (gammel klient) → NULL = arv; fremmed →
 *        null (aldri avvisning — offline-køen); hentEndringerSiden returnerer dem.
 *  - T4: splitt arver kortet (arvTilleggKort); redigerSedelRader og splittRadEier
 *        avviser fremmed byggeplass/ECO på tillegg før transaksjonen.
 *  - B7: flyttTimerRadEco med radType "tillegg" oppdaterer sheet_tillegg;
 *        standard (timer) er uendret.
 *
 * Drives via dagsseddelRouter.createCaller med mocket ctx (ingen ekte DB) — samme
 * mønster som byggeplass-rad.test.ts og overlapp-pc-mobil.test.ts.
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

vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn().mockResolvedValue(undefined),
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

import { dagsseddelRouter, arvTilleggKort } from "./dagsseddel";

const caller = (ctx: unknown) =>
  dagsseddelRouter.createCaller(ctx as Parameters<typeof dagsseddelRouter.createCaller>[0]);

const AVVIST = /hører ikke til radens prosjekt/;

beforeEach(() => vi.clearAllMocks());

/** Ctx for de interaktive skriveveiene (tilfoy/oppdater/splitt/rediger/flytt). */
function lagCtx(opts: { status?: string; originalTillegg?: Record<string, unknown> } = {}) {
  const sheet = {
    id: SHEET,
    clientUuid: SHEET,
    userId: USER,
    organizationId: ORG,
    status: opts.status ?? "draft",
    pauseMin: 0,
    dato: new Date(),
  };
  const originalTillegg = opts.originalTillegg ?? {
    id: RAD, sheetId: SHEET, projectId: PROSJEKT_A, tilleggId: TILLEGG, antall: 2,
    kommentar: null, byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_A,
  };
  const ekko = (args: { data: unknown }) => Promise.resolve(args.data);
  const tilleggCreate = vi.fn(ekko);
  const tilleggUpdate = vi.fn(ekko);
  const utleggCreate = vi.fn(ekko);
  const utleggUpdate = vi.fn(ekko);
  const timerUpdate = vi.fn(ekko);
  const transaction = vi.fn((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: unknown) => Promise<unknown>)(ctx.prismaTimer)
      : Promise.all(arg as Promise<unknown>[]),
  );
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {
      organizationSetting: {
        findUnique: vi.fn().mockResolvedValue({ tillattRedigerVedAttestering: true }),
      },
    },
    prismaTimer: {
      $transaction: transaction,
      dailySheet: {
        findUnique: vi.fn().mockResolvedValue(sheet),
        update: vi.fn().mockResolvedValue({}),
      },
      tillegg: {
        findFirst: vi.fn().mockResolvedValue({ id: TILLEGG }),
        // Post (7) punkt 1: katalog-firmavakten (splitt/oppdater).
        findMany: vi.fn().mockResolvedValue([{ id: TILLEGG }]),
      },
      expenseCategory: { findFirst: vi.fn().mockResolvedValue({ id: KATEGORI, ordning: "utlegg" }) },
      prosjektOrdningOverstyring: { findFirst: vi.fn().mockResolvedValue(null) },
      sheetTillegg: {
        findUnique: vi.fn().mockResolvedValue(originalTillegg),
        findMany: vi.fn().mockResolvedValue([]),
        create: tilleggCreate,
        update: tilleggUpdate,
        delete: vi.fn().mockResolvedValue({}),
      },
      sheetUtlegg: {
        findUnique: vi.fn().mockResolvedValue({
          id: RAD, sheetId: SHEET, projectId: PROSJEKT_A, expenseCategoryId: KATEGORI,
          belop: 100, ordningVedFoering: "utlegg", byggeplassId: null, externalCostObjectId: null,
        }),
        create: utleggCreate,
        update: utleggUpdate,
      },
      sheetTimer: {
        findUnique: vi.fn().mockResolvedValue({
          id: RAD, sheetId: SHEET, projectId: PROSJEKT_A, externalCostObjectId: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
        update: timerUpdate,
      },
      sheetMachine: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
  return { ctx, sheet, transaction, tilleggCreate, tilleggUpdate, utleggCreate, utleggUpdate, timerUpdate };
}

const tilleggInput = { sheetId: SHEET, projectId: PROSJEKT_A, tilleggId: TILLEGG, antall: 1 };
const utleggInput = { sheetId: SHEET, projectId: PROSJEKT_A, expenseCategoryId: KATEGORI, belop: 250 };

describe("T2 — tilfoy/oppdater tillegg og utlegg bærer kortet", () => {
  it("tilfoyTilleggRad lagrer byggeplass + underprosjekt fra radens prosjekt", async () => {
    const { ctx, tilleggCreate } = lagCtx();
    await caller(ctx).tilfoyTilleggRad({ ...tilleggInput, byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_A });
    expect(tilleggCreate.mock.calls[0]![0].data).toMatchObject({ byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_A });
  });

  it("tilfoyTilleggRad uten feltene (gammel web) → NULL = arv", async () => {
    const { ctx, tilleggCreate } = lagCtx();
    await caller(ctx).tilfoyTilleggRad(tilleggInput);
    expect(tilleggCreate.mock.calls[0]![0].data).toMatchObject({ byggeplassId: null, externalCostObjectId: null });
  });

  for (const [navn, felt] of [
    ["byggeplass fra annet prosjekt", { byggeplassId: BYGGEPLASS_B }],
    ["underprosjekt fra annet prosjekt", { externalCostObjectId: ECO_B }],
    ["underprosjekt fra annet firma", { externalCostObjectId: ECO_ANNET_FIRMA }],
  ] as const) {
    it(`🔴 tilfoyTilleggRad: ${navn} → BAD_REQUEST, ingen rad`, async () => {
      const { ctx, tilleggCreate, transaction } = lagCtx();
      await expect(caller(ctx).tilfoyTilleggRad({ ...tilleggInput, ...felt })).rejects.toThrow(AVVIST);
      expect(tilleggCreate).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });

    it(`🔴 tilfoyUtleggRad: ${navn} → BAD_REQUEST, ingen rad`, async () => {
      const { ctx, utleggCreate, transaction } = lagCtx();
      await expect(caller(ctx).tilfoyUtleggRad({ ...utleggInput, ...felt })).rejects.toThrow(AVVIST);
      expect(utleggCreate).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });
  }

  it("tilfoyUtleggRad lagrer byggeplass + underprosjekt", async () => {
    const { ctx, utleggCreate } = lagCtx();
    await caller(ctx).tilfoyUtleggRad({ ...utleggInput, byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_A });
    expect(utleggCreate.mock.calls[0]![0].data).toMatchObject({ byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_A });
  });

  it("🔴 oppdaterTilleggRad/oppdaterUtleggRad: valideres mot RADENS prosjekt, ingen oppdatering", async () => {
    for (const felt of [{ byggeplassId: BYGGEPLASS_B }, { externalCostObjectId: ECO_B }]) {
      const t = lagCtx();
      await expect(caller(t.ctx).oppdaterTilleggRad({ id: RAD, ...felt })).rejects.toThrow(AVVIST);
      expect(t.tilleggUpdate).not.toHaveBeenCalled();
      const u = lagCtx();
      await expect(caller(u.ctx).oppdaterUtleggRad({ id: RAD, ...felt })).rejects.toThrow(AVVIST);
      expect(u.utleggUpdate).not.toHaveBeenCalled();
    }
  });

  it("oppdater uten feltene: data har dem ikke (urørt); oppgitt verdi settes", async () => {
    const t = lagCtx();
    await caller(t.ctx).oppdaterTilleggRad({ id: RAD, antall: 3 });
    const data = t.tilleggUpdate.mock.calls[0]![0].data as Record<string, unknown>;
    expect("byggeplassId" in data).toBe(false);
    expect("externalCostObjectId" in data).toBe(false);

    const u = lagCtx();
    await caller(u.ctx).oppdaterUtleggRad({ id: RAD, byggeplassId: BYGGEPLASS_A, externalCostObjectId: null });
    expect(u.utleggUpdate.mock.calls[0]![0].data).toMatchObject({ byggeplassId: BYGGEPLASS_A, externalCostObjectId: null });
  });
});

// ---------------------------------------------------------------------------
// T3 — syncBatch + hentEndringerSiden
// ---------------------------------------------------------------------------

const CLIENT_UUID = "c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1";
const TL_ID = "f0000000-0000-0000-0000-000000000001";
const UT_ID = "f0000000-0000-0000-0000-000000000002";

function lagSyncCtx() {
  const tilleggCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const utleggCreateMany = vi.fn().mockResolvedValue({ count: 1 });
  const hode = {
    id: CLIENT_UUID, clientUuid: CLIENT_UUID, status: "draft", userId: USER, organizationId: ORG,
    lederKommentar: null, attestertVed: null, updatedAt: new Date("2026-11-13T10:00:00Z"),
  };
  const txMock = {
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
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { pauseMin: 0 } }),
    },
    sheetTillegg: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: tilleggCreateMany },
    sheetMachine: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sheetUtlegg: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: utleggCreateMany },
    sheetTimerForslag: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: { oppmotested: { findMany: vi.fn().mockResolvedValue([]) } },
    prismaTimer: {
      dailySheet: { findUnique: vi.fn().mockResolvedValue(null) },
      aktivitet: {
        findFirst: vi.fn().mockResolvedValue({ id: AKTIVITET }),
        findMany: vi.fn().mockResolvedValue([{ id: AKTIVITET }]),
      },
      lonnsart: { findMany: vi.fn().mockResolvedValue([]) },
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
  return { ctx, tilleggCreateMany, utleggCreateMany };
}

function sedel(kort: { tillegg?: Record<string, unknown>; utlegg?: Record<string, unknown> }) {
  return {
    clientUuid: CLIENT_UUID,
    projectId: PROSJEKT_A,
    aktivitetId: AKTIVITET,
    byggeplassId: null,
    dato: "2026-11-12",
    status: "draft" as const,
    timer: [],
    tillegg: [{ id: TL_ID, projectId: PROSJEKT_A, tilleggId: TILLEGG, antall: 1, ...kort.tillegg }],
    maskiner: [],
    utlegg: [{
      id: UT_ID, projectId: PROSJEKT_A, expenseCategoryId: KATEGORI, belop: 100,
      ordningVedFoering: "utlegg" as const, foertVed: "2026-11-12T08:00:00.000Z", ...kort.utlegg,
    }],
  };
}

describe("T3 — syncBatch bærer kortfeltene", () => {
  it("ny klient: byggeplass + underprosjekt fra radens prosjekt lagres", async () => {
    const { ctx, tilleggCreateMany, utleggCreateMany } = lagSyncCtx();
    const kort = { byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_A };
    const res = await caller(ctx).syncBatch({ sedler: [sedel({ tillegg: kort, utlegg: kort })] });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(tilleggCreateMany.mock.calls[0]![0].data[0]).toMatchObject(kort);
    expect(utleggCreateMany.mock.calls[0]![0].data[0]).toMatchObject(kort);
  });

  it("🔴 gammel klient (feltene utelatt) → NULL = arv, aldri sedelens verdi skrevet inn", async () => {
    const { ctx, tilleggCreateMany, utleggCreateMany } = lagSyncCtx();
    const s = { ...sedel({}), byggeplassId: BYGGEPLASS_A };
    const res = await caller(ctx).syncBatch({ sedler: [s] });
    expect(res.resultater[0]!.resultat).toBe("ok");
    for (const cm of [tilleggCreateMany, utleggCreateMany]) {
      expect(cm.mock.calls[0]![0].data[0]).toMatchObject({ byggeplassId: null, externalCostObjectId: null });
    }
  });

  it("🔴 fremmed byggeplass/underprosjekt → null (vasket), sedelen avvises IKKE", async () => {
    const { ctx, tilleggCreateMany, utleggCreateMany } = lagSyncCtx();
    const res = await caller(ctx).syncBatch({
      sedler: [sedel({
        tillegg: { byggeplassId: BYGGEPLASS_B, externalCostObjectId: ECO_B },
        utlegg: { byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_ANNET_FIRMA },
      })],
    });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(tilleggCreateMany.mock.calls[0]![0].data[0]).toMatchObject({ byggeplassId: null, externalCostObjectId: null });
    // Byggeplassen er gyldig og beholdes; bare underprosjektet fra annet firma vaskes.
    expect(utleggCreateMany.mock.calls[0]![0].data[0]).toMatchObject({ byggeplassId: BYGGEPLASS_A, externalCostObjectId: null });
  });
});

describe("T3 — hentEndringerSiden returnerer kortfeltene", () => {
  it("tillegg og utlegg har byggeplassId + externalCostObjectId i pull-payloaden", async () => {
    const naa = new Date("2026-11-13T10:00:00Z");
    const fullSedel = {
      id: SHEET, clientUuid: SHEET, userId: USER, organizationId: ORG, projectId: PROSJEKT_A,
      byggeplassId: null, aktivitetId: AKTIVITET, dato: new Date("2026-11-12T00:00:00Z"),
      status: "draft", pauseMin: 0, kommentar: null, lederKommentar: null,
      updatedAt: naa, createdAt: naa, startAt: null, endAt: null, attestertVed: null,
      konfliktVentendeSiden: null,
      timer: [], maskiner: [],
      tillegg: [{
        id: TL_ID, projectId: PROSJEKT_A, tilleggId: TILLEGG, antall: 1, kommentar: null,
        byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_A, updatedAt: naa, createdAt: naa,
      }],
      utlegg: [{
        id: UT_ID, projectId: PROSJEKT_A, expenseCategoryId: KATEGORI, belop: 100, kommentar: null,
        ordningVedFoering: "utlegg", byggeplassId: null, externalCostObjectId: ECO_A,
        updatedAt: naa, createdAt: naa,
      }],
    };
    const ctx = {
      userId: USER,
      req: { log: { info: vi.fn(), warn: vi.fn() } },
      prisma: {},
      prismaTimer: {
        dailySheet: {
          findMany: vi.fn()
            .mockResolvedValueOnce([{ id: SHEET, clientUuid: SHEET }])
            .mockResolvedValue([fullSedel]),
        },
        sheetTilleggVedlegg: { findMany: vi.fn().mockResolvedValue([]) },
        sheetUtleggVedlegg: { findMany: vi.fn().mockResolvedValue([]) },
        sheetTimerForslag: { groupBy: vi.fn().mockResolvedValue([]) },
      },
    };
    const res = (await caller(ctx).hentEndringerSiden({ organizationId: ORG })) as {
      sedler: { tillegg: Record<string, unknown>[]; utlegg: Record<string, unknown>[] }[];
    };
    const s = res.sedler[0]!;
    expect(s.tillegg[0]).toMatchObject({ byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_A });
    expect(s.utlegg[0]).toMatchObject({ byggeplassId: null, externalCostObjectId: ECO_A });
  });
});

// ---------------------------------------------------------------------------
// T4 — splitt arver kortet; rediger/splitt avviser fremmede verdier
// ---------------------------------------------------------------------------

describe("T4 — arvTilleggKort", () => {
  const original = { projectId: PROSJEKT_A, byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_A };
  it("utelatt felt + samme prosjekt → originalens kort", () => {
    expect(arvTilleggKort({ projectId: PROSJEKT_A }, original)).toEqual({ byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_A });
  });
  it("oppgitt verdi vinner, også eksplisitt null", () => {
    expect(arvTilleggKort({ projectId: PROSJEKT_A, byggeplassId: null, externalCostObjectId: null }, original))
      .toEqual({ byggeplassId: null, externalCostObjectId: null });
  });
  it("annet prosjekt → aldri originalens kort (ville krysset prosjektgrensen)", () => {
    expect(arvTilleggKort({ projectId: PROSJEKT_B }, original)).toEqual({ byggeplassId: null, externalCostObjectId: null });
  });
});

describe("T4 — splitt og rediger av tillegg", () => {
  const del = { projectId: PROSJEKT_A, tilleggId: TILLEGG, antall: 1 };

  it("splittRadEier: delene arver originalens byggeplass + underprosjekt", async () => {
    const { ctx, tilleggCreate } = lagCtx();
    await caller(ctx).splittRadEier({ radType: "tillegg", radId: RAD, nyeRader: [del, del] });
    expect(tilleggCreate).toHaveBeenCalledTimes(2);
    for (const kall of tilleggCreate.mock.calls) {
      expect(kall[0].data).toMatchObject({ byggeplassId: BYGGEPLASS_A, externalCostObjectId: ECO_A });
    }
  });

  for (const felt of [{ byggeplassId: BYGGEPLASS_B }, { externalCostObjectId: ECO_B }]) {
    it(`🔴 splittRadEier: tillegg-del med ${Object.keys(felt)[0]} fra annet prosjekt avvises, ingen transaksjon`, async () => {
      const { ctx, transaction } = lagCtx();
      await expect(
        caller(ctx).splittRadEier({ radType: "tillegg", radId: RAD, nyeRader: [del, { ...del, ...felt }] }),
      ).rejects.toThrow(AVVIST);
      expect(transaction).not.toHaveBeenCalled();
    });

    it(`🔴 redigerSedelRader: tillegg med ${Object.keys(felt)[0]} fra annet prosjekt avvises, ingen transaksjon`, async () => {
      const { ctx, transaction } = lagCtx({ status: "sent" });
      await expect(
        caller(ctx).redigerSedelRader({
          sheetId: SHEET,
          nyeRader: { timer: [], maskin: [], tillegg: [{ originalId: null, ...del, ...felt }] },
        }),
      ).rejects.toThrow(AVVIST);
      expect(transaction).not.toHaveBeenCalled();
    });
  }
});

// ---------------------------------------------------------------------------
// B7 — attestanten flytter tillegg mellom underprosjekter
// ---------------------------------------------------------------------------

describe("B7 — flyttTimerRadEco for tillegg", () => {
  it("radType tillegg: sheet_tillegg oppdateres, sheet_timer røres ikke, logges som tillegg", async () => {
    const { ctx, tilleggUpdate, timerUpdate } = lagCtx({ status: "sent" });
    await caller(ctx).flyttTimerRadEco({ timerRadId: RAD, radType: "tillegg", externalCostObjectId: null });
    expect(tilleggUpdate).toHaveBeenCalledWith({ where: { id: RAD }, data: { externalCostObjectId: null } });
    expect(timerUpdate).not.toHaveBeenCalled();
    expect(activityCreate.mock.calls[0]![0].data).toMatchObject({
      targetType: "sheet_tillegg", action: "tillegg.eco-flyttet", payload: { fraEcoId: ECO_A, tilEcoId: null },
    });
  });

  it("uten radType (eldre web): timer-veien som før", async () => {
    const { ctx, tilleggUpdate, timerUpdate } = lagCtx({ status: "sent" });
    await caller(ctx).flyttTimerRadEco({ timerRadId: RAD, externalCostObjectId: ECO_A });
    expect(timerUpdate).toHaveBeenCalledWith({ where: { id: RAD }, data: { externalCostObjectId: ECO_A } });
    expect(tilleggUpdate).not.toHaveBeenCalled();
    expect(activityCreate.mock.calls[0]![0].data).toMatchObject({ targetType: "sheet_timer", action: "timer.eco-flyttet" });
  });

  it("🔴 tillegg: underprosjekt fra annet prosjekt avvises, ingen oppdatering", async () => {
    const { ctx, tilleggUpdate } = lagCtx({ status: "sent" });
    await expect(
      caller(ctx).flyttTimerRadEco({ timerRadId: RAD, radType: "tillegg", externalCostObjectId: ECO_B }),
    ).rejects.toThrow(/samme prosjekt/);
    expect(tilleggUpdate).not.toHaveBeenCalled();
  });

  it("tillegg på utkast (ikke innsendt) avvises som for timer", async () => {
    const { ctx, tilleggUpdate } = lagCtx({ status: "draft" });
    await expect(
      caller(ctx).flyttTimerRadEco({ timerRadId: RAD, radType: "tillegg", externalCostObjectId: null }),
    ).rejects.toThrow(/innsendte/);
    expect(tilleggUpdate).not.toHaveBeenCalled();
  });
});
