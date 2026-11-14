import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Ordre 2026-11-14 (9) — terskel og avstandsbånd på «+ Reise» (Kenneth-vedtak
 * «Arbeidstid, erReise false»).
 *
 * Ingen serverendring: en under-terskel-rad er en vanlig rad på ordinær art,
 * UTEN reiseKilde og UTEN avstand. Testen låser at begge skrivestiene tar den
 * imot uendret, og at vakta i tilfoyTimerRad (dagsseddel.ts — `reiseKilde &&
 * !erReise` → BAD_REQUEST) fortsatt stopper en falsk reise-rad.
 *
 *  - tilfoyTimerRad (web-stien): driver ruteren via createCaller med mocket ctx.
 *  - syncBatch (mobil-stien): mater `klassifiserManuellReise`-resultatet rett inn
 *    i `validerReiseInvarianter` (C2) — samme payload mobilen sender.
 */

const findUniqueSetting = vi.fn();
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

import { klassifiserManuellReise, type ReiseRegelsett } from "@sitedoc/shared";
import { dagsseddelRouter } from "./dagsseddel";
import { validerReiseInvarianter } from "./reise-sporbarhet";

const USER = "user-1";
const ORG = "11111111-1111-1111-1111-111111111111";
const SHEET = "22222222-2222-2222-2222-222222222222";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const ORDINAER = "44444444-4444-4444-4444-444444444444";
const REISE = "45454545-4545-4545-4545-454545454545";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const OPPMOTE = "77777777-7777-7777-7777-777777777777";

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

const rad = (lonnsartId: string, reiseKilde?: "manuell") => ({
  sheetId: SHEET, projectId: PROSJEKT, lonnsartId, aktivitetId: AKTIVITET,
  timer: 0.25, fraTid: "07:00", tilTid: "07:15", pauseMin: 0,
  ...(reiseKilde ? { reiseKilde } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  // Firmaet har valgt «Reisetid» som reise-art eksplisitt.
  findUniqueSetting.mockResolvedValue({ reiseLonnsartId: REISE });
});

describe("tilfoyTimerRad — vakta står (ordre 9)", () => {
  it("🔴 reiseKilde på ordinær art → BAD_REQUEST, ingen rad", async () => {
    const { ctx, timerCreate } = lagCtx();
    await expect(caller(ctx).tilfoyTimerRad(rad(ORDINAER, "manuell"))).rejects.toThrow(
      /Lønnsarten er ikke en reise-lønnsart/,
    );
    expect(timerCreate).not.toHaveBeenCalled();
  });

  it("under terskel: ordinær art uten reiseKilde → erReise false, null-spor", async () => {
    const { ctx, timerCreate } = lagCtx();
    await caller(ctx).tilfoyTimerRad(rad(ORDINAER));
    expect(timerCreate).toHaveBeenCalledTimes(1);
    expect(timerCreate.mock.calls[0]![0].data).toMatchObject({
      lonnsartId: ORDINAER,
      erReise: false,
      reiseKilde: null,
    });
  });

  it("over terskel: reise-art med reiseKilde → erReise true, kilde manuell", async () => {
    const { ctx, timerCreate } = lagCtx();
    await caller(ctx).tilfoyTimerRad(rad(REISE, "manuell"));
    expect(timerCreate.mock.calls[0]![0].data).toMatchObject({
      lonnsartId: REISE,
      erReise: true,
      reiseKilde: "manuell",
    });
  });
});

describe("syncBatch C2 — mobilens payload fra klassifiserManuellReise", () => {
  const km: ReiseRegelsett = {
    reiseTerskelEnhet: "km",
    reiseTerskelMin: 30,
    reiseTerskelM: 7500,
    reiseUnderTerskelType: "arbeidstid",
    reiseOverTerskelType: "reisetid",
  };
  const basis = {
    regel: km, reisetimer: 1, grensepunkter: [{ grenseM: 30000, lonnsartId: REISE }],
    resolverLonnsartId: REISE, standardLonnsartId: ORDINAER,
  };
  const tilInvariant = (
    k: ReturnType<typeof klassifiserManuellReise>,
    oppmotestedId: string | null,
  ) => ({
    erReise: k.erReise,
    reiseRetning: null,
    reiseKilde: k.reiseKilde,
    reiseOppmotestedId: k.erReise ? oppmotestedId : null,
    reiseKjoretidMin: null,
    reiseAvstandM: k.reiseAvstandM,
    reiseRegel: k.reiseRegel,
  });
  const gyldige = new Set([OPPMOTE]);

  it("under terskel (kjent avstand) → godtatt, ingen avstand på raden", () => {
    const k = klassifiserManuellReise({ ...basis, avstandM: 5000 });
    expect(k.erReise).toBe(false);
    expect(validerReiseInvarianter(tilInvariant(k, OPPMOTE), gyldige)).toBeNull();
  });

  it("ukjent avstand (regel c) → godtatt som arbeidstid", () => {
    const k = klassifiserManuellReise({ ...basis, avstandM: null });
    expect(validerReiseInvarianter(tilInvariant(k, null), gyldige)).toBeNull();
  });

  it("over terskel med bånd → manuell reise med avstand + oppmøtested + regel godtatt", () => {
    const k = klassifiserManuellReise({ ...basis, avstandM: 42000 });
    expect(k).toMatchObject({ erReise: true, reiseKilde: "manuell", reiseAvstandM: 42000 });
    expect(validerReiseInvarianter(tilInvariant(k, OPPMOTE), gyldige)).toBeNull();
  });

  it("🔴 negativkontroll: ikke-reise-rad med avstand avvises (C2 + DB-CHECK)", () => {
    const k = klassifiserManuellReise({ ...basis, avstandM: 5000 });
    expect(
      validerReiseInvarianter({ ...tilInvariant(k, null), reiseAvstandM: 5000 }, gyldige),
    ).toMatch(/ikke-reise-rad bærer reise-felter/);
  });
});
