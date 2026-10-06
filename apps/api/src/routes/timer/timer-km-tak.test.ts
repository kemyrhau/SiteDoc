import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * LAG 0a (H5) — lønnsart-bevisst, symmetrisk tak på `sheetTimer.timer`.
 *
 * En kjøregodtgjørelse føres på en lønnsart med `satsEnhet="per_km"`; det faste
 * 24-taket avviste selv 60 km. Fiksen flytter taket fra Zod (som ikke kjenner
 * lønnsarten) inn i handleren, fra ÉN kilde (`rad-tak.ts`), på ALLE skrivestier.
 *
 * Gate-kriteriene (rød først):
 *  1. per_km-rad på 150 PASSERER — interaktivt (`forsonDagskort`) og i `syncBatch`.
 *     Rød først: det gamle Zod-`.max(24)` ville avvist 150 (interaktivt: throw;
 *     syncBatch: ZodError på hele batchen).
 *  2. Time-rad på 25 t AVVISES. Rød først demonstreres på `redigerSedelRader` —
 *     veien som FAKTISK manglet taket (`.positive()`, intet maks, lastet ikke
 *     lønnsarten). `syncBatch` hadde allerede `.max(24)`, så der er 25 t ikke en
 *     NY skranke; den avvises nå grasiøst (avvist pr. sedel) i stedet for ZodError.
 *
 * Funn (målt på develop `eadc2299`): ordrens premiss-tabell byttet om prosedyre-
 * merkelappene — 4670 (merket «interaktiv») er `syncBatch`, 3528 (merket
 * «syncBatch») er `redigerSedelRader` (web firma-admin). Linjenumrene stemte.
 *
 * Drives via dagsseddelRouter.createCaller med mocket ctx (ingen ekte DB) — samme
 * mønster som forson-dagskort.test.ts.
 */

vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn().mockResolvedValue(undefined),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  hentBrukersOrg: vi.fn(),
  krevBrukersOrg: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
}));
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn().mockResolvedValue(undefined),
  hentEffektivArbeidstid: vi.fn().mockResolvedValue({ startTid: "07:00", sluttTid: "15:00", pauseMin: 30, dagsnorm: 7.5, normKilde: "fast", pauseEtterTimer: 4, pauseReferanse: "ankomst" }),
}));
// LAG 2: syncBatch/forson/rediger henter nå reise-kontekst fra kjerne-prisma
// (hentErReiseKontekst). Mock den så tak-testene ikke treffer ekte DB.
vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationSetting: { findUnique: vi.fn().mockResolvedValue({ reiseLonnsartId: null }) },
    organizationReiseGrense: { findMany: vi.fn().mockResolvedValue([]) },
    reisetidMatrise: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { dagsseddelRouter } from "./dagsseddel";
import {
  TIMER_MAKS_PER_DAG,
  KM_MAKS_PER_DAG,
  maksForSatsEnhet,
  krevRadInnenforTak,
  takFeilmelding,
} from "./rad-tak";

const USER = "user-1";
const ORG = "11111111-1111-1111-1111-111111111111";
const SHEET = "22222222-2222-2222-2222-222222222222";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const LONNSART = "44444444-4444-4444-4444-444444444444";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const RAD1 = "66666666-6666-6666-6666-666666666666";

beforeEach(() => vi.clearAllMocks());

// ===========================================================================
//  Pure kjerne (rad-tak.ts) — ÉN kilde for taket.
// ===========================================================================
describe("rad-tak — lønnsart-bevisst tak fra én kilde", () => {
  it("per_km gir km-taket; alt annet gir 24", () => {
    expect(maksForSatsEnhet("per_km")).toBe(KM_MAKS_PER_DAG);
    expect(maksForSatsEnhet("per_time")).toBe(TIMER_MAKS_PER_DAG);
    expect(maksForSatsEnhet("per_dag")).toBe(TIMER_MAKS_PER_DAG);
    expect(maksForSatsEnhet(null)).toBe(TIMER_MAKS_PER_DAG);
    expect(maksForSatsEnhet(undefined)).toBe(TIMER_MAKS_PER_DAG);
  });

  it("km-taket er høyere enn time-taket (150 km er lovlig, 150 t er ikke)", () => {
    expect(KM_MAKS_PER_DAG).toBeGreaterThan(TIMER_MAKS_PER_DAG);
    expect(() => krevRadInnenforTak(150, "per_km")).not.toThrow();
    expect(() => krevRadInnenforTak(150, "per_time")).toThrow(/overstiger/);
  });

  it("25 t avvises, 24 t passerer; ukjent satsEnhet → konservativt 24-tak", () => {
    expect(() => krevRadInnenforTak(25, "per_time")).toThrow(/maksgrensen på 24/);
    expect(() => krevRadInnenforTak(24, "per_time")).not.toThrow();
    expect(() => krevRadInnenforTak(25, null)).toThrow(/maksgrensen på 24/);
    expect(() => krevRadInnenforTak(25, "ukjent")).toThrow(/maksgrensen på 24/);
  });

  it("feilmeldingen bruker riktig enhet (km vs timer)", () => {
    expect(takFeilmelding(3000, "per_km")).toContain("km");
    expect(takFeilmelding(25, "per_time")).toContain("timer");
  });
});

// ===========================================================================
//  forsonDagskort (interaktiv web) — per_km 150 PASSERER (gate 1, rød først).
// ===========================================================================
function lagForsonCtx(satsEnhet: string | null) {
  const sheet = {
    id: SHEET,
    clientUuid: SHEET,
    userId: USER,
    organizationId: ORG,
    status: "returned",
    pauseMin: 0,
    dato: new Date("2026-09-20T00:00:00Z"),
  };
  const create = vi.fn().mockResolvedValue({ id: "ny-rad" });
  const update = vi.fn().mockResolvedValue({ id: RAD1 });
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = {
    // V20/PK6: synkroniserHodePause bruker dailySheet.update + sheetTimer.aggregate.
    dailySheet: { updateMany, update: vi.fn().mockResolvedValue({}) },
    sheetTimer: {
      update,
      create,
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _sum: { pauseMin: 0 } }),
    },
    // V19 (A-5): forsonDagskort sletter forslaget i tx.
    sheetTimerForslag: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  const transaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {},
    prismaTimer: {
      dailySheet: {
        findUnique: vi.fn().mockResolvedValue(sheet),
        update: vi.fn().mockResolvedValue(sheet),
      },
      lonnsart: {
        findMany: vi.fn().mockResolvedValue([{ id: LONNSART, satsEnhet }]),
      },
      aktivitet: { findMany: vi.fn().mockResolvedValue([{ id: AKTIVITET }]) },
      sheetTimer: { findMany: vi.fn().mockResolvedValue([]), update, create },
      sheetMachine: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: transaction,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, create };
}

const forsonNyRad = (timer: number) => ({
  projectId: PROSJEKT,
  lonnsartId: LONNSART,
  aktivitetId: AKTIVITET,
  timer,
  fraTid: "07:00",
  tilTid: "15:00",
});

describe("forsonDagskort — lønnsart-bevisst tak (gate 1 + regresjon)", () => {
  it("🔴 per_km-rad på 150 PASSERER (rød først: 24-taket ville avvist)", async () => {
    const { ctx, create } = lagForsonCtx("per_km");
    const caller = dagsseddelRouter.createCaller(ctx);
    await expect(
      caller.forsonDagskort({
        sheetId: SHEET,
        oppdateringer: [],
        nyeRader: [forsonNyRad(150)],
      }),
    ).resolves.toBeDefined();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("time-rad på 25 t AVVISES (per_time → 24-tak)", async () => {
    const { ctx, create } = lagForsonCtx("per_time");
    const caller = dagsseddelRouter.createCaller(ctx);
    await expect(
      caller.forsonDagskort({
        sheetId: SHEET,
        oppdateringer: [],
        nyeRader: [forsonNyRad(25)],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(create).not.toHaveBeenCalled();
  });
});

// ===========================================================================
//  redigerSedelRader (web firma-admin) — 25 t AVVISES (gate 2, rød først):
//  veien som manglet taket helt.
// ===========================================================================
function lagRedigerCtx(satsEnhet: string | null) {
  const sheet = {
    id: SHEET,
    organizationId: ORG,
    status: "sent",
    userId: USER,
    pauseMin: 0,
  };
  const lonnsartFindMany = vi
    .fn()
    .mockResolvedValue([{ id: LONNSART, satsEnhet }]);
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {
      organizationSetting: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ tillattRedigerVedAttestering: true }),
      },
    },
    prismaTimer: {
      dailySheet: { findUnique: vi.fn().mockResolvedValue(sheet) },
      sheetTimer: { findMany: vi.fn().mockResolvedValue([]) },
      sheetTillegg: { findMany: vi.fn().mockResolvedValue([]) },
      sheetMachine: { findMany: vi.fn().mockResolvedValue([]) },
      lonnsart: { findMany: lonnsartFindMany },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, lonnsartFindMany };
}

const redigerTimerRad = (timer: number) => ({
  originalId: null,
  projectId: PROSJEKT,
  lonnsartId: LONNSART,
  aktivitetId: AKTIVITET,
  timer,
  fraTid: "07:00",
  tilTid: "15:00",
});

describe("redigerSedelRader — tak lagt til der det manglet (gate 2)", () => {
  it("🔴 time-rad på 25 t AVVISES (rød først: her slapp den gjennom før)", async () => {
    const { ctx, lonnsartFindMany } = lagRedigerCtx("per_time");
    const caller = dagsseddelRouter.createCaller(ctx);
    await expect(
      caller.redigerSedelRader({
        sheetId: SHEET,
        nyeRader: { timer: [redigerTimerRad(25)], tillegg: [], maskin: [] },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // Beviser at fiksen faktisk slo opp lønnsarten (ny skrankekilde).
    expect(lonnsartFindMany).toHaveBeenCalledTimes(1);
  });

  it("per_km-rad på 150 blokkeres IKKE av taket (passerer tak-steget)", async () => {
    const { ctx } = lagRedigerCtx("per_km");
    const caller = dagsseddelRouter.createCaller(ctx);
    // Taket skal ikke kaste. Skrive-stien bak taket er ikke mocket (transaksjon),
    // så vi aksepterer enten resolve eller en IKKE-tak-feil — men ALDRI en
    // BAD_REQUEST med tak-melding.
    try {
      await caller.redigerSedelRader({
        sheetId: SHEET,
        nyeRader: { timer: [redigerTimerRad(150)], tillegg: [], maskin: [] },
      });
    } catch (e) {
      expect(String((e as Error).message)).not.toMatch(/overstiger|maksgrensen/);
    }
  });
});

// ===========================================================================
//  syncBatch (mobil) — per_km 150 slipper gjennom taket, 25 t avvises grasiøst.
// ===========================================================================
function lagSyncCtx(satsEnhet: string | null) {
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    // LAG 2: syncBatch leser firmaets oppmøtesteder (C2-firmagrense) fra ctx.prisma.
    prisma: { oppmotested: { findMany: vi.fn().mockResolvedValue([]) } },
    prismaTimer: {
      dailySheet: { findUnique: vi.fn().mockResolvedValue(null) },
      aktivitet: {
        findFirst: vi.fn().mockResolvedValue({ id: AKTIVITET }),
        findMany: vi.fn().mockResolvedValue([{ id: AKTIVITET }]),
      },
      lonnsart: {
        findMany: vi.fn().mockResolvedValue([{ id: LONNSART, satsEnhet, navn: "Timelønn" }]),
      },
      tillegg: { findMany: vi.fn().mockResolvedValue([]) },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx };
}

const syncSedel = (timer: number) => ({
  clientUuid: "77777777-7777-7777-7777-777777777777",
  projectId: PROSJEKT,
  aktivitetId: AKTIVITET,
  dato: "2026-09-20",
  status: "draft" as const,
  timer: [
    {
      id: "88888888-8888-8888-8888-888888888888",
      lonnsartId: LONNSART,
      aktivitetId: AKTIVITET,
      timer,
    },
  ],
  tillegg: [],
});

describe("syncBatch — lønnsart-bevisst tak (gate 1 + gate 2)", () => {
  it("🔴 per_km-rad på 150 avvises IKKE av taket (rød først: ZodError før)", async () => {
    const { ctx } = lagSyncCtx("per_km");
    const caller = dagsseddelRouter.createCaller(ctx);
    // Etter fiksen resolver kallet (Zod slipper 150 gjennom). Skrive-stien bak
    // taket er ikke mocket → resultatet kan bli "feilet", men ALDRI en tak-avvis.
    const res = await caller.syncBatch({ sedler: [syncSedel(150)] });
    const r = res.resultater[0]!;
    expect(r.feilmelding ?? "").not.toMatch(/overstiger|maksgrensen/);
  });

  it("time-rad på 25 t → resultat 'avvist' med tak-melding (grasiøst, ikke throw)", async () => {
    const { ctx } = lagSyncCtx("per_time");
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({ sedler: [syncSedel(25)] });
    const r = res.resultater[0]!;
    expect(r.resultat).toBe("avvist");
    expect(r.feilmelding).toMatch(/maksgrensen på 24/);
  });
});
