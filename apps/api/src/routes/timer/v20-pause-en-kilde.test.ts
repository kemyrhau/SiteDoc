import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * V20 — én kilde for pause (spec timer-pause-en-kilde-spec.md § 3/§ 5, GATET rev. 2).
 *
 * Del 1: enhetstest av PK4-kjernen `vurderRadTimer` (beslutningsmatrisen) — dekker
 * spec-test 3 (interaktiv avvis), 13 (synk skjult fradrag → bærer), 14 (per_km/reise
 * vurderes ikke), 16 (stemmer med ingen → telt), 17 (to bærere → kun-én).
 *
 * Del 2: integrasjonstest av `syncBatch` — Kenneths rad (07:00–16:00, 8,50, pauseMin=0)
 * synket → normaliseres til bærer (pauseMin=30), `timer` urørt, svar `ok`
 * (gate-kriterium 2). ALDRI avvist (eldre app må kunne synke).
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
  hentEffektivArbeidstid: vi.fn().mockResolvedValue({
    startTid: "07:00",
    sluttTid: "15:00",
    pauseMin: 30,
    dagsnorm: 7.5,
    normKilde: "fast",
    pauseEtterTimer: 4,
    pauseReferanse: "ankomst",
  }),
}));
vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationSetting: { findUnique: vi.fn().mockResolvedValue({ reiseLonnsartId: null }) },
    organizationReiseGrense: { findMany: vi.fn().mockResolvedValue([]) },
    reisetidMatrise: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { dagsseddelRouter, vurderRadTimer } from "./dagsseddel";

// Felles pausevindu i matrisen: 11:00–11:30 (07:00 start + 4 t, std 30 min).
const VINDU = "11:00";
const STD = 30;

describe("V20/PK4 — vurderRadTimer (beslutningsmatrise)", () => {
  it("test 13: synk, skjult fradrag (07:00–16:00, 8,50, pause 0) → bærer 30, timer urørt", () => {
    const v = vurderRadTimer({
      modus: "sync",
      satsEnhet: null,
      fraTid: "07:00",
      tilTid: "16:00",
      timer: 8.5,
      pauseMinAngitt: 0,
      pauseVindu: VINDU,
      standardPauseMin: STD,
      finnesAlleredeBaerer: false,
    });
    expect(v).toEqual({ pauseMin: 30, teller: "baerer", kast: false });
  });

  it("synk: oppgitt pause konsistent (07–15, 7,50, pause 30) → behold 30", () => {
    const v = vurderRadTimer({
      modus: "sync",
      satsEnhet: "per_time",
      fraTid: "07:00",
      tilTid: "15:00",
      timer: 7.5,
      pauseMinAngitt: 30,
      pauseVindu: VINDU,
      standardPauseMin: STD,
      finnesAlleredeBaerer: false,
    });
    expect(v).toEqual({ pauseMin: 30, teller: null, kast: false });
  });

  it("synk: ingen pause, ingen fradrag (07–11, 4,00) → pause 0", () => {
    const v = vurderRadTimer({
      modus: "sync",
      satsEnhet: null,
      fraTid: "07:00",
      tilTid: "11:00",
      timer: 4,
      pauseMinAngitt: 0,
      pauseVindu: VINDU,
      standardPauseMin: STD,
      finnesAlleredeBaerer: false,
    });
    expect(v).toEqual({ pauseMin: 0, teller: null, kast: false });
  });

  it("test 14: per_km-rad (timer=60) vurderes IKKE mot spennet → pause 0, ingen teller", () => {
    const v = vurderRadTimer({
      modus: "sync",
      satsEnhet: "per_km",
      fraTid: "07:00",
      tilTid: "15:00",
      timer: 60,
      pauseMinAngitt: 0,
      pauseVindu: VINDU,
      standardPauseMin: STD,
      finnesAlleredeBaerer: false,
    });
    expect(v).toEqual({ pauseMin: 0, teller: null, kast: false });
  });

  it("test 14b: reiserad (vindu = kjøretid, timer = fullt spenn, pause 0) → stemmer, ingen normalisering", () => {
    // Reise 05:00–06:00, timer 1,00 = fullt spenn (ingen pause). Krysser ikke 11:00-vinduet.
    const v = vurderRadTimer({
      modus: "sync",
      satsEnhet: null,
      fraTid: "05:00",
      tilTid: "06:00",
      timer: 1,
      pauseMinAngitt: 0,
      pauseVindu: VINDU,
      standardPauseMin: STD,
      finnesAlleredeBaerer: false,
    });
    expect(v).toEqual({ pauseMin: 0, teller: null, kast: false });
  });

  it("test 16: synk, stemmer med ingen (07–11, 3,50) → skrevet uendret, telt avvik", () => {
    const v = vurderRadTimer({
      modus: "sync",
      satsEnhet: null,
      fraTid: "07:00",
      tilTid: "11:00",
      timer: 3.5,
      pauseMinAngitt: 0,
      pauseVindu: VINDU,
      standardPauseMin: STD,
      finnesAlleredeBaerer: false,
    });
    expect(v).toEqual({ pauseMin: 0, teller: "avvik", kast: false });
  });

  it("test 17: synk, skjult fradrag MEN en annen rad bærer alt → skriv uendret (0), telt", () => {
    const v = vurderRadTimer({
      modus: "sync",
      satsEnhet: null,
      fraTid: "07:00",
      tilTid: "16:00",
      timer: 8.5,
      pauseMinAngitt: 0,
      pauseVindu: VINDU,
      standardPauseMin: STD,
      finnesAlleredeBaerer: true,
    });
    expect(v).toEqual({ pauseMin: 0, teller: "to_baerere", kast: false });
  });

  it("test 3/15: interaktiv ny klient, oppgitt pause 30 men timer=8,00 (inkonsistent) → KAST", () => {
    const v = vurderRadTimer({
      modus: "interaktiv",
      satsEnhet: "per_time",
      fraTid: "07:00",
      tilTid: "15:00",
      timer: 8,
      pauseMinAngitt: 30,
      pauseVindu: VINDU,
      standardPauseMin: STD,
      finnesAlleredeBaerer: false,
    });
    expect(v.kast).toBe(true);
  });

  it("interaktiv ny klient, konsistent (07–15, 7,50, pause 30) → behold, ikke kast", () => {
    const v = vurderRadTimer({
      modus: "interaktiv",
      satsEnhet: "per_time",
      fraTid: "07:00",
      tilTid: "15:00",
      timer: 7.5,
      pauseMinAngitt: 30,
      pauseVindu: VINDU,
      standardPauseMin: STD,
      finnesAlleredeBaerer: false,
    });
    expect(v).toEqual({ pauseMin: 30, teller: null, kast: false });
  });

  it("interaktiv GAMMEL klient (pause ikke oppgitt), skjult fradrag → bærer, ALDRI kast", () => {
    const v = vurderRadTimer({
      modus: "interaktiv",
      satsEnhet: "per_time",
      fraTid: "07:00",
      tilTid: "15:00",
      timer: 7.5,
      pauseMinAngitt: undefined,
      pauseVindu: VINDU,
      standardPauseMin: STD,
      finnesAlleredeBaerer: false,
    });
    expect(v).toEqual({ pauseMin: 30, teller: "baerer", kast: false });
  });
});

// ── Del 2: syncBatch-integrasjon (Kenneths rad) ────────────────────────────
const USER = "user-1";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const LONNSART = "44444444-4444-4444-4444-444444444444";
const RAD = "88888888-8888-8888-8888-888888888888";

let sisteCreateMany: Record<string, unknown>[] = [];
let sisteHodePause: number | null = null;

function lagSyncCtx() {
  const txMock = {
    dailySheet: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "sedel-1",
        status: "draft",
        lederKommentar: null,
        attestertVed: null,
        updatedAt: new Date("2026-10-06T10:00:00Z"),
      }),
      update: vi.fn((args: { data: { pauseMin?: number } }) => {
        if (typeof args.data.pauseMin === "number") sisteHodePause = args.data.pauseMin;
        return Promise.resolve({});
      }),
    },
    sheetTimer: {
      aggregate: vi.fn(async () => ({
        _sum: {
          pauseMin: sisteCreateMany.reduce(
            (s, r) => s + ((r.pauseMin as number) ?? 0),
            0,
          ),
        },
      })),
      findMany: vi.fn(async () =>
        sisteCreateMany.map((r) => ({ id: r.id as string, updatedAt: new Date("2026-10-06T10:00:00Z") })),
      ),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn((args: { data: Record<string, unknown>[] }) => {
        sisteCreateMany = args.data;
        return Promise.resolve({ count: args.data.length });
      }),
    },
    sheetTillegg: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sheetMachine: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sheetUtlegg: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
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
      lonnsart: {
        findMany: vi.fn().mockResolvedValue([{ id: LONNSART, navn: "Timelønn", satsEnhet: null }]),
      },
      tillegg: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn((arg: unknown) =>
        typeof arg === "function"
          ? (arg as (tx: unknown) => Promise<unknown>)(txMock)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx };
}

beforeEach(() => {
  sisteCreateMany = [];
  sisteHodePause = null;
});

describe("V20 syncBatch — Kenneths rad (gate-kriterium 2)", () => {
  it("07:00–16:00, 8,50, pauseMin 0 → skrevet som bærer (30), timer urørt, svar ok, hode = Σ", async () => {
    const { ctx } = lagSyncCtx();
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [
        {
          clientUuid: "77777777-7777-7777-7777-777777777777",
          projectId: PROSJEKT,
          aktivitetId: AKTIVITET,
          byggeplassId: null,
          dato: "2026-10-06",
          status: "draft",
          pauseMin: 30, // payload-hode — skal IGNORERES (hodet utledes)
          timer: [
            {
              id: RAD,
              lonnsartId: LONNSART,
              aktivitetId: AKTIVITET,
              timer: 8.5,
              fraTid: "07:00",
              tilTid: "16:00",
              pauseMin: 0,
            },
          ],
          tillegg: [],
        },
      ],
    });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(sisteCreateMany).toHaveLength(1);
    const skrevet = sisteCreateMany[0]!;
    expect(skrevet.pauseMin).toBe(30); // normalisert til bærer
    expect(skrevet.timer).toBe(8.5); // ALDRI endret
    expect(sisteHodePause).toBe(30); // PK6: hode = Σ rad
  });
});
