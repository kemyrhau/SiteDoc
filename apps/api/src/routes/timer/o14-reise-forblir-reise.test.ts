import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * O14 pkt 1 (vedtak-timer-web § Reisevinduet pkt 16, RETTELSER R1): en reise forblir en reise.
 * Bytte mellom Reisetid og Arbeidstid på en lagret reise beholder kortet (`kortId`) og
 * reisemerket. Reisetid nuller `arbeidReiseRetning`; Arbeidstid setter den (oppgitt, ellers fra
 * `reiseRetning`). Maskinvakten stopper Arbeidstid → Reisetid når raden bærer maskin.
 *
 * Rød på `7de118c6`: `oppdaterTimerRad` tok ikke `arbeidReiseRetning`, og kort-id-en ble
 * kastet når `erReise` byttet (`lagret: rad.erReise === postErReise ? rad : null`).
 * Drives via createCaller med mocket ctx, som byggeplass-rad.test.ts. `kortIdForSkriving` er
 * ekte (kortIdEnhetsmock bytter bare DB-delene).
 */

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
const REISE_ART = "44444444-4444-4444-4444-444444444401";
const TIMELONN = "44444444-4444-4444-4444-444444444402";
vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue({ role: "user" }) },
    organizationSetting: { findUnique: vi.fn().mockResolvedValue({ reiseLonnsartId: "44444444-4444-4444-4444-444444444401" }) },
    organizationReiseGrense: { findMany: vi.fn().mockResolvedValue([]) },
    reisetidMatrise: { findMany: vi.fn().mockResolvedValue([]) },
    byggeplass: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  },
}));
const utstyr = vi.fn();
vi.mock("@sitedoc/db-maskin", () => ({
  prismaMaskin: { equipment: { findFirst: vi.fn(), findMany: (...a: unknown[]) => utstyr(...a) } },
}));

import { dagsseddelRouter, arbeidReiseRetningEtter } from "./dagsseddel";

const USER = "user-1";
const ORG = "11111111-1111-1111-1111-111111111111";
const SHEET = "22222222-2222-2222-2222-222222222222";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const RAD = "66666666-6666-6666-6666-666666666666";
const KORT = "kort-jobben";

type Rad = Record<string, unknown>;
const REISETID: Rad = {
  id: RAD, sheetId: SHEET, projectId: PROSJEKT, byggeplassId: null, externalCostObjectId: null,
  lonnsartId: REISE_ART, timer: 0.5, fraTid: "06:26", tilTid: "06:56", pauseMin: 0,
  erReise: true, reiseRetning: "ut", arbeidReiseRetning: null, kortId: KORT,
  utenProsjekt: false, attestertStatus: "pending",
};
const ARBEIDSTID: Rad = { ...REISETID, lonnsartId: TIMELONN, erReise: false, reiseRetning: null, arbeidReiseRetning: "retur" };

function lagCtx(rad: Rad, maskiner: { id: string; vehicleId: string }[] = []) {
  const sheet = { id: SHEET, clientUuid: SHEET, userId: USER, organizationId: ORG, status: "draft", pauseMin: 0, dato: new Date("2026-11-22T00:00:00Z") };
  const update = vi.fn(async (a: { data: Rad }) => ({ ...rad, ...a.data }));
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    prisma: { organizationSetting: { findUnique: vi.fn().mockResolvedValue(null) } },
    prismaVarelager: { $executeRawUnsafe: vi.fn().mockResolvedValue(0), vareforbruk: { findMany: vi.fn().mockResolvedValue([]) } },
    prismaMaskin: { equipment: { findMany: (...a: unknown[]) => utstyr(...a) } },
    prismaTimer: {
      $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          sheetTimer: { update, aggregate: vi.fn().mockResolvedValue({ _sum: { pauseMin: 0 } }), findMany: vi.fn().mockResolvedValue([]) },
          dailySheet: { update: vi.fn().mockResolvedValue({}) },
          sheetMachine: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        }),
      ),
      dailySheet: { findUnique: vi.fn().mockResolvedValue(sheet) },
      lonnsart: {
        findFirst: vi.fn().mockResolvedValue({ id: TIMELONN, satsEnhet: "per_time", type: "ordinaer", navn: "Timelønn" }),
        findMany: vi.fn(async (a: { where: { id: { in: string[] } } }) =>
          a.where.id.in.map((id) => ({ id, navn: id === REISE_ART ? "Reise/transport" : "Timelønn" })),
        ),
      },
      aktivitet: { findFirst: vi.fn().mockResolvedValue({ id: "akt" }) },
      sheetTimer: { findUnique: vi.fn().mockResolvedValue(rad), findMany: vi.fn().mockResolvedValue([]), update },
      sheetMachine: { findMany: vi.fn().mockResolvedValue(maskiner), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      sheetTillegg: { findMany: vi.fn().mockResolvedValue([]) },
    },
  };
  return { ctx, update };
}
const caller = (ctx: unknown) => dagsseddelRouter.createCaller(ctx as Parameters<typeof dagsseddelRouter.createCaller>[0]);
const felles = { id: RAD, fraTid: "06:26", tilTid: "06:56", timer: 0.5 };

beforeEach(() => {
  utstyr.mockReset();
  utstyr.mockResolvedValue([]);
});

describe("O14 pkt 1 — en reise forblir en reise (oppdaterTimerRad)", () => {
  it("Reisetid → Arbeidstid: kortet står, retningen settes fra reiseRetning", async () => {
    const { ctx, update } = lagCtx(REISETID);
    await caller(ctx).oppdaterTimerRad({ ...felles, lonnsartId: TIMELONN });
    const data = update.mock.calls[0]![0].data;
    expect(data.erReise).toBe(false);
    expect(data.kortId).toBe(KORT);
    expect(data.arbeidReiseRetning).toBe("ut");
  });

  it("Reisetid → Arbeidstid med oppgitt retning: oppgitt vinner", async () => {
    const { ctx, update } = lagCtx(REISETID);
    await caller(ctx).oppdaterTimerRad({ ...felles, lonnsartId: TIMELONN, arbeidReiseRetning: "retur" });
    expect(update.mock.calls[0]![0].data.arbeidReiseRetning).toBe("retur");
  });

  it("Arbeidstid → Reisetid: kortet står, merket nulles, reisen får retningen", async () => {
    const { ctx, update } = lagCtx(ARBEIDSTID);
    await caller(ctx).oppdaterTimerRad({ ...felles, lonnsartId: REISE_ART });
    const data = update.mock.calls[0]![0].data;
    expect(data.erReise).toBe(true);
    expect(data.kortId).toBe(KORT);
    expect(data.arbeidReiseRetning).toBeNull();
    expect(data.reiseRetning).toBe("retur");
  });

  // O14 pkt 2 (R2): «Reise»-vinduet i redigering retter retningen på en reisetid-reise.
  it("pkt 2: reisetid-reise med oppgitt reiseRetning får den nye retningen; uendret lønnsart, kortet står", async () => {
    const { ctx, update } = lagCtx(REISETID);
    await caller(ctx).oppdaterTimerRad({ ...felles, reiseRetning: "retur" });
    const data = update.mock.calls[0]![0].data;
    expect(data.reiseRetning).toBe("retur");
    expect(data.kortId).toBe(KORT);
    expect(data).not.toHaveProperty("lonnsartId");
  });

  it("negativkontroll: vanlig arbeid → reise-lønnsart gir fortsatt nytt kort (regel 3)", async () => {
    const { ctx, update } = lagCtx({ ...ARBEIDSTID, arbeidReiseRetning: null });
    await caller(ctx).oppdaterTimerRad({ ...felles, lonnsartId: REISE_ART });
    expect(update.mock.calls[0]![0].data.kortId).toBeNull();
  });

  it("maskinvakten: Arbeidstid → Reisetid avvises når raden bærer maskin som krever timerad", async () => {
    utstyr.mockResolvedValue([{ id: "v1", merke: "Volvo", modell: "EC220", internNavn: null, utleieEnhet: "time" }]);
    const { ctx, update } = lagCtx(ARBEIDSTID, [{ id: "m1", vehicleId: "v1" }]);
    await expect(caller(ctx).oppdaterTimerRad({ ...felles, lonnsartId: REISE_ART })).rejects.toThrow(/kan ikke bli reise/);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("arbeidReiseRetningEtter (R1)", () => {
  const r = (erReise: boolean, reiseRetning: string | null, arbeidReiseRetning: string | null) => ({ erReise, reiseRetning, arbeidReiseRetning });
  it("reise etter → alltid null", () => expect(arbeidReiseRetningEtter(r(false, null, "ut"), true, "ut")).toBeNull());
  it("retur-reise blir arbeidstid → «retur»", () => expect(arbeidReiseRetningEtter(r(true, "retur", null), false, undefined)).toBe("retur"));
  it("arbeid uten merke forblir uten", () => expect(arbeidReiseRetningEtter(r(false, null, null), false, undefined)).toBeNull());
  it("arbeidstid-reise beholder merket", () => expect(arbeidReiseRetningEtter(r(false, null, "ut"), false, undefined)).toBe("ut"));
});

describe("O14 pkt 5 (R4) — lagreJobbTid teller ikke arbeidstid-reisen som linje", () => {
  const r = (id: string, f: Partial<{ kortId: string | null; erReise: boolean; arbeidReiseRetning: string | null; utenProsjekt: boolean }> = {}) => ({
    id, kortId: KORT, erReise: false, arbeidReiseRetning: null, utenProsjekt: false, ...f,
  });
  it("kort med overtid + arbeidstid-reise: bare overtidslinja er jobben (bilde 06)", async () => {
    const { jobbLinjerIKort } = await import("./dagsseddel");
    const linjer = jobbLinjerIKort([r("ot"), r("reise", { arbeidReiseRetning: "retur" }), r("rt", { erReise: true }), r("annet", { kortId: "x" })], KORT);
    expect(linjer.map((l) => l.id)).toEqual(["ot"]);
  });
});
