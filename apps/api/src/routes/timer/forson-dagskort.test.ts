import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * U-BEKREFT steg 2 — `forsonDagskort` anvender arbeiderens radvalg ATOMISK på det
 * redigerbare web-dagskortet. Testene dekker gate-kriteriene som MÅ kunne feile uten
 * fiksen (rød først): modus C avvises i SERVEREN, in-place-erstatning (ingen duplikat),
 * og at alle writes går i ÉN $transaction (atomisitet).
 *
 * Drives via dagsseddelRouter.createCaller med mocket ctx (ingen ekte DB) — samme
 * mønster som expenseCategory.test.ts. Firma-grense-helperne og Timer-taket mockes;
 * overlapp/maskin-reglene er @sitedoc/shared (ekte, ikke mocket).
 */

vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn().mockResolvedValue(undefined),
  autoriserAdminForFirma: vi.fn(),
  verifiserProsjektmedlem: vi.fn(),
  hentBrukersOrg: vi.fn(),
  krevBrukersOrg: vi.fn(),
}));
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn().mockResolvedValue(undefined),
  hentEffektivArbeidstid: vi.fn(),
}));
// LAG 2: forsonDagskort utleder nå erReise via kjerne-prisma (hentErReiseKontekst).
// Mock den så testene ikke treffer ekte DB.
vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationSetting: { findUnique: vi.fn().mockResolvedValue({ reiseLonnsartId: null }) },
    organizationReiseGrense: { findMany: vi.fn().mockResolvedValue([]) },
    reisetidMatrise: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { dagsseddelRouter } from "./dagsseddel";
import { krevTimerAktivert } from "../../services/timer";

const USER = "user-1";
const ORG = "11111111-1111-1111-1111-111111111111";
const SHEET = "22222222-2222-2222-2222-222222222222";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const LONNSART = "44444444-4444-4444-4444-444444444444";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const RAD1 = "66666666-6666-6666-6666-666666666666";

type MockRad = {
  id: string;
  sheetId: string;
  projectId: string;
  externalCostObjectId: string | null;
  timer: number;
  fraTid: string | null;
  tilTid: string | null;
};

function lagCtx(opts: {
  status: string;
  eksisterende?: MockRad[];
  // Antall rader den status-betingede updateMany INNE i tx treffer. 0 = sedelen ble
  // attestert i vinduet mellom validering og skriving (TOCTOU) → forsoningen skal avvises.
  touchCount?: number;
}) {
  const eksisterende = opts.eksisterende ?? [];
  const sheet = {
    id: SHEET,
    clientUuid: SHEET,
    userId: USER,
    organizationId: ORG,
    status: opts.status,
    pauseMin: 0,
    dato: new Date("2026-09-20T00:00:00Z"),
  };
  // Writes skjer på `tx`-klienten den interaktive $transaction gir — ikke på ctx.prismaTimer.
  const update = vi.fn().mockResolvedValue({ id: RAD1 });
  const create = vi.fn().mockResolvedValue({ id: "ny-rad" });
  const updateMany = vi.fn().mockResolvedValue({ count: opts.touchCount ?? 1 });
  const txFindMany = vi.fn().mockResolvedValue(eksisterende);
  // V19 (A-5): forsonDagskort sletter nå forslaget + nuller konfliktVentendeSiden i tx.
  const forslagDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const tx = {
    dailySheet: { updateMany },
    sheetTimer: { update, create, findMany: txFindMany },
    sheetTimerForslag: { deleteMany: forslagDeleteMany },
  };
  // Interaktiv form: $transaction(fn) kjører callbacken med tx-klienten og returnerer
  // resultatet. Kaster callbacken, propagerer feilen (ruller «tilbake» — her: ingen commit).
  const transaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  const ctx = {
    userId: USER,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {},
    prismaTimer: {
      dailySheet: {
        findUnique: vi.fn().mockResolvedValue(sheet),
        update: vi.fn().mockResolvedValue(sheet),
      },
      lonnsart: { findMany: vi.fn().mockResolvedValue([{ id: LONNSART }]) },
      aktivitet: { findMany: vi.fn().mockResolvedValue([{ id: AKTIVITET }]) },
      sheetTimer: {
        findMany: vi.fn().mockResolvedValue(eksisterende),
        update,
        create,
      },
      sheetMachine: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: transaction,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, update, create, updateMany, transaction, forslagDeleteMany };
}

const rad = (o: Partial<MockRad> & { id: string }): MockRad => ({
  sheetId: SHEET,
  projectId: PROSJEKT,
  externalCostObjectId: null,
  timer: 7.5,
  fraTid: "07:00",
  tilTid: "15:00",
  ...o,
});

const oppdatering = {
  id: RAD1,
  projectId: PROSJEKT,
  lonnsartId: LONNSART,
  aktivitetId: AKTIVITET,
  timer: 8,
  fraTid: "07:00",
  tilTid: "15:00",
};
const nyRad = {
  projectId: PROSJEKT,
  lonnsartId: LONNSART,
  aktivitetId: AKTIVITET,
  timer: 2,
  fraTid: "15:00",
  tilTid: "17:00",
};

beforeEach(() => vi.clearAllMocks());

describe("forsonDagskort — 🔴 modus C avvises i SERVEREN (gate 2), rød først", () => {
  for (const status of ["sent", "accepted"]) {
    it(`status=${status} → PRECONDITION_FAILED, INGEN write, INGEN $transaction`, async () => {
      const { ctx, update, create, transaction } = lagCtx({ status });
      const caller = dagsseddelRouter.createCaller(ctx);
      await expect(
        caller.forsonDagskort({ sheetId: SHEET, oppdateringer: [oppdatering], nyeRader: [] }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      // Uten erRedigerbar-gaten i mutasjonen ville skrivingen gått videre.
      expect(update).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });
  }
});

describe("forsonDagskort — 🔴 in-place, ingen duplikat (gate 3)", () => {
  it("valgt-lokal på eksisterende rad → sheetTimer.update({ where: { id } }), create ALDRI", async () => {
    const { ctx, update, create } = lagCtx({
      status: "returned",
      eksisterende: [rad({ id: RAD1 })],
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    await caller.forsonDagskort({ sheetId: SHEET, oppdateringer: [oppdatering], nyeRader: [] });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]![0].where).toEqual({ id: RAD1 });
    expect(create).not.toHaveBeenCalled();
  });

  it("🔴 oppdatering mot ukjent rad-id → BAD_REQUEST, INGEN $transaction (ingen rad oppå en annen)", async () => {
    const { ctx, transaction } = lagCtx({
      status: "returned",
      eksisterende: [rad({ id: RAD1 })],
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    await expect(
      caller.forsonDagskort({
        sheetId: SHEET,
        oppdateringer: [{ ...oppdatering, id: "77777777-7777-7777-7777-777777777777" }],
        nyeRader: [],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("lokal-only beholdt → create, og Timer-taket kreves for ny rad", async () => {
    const { ctx, create } = lagCtx({
      status: "returned",
      eksisterende: [rad({ id: RAD1 })],
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    await caller.forsonDagskort({ sheetId: SHEET, oppdateringer: [], nyeRader: [nyRad] });
    expect(create).toHaveBeenCalledTimes(1);
    expect(krevTimerAktivert).toHaveBeenCalledWith(ORG);
  });
});

describe("forsonDagskort — 🔴 atomisitet (gate 1): alle writes i ÉN $transaction", () => {
  it("oppdatering + ny rad → ett interaktivt $transaction-kall, writes + guard-touch på tx", async () => {
    const { ctx, transaction, update, create, updateMany } = lagCtx({
      status: "returned",
      eksisterende: [rad({ id: RAD1 })],
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    await caller.forsonDagskort({ sheetId: SHEET, oppdateringer: [oppdatering], nyeRader: [nyRad] });
    // Rød først: en ikke-transaksjonell sekvens ville awaitet hver write for seg og aldri
    // kalt $transaction. Her: nøyaktig ETT interaktivt kall (callback-form), og writene +
    // status-guard-touchen kjører alle inne i den transaksjonen.
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(typeof transaction.mock.calls[0]![0]).toBe("function");
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("V19 (A-5): alt valgt-server (tomme valg) → ÉN $transaction som sletter forslaget + nuller feltet, ingen rad-write", async () => {
    // Endret fra «ingen $transaction»: «behold PC for hele dagen» er et GYLDIG valg
    // som fullfører forsoningen — forslaget må slettes og konfliktVentendeSiden nulles
    // (ellers står invarianten brutt + attestering blokkert). Rør ikke radene.
    const { ctx, transaction, update, create, updateMany, forslagDeleteMany } = lagCtx({
      status: "returned",
      eksisterende: [rad({ id: RAD1 })],
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.forsonDagskort({ sheetId: SHEET, oppdateringer: [], nyeRader: [] });
    expect(transaction).toHaveBeenCalledTimes(1);
    // Status-betinget updateMany nuller konfliktVentendeSiden; forslaget slettes.
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0]![0].data).toMatchObject({ konfliktVentendeSiden: null });
    expect(forslagDeleteMany).toHaveBeenCalledWith({ where: { sheetId: SHEET } });
    // Ingen rad-endring.
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(res).toHaveLength(1);
  });
});

describe("forsonDagskort — 🔴 TOCTOU: attestert i vinduet mellom validering og skriving (TILLEGG 3)", () => {
  it("sedel blir accepted ETTER validering → status-guard treffer 0 rader → avvises, INGEN rad-write", async () => {
    // hentEgenDagsseddel ser fortsatt "returned" (passerer ytre gate), men den status-betingede
    // updateMany inne i tx treffer 0 rader = sedelen ble attestert i vinduet. Rød først: med
    // array-$transaction fantes ingen slik guard — skrivingen ville landet på det låste kortet.
    const { ctx, update, create } = lagCtx({
      status: "returned",
      eksisterende: [rad({ id: RAD1 })],
      touchCount: 0,
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    await expect(
      caller.forsonDagskort({ sheetId: SHEET, oppdateringer: [oppdatering], nyeRader: [nyRad] }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    // Kortet er UENDRET: ingen rad ble skrevet (tx rulles tilbake ved kast).
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("regresjon: normal forsoning på returned (guard treffer raden) skriver som før", async () => {
    const { ctx, update, create, updateMany } = lagCtx({
      status: "returned",
      eksisterende: [rad({ id: RAD1 })],
      touchCount: 1,
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    await caller.forsonDagskort({ sheetId: SHEET, oppdateringer: [oppdatering], nyeRader: [nyRad] });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
