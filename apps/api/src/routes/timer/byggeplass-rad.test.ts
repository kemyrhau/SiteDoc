import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Ordre 2026-11-05 (10) — byggeplass per timer-/maskin-rad i web-dagsseddelen.
 *
 * `byggeplassId` på SheetTimer/SheetMachine er en svak referanse, så serveren må
 * avvise en byggeplass fra et annet prosjekt enn radens. Rød først: før ordren
 * lagret tilfoyTimerRad/maskin.tilfoy verdien ukontrollert, og oppdaterTimerRad/
 * maskin.oppdater tok den ikke imot i det hele tatt.
 *
 * Drives via dagsseddelRouter.createCaller med mocket ctx (ingen ekte DB) — samme
 * mønster som timer-km-tak.test.ts.
 */

const findFirstByggeplass = vi.fn();

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
    organizationSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    organizationReiseGrense: { findMany: vi.fn().mockResolvedValue([]) },
    reisetidMatrise: { findMany: vi.fn().mockResolvedValue([]) },
    byggeplass: { findFirst: (...a: unknown[]) => findFirstByggeplass(...a) },
  },
}));
vi.mock("@sitedoc/db-maskin", () => ({
  prismaMaskin: { equipment: { findFirst: vi.fn().mockResolvedValue({ id: "utstyr" }) } },
}));

import { dagsseddelRouter } from "./dagsseddel";
import { krevByggeplassIProsjekt } from "./byggeplass-rad";

const USER = "user-1";
const ORG = "11111111-1111-1111-1111-111111111111";
const SHEET = "22222222-2222-2222-2222-222222222222";
const PROSJEKT_A = "33333333-3333-3333-3333-333333333333";
const LONNSART = "44444444-4444-4444-4444-444444444444";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const RAD = "66666666-6666-6666-6666-666666666666";
const UTSTYR = "77777777-7777-7777-7777-777777777777";
const BYGGEPLASS_B = "88888888-8888-8888-8888-888888888888"; // hører til prosjekt B

beforeEach(() => {
  vi.clearAllMocks();
  // Byggeplassen finnes ikke under radens prosjekt (A).
  findFirstByggeplass.mockResolvedValue(null);
});

function lagCtx() {
  const sheet = {
    id: SHEET,
    clientUuid: SHEET,
    userId: USER,
    organizationId: ORG,
    status: "draft",
    pauseMin: 0,
    dato: new Date("2026-11-05T00:00:00Z"),
  };
  const timerCreate = vi.fn();
  const timerUpdate = vi.fn();
  const maskinCreate = vi.fn();
  const maskinUpdate = vi.fn();
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {},
    prismaTimer: {
      dailySheet: { findUnique: vi.fn().mockResolvedValue(sheet) },
      lonnsart: {
        findFirst: vi.fn().mockResolvedValue({ id: LONNSART, satsEnhet: "per_time" }),
      },
      aktivitet: { findFirst: vi.fn().mockResolvedValue({ id: AKTIVITET }) },
      sheetTimer: {
        findUnique: vi.fn().mockResolvedValue({
          id: RAD, sheetId: SHEET, projectId: PROSJEKT_A, lonnsartId: LONNSART, timer: 4,
        }),
        create: timerCreate,
        update: timerUpdate,
      },
      sheetMachine: {
        findUnique: vi.fn().mockResolvedValue({
          id: RAD, sheetId: SHEET, projectId: PROSJEKT_A, vehicleId: UTSTYR, timer: 4,
        }),
        create: maskinCreate,
        update: maskinUpdate,
      },
    },
  };
  return { ctx, timerCreate, timerUpdate, maskinCreate, maskinUpdate };
}

// createCaller-typen er for dyp til å uttrykke mock-ctx; samme grep som de andre testene.
const caller = (ctx: unknown) =>
  dagsseddelRouter.createCaller(ctx as Parameters<typeof dagsseddelRouter.createCaller>[0]);

const AVVIST = /hører ikke til radens prosjekt/;

describe("byggeplass per rad — avvisning av byggeplass fra annet prosjekt (ordre 10)", () => {
  it("🔴 tilfoyTimerRad: BAD_REQUEST, ingen rad opprettes", async () => {
    const { ctx, timerCreate } = lagCtx();
    await expect(
      caller(ctx).tilfoyTimerRad({
        sheetId: SHEET, projectId: PROSJEKT_A, byggeplassId: BYGGEPLASS_B,
        lonnsartId: LONNSART, aktivitetId: AKTIVITET, timer: 4,
        fraTid: "07:00", tilTid: "11:00",
      }),
    ).rejects.toThrow(AVVIST);
    expect(findFirstByggeplass).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BYGGEPLASS_B, projectId: PROSJEKT_A } }),
    );
    expect(timerCreate).not.toHaveBeenCalled();
  });

  it("🔴 oppdaterTimerRad: valideres mot RADENS prosjekt, ingen oppdatering", async () => {
    const { ctx, timerUpdate } = lagCtx();
    await expect(
      caller(ctx).oppdaterTimerRad({
        id: RAD, byggeplassId: BYGGEPLASS_B, fraTid: "07:00", tilTid: "11:00",
      }),
    ).rejects.toThrow(AVVIST);
    expect(findFirstByggeplass).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BYGGEPLASS_B, projectId: PROSJEKT_A } }),
    );
    expect(timerUpdate).not.toHaveBeenCalled();
  });

  it("🔴 maskin.tilfoy: BAD_REQUEST, ingen rad opprettes", async () => {
    const { ctx, maskinCreate } = lagCtx();
    await expect(
      caller(ctx).maskin.tilfoy({
        sheetId: SHEET, projectId: PROSJEKT_A, byggeplassId: BYGGEPLASS_B,
        vehicleId: UTSTYR, timer: 2,
      }),
    ).rejects.toThrow(AVVIST);
    expect(maskinCreate).not.toHaveBeenCalled();
  });

  it("🔴 maskin.oppdater: valideres mot radens prosjekt, ingen oppdatering", async () => {
    const { ctx, maskinUpdate } = lagCtx();
    await expect(
      caller(ctx).maskin.oppdater({ id: RAD, byggeplassId: BYGGEPLASS_B }),
    ).rejects.toThrow(AVVIST);
    expect(maskinUpdate).not.toHaveBeenCalled();
  });
});

describe("krevByggeplassIProsjekt", () => {
  it("null/utelatt er gyldig og slår ikke opp (A.30: byggeplass-NULL er lovlig)", async () => {
    await expect(krevByggeplassIProsjekt(null, PROSJEKT_A)).resolves.toBeUndefined();
    await expect(krevByggeplassIProsjekt(undefined, PROSJEKT_A)).resolves.toBeUndefined();
    expect(findFirstByggeplass).not.toHaveBeenCalled();
  });

  it("byggeplass under radens prosjekt passerer", async () => {
    findFirstByggeplass.mockResolvedValue({ id: BYGGEPLASS_B });
    await expect(krevByggeplassIProsjekt(BYGGEPLASS_B, PROSJEKT_A)).resolves.toBeUndefined();
  });
});
