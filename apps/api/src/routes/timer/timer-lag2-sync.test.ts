import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * LAG 2 (C1/C2 + presisering 2) — syncBatch tar imot og LAGRER reise-sporet.
 *
 * Drives via dagsseddelRouter.createCaller med mocket ctx (ingen ekte DB) — samme
 * mønster som timer-km-tak.test.ts. `@sitedoc/db` mockes fordi reise-utledningen
 * (hentErReiseKontekst) + matrise-oppslaget leser den modul-nivå `prisma`-en.
 *
 * Gate-tester (rød først):
 *  (a) et reise-felt sendt via syncBatch havner i createMany-dataen. Rød først:
 *      før C1 stripte Zod feltene (M6) → de nådde aldri skrivingen.
 *  (d) en reise-lønnsart-rad synket UTEN erReise (gammel klient) får erReise=true
 *      UTLEDET (presisering 2) → ekskluderes fra overtid (C4). Rød først: uten
 *      utledning stod den default false og ble talt som arbeid i overtiden.
 *  C2: en eksplisitt reise-rad som bryter en invariant avviser SEDELEN med navngitt
 *      feil, mens en gyldig sedel i samme batch går gjennom.
 */

const ORG = "11111111-1111-1111-1111-111111111111";
const USER = "user-1";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const REISE_LONNSART = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORDINAER_LONNSART = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const KONTOR = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const ANNET_PROSJEKT = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const BYGGEPLASS_EGEN = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"; // under PROSJEKT
const BYGGEPLASS_FREMMED = "ffffffff-ffff-ffff-ffff-ffffffffffff"; // under ANNET_PROSJEKT

vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn().mockResolvedValue(undefined),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  hentBrukersOrg: vi.fn(),
  // Literal (ikke ORG-const) — vi.mock hoistes over const-deklarasjonene (TDZ).
  krevBrukersOrg: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
  resolverOrgForEgenTimeføring: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
  verifiserAnsattIFirma: vi.fn().mockResolvedValue(undefined),
  resolverOrgFraInput: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
}));
// Ordre (13) M2: maskin-rader i syncBatch verifiserer vehicleId mot firmaets register.
vi.mock("@sitedoc/db-maskin", () => ({
  prismaMaskin: { equipment: { findFirst: vi.fn().mockResolvedValue({ id: "utstyr" }) } },
}));
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn().mockResolvedValue(undefined),
  hentEffektivArbeidstid: vi.fn().mockResolvedValue({ startTid: "07:00", sluttTid: "15:00", pauseMin: 30, dagsnorm: 7.5, normKilde: "fast", pauseEtterTimer: 4, pauseReferanse: "ankomst" }),
}));

// Modul-nivå prisma (kjernen) — reise-utledning + matrise-oppslag. vi.hoisted så
// mock-funksjonene finnes når factoryen evalueres (unngår TDZ på modul-consts).
const kjerne = vi.hoisted(() => ({
  settingFindUnique: vi.fn(),
  grenseFindMany: vi.fn(),
  matriseFindMany: vi.fn(),
  byggeplassFindMany: vi.fn(),
}));
vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationSetting: { findUnique: kjerne.settingFindUnique },
    organizationReiseGrense: { findMany: kjerne.grenseFindMany },
    reisetidMatrise: { findMany: kjerne.matriseFindMany },
    byggeplass: { findMany: kjerne.byggeplassFindMany },
  },
}));

import { dagsseddelRouter } from "./dagsseddel";

/** Fanger createMany-dataen fra siste syncBatch-skriving. */
let sisteCreateMany: Record<string, unknown>[] = [];

function lagCtx() {
  const alleLonnsarter = [
    { id: REISE_LONNSART, navn: "Reise til prosjekt", satsEnhet: null },
    { id: ORDINAER_LONNSART, navn: "Timelønn", satsEnhet: null },
  ];
  const txMock = {
    dailySheet: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "sedel-1",
        status: "draft",
        lederKommentar: null,
        attestertVed: null,
        updatedAt: new Date("2026-10-03T10:00:00Z"),
      }),
      // V20/PK6: synkroniserHodePause oppdaterer hodet.
      update: vi.fn().mockResolvedValue({}),
    },
    sheetTimer: {
      // V20/PK6: hodet utledes via aggregate(_sum pauseMin).
      aggregate: vi.fn().mockResolvedValue({ _sum: { pauseMin: 0 } }),
      // V19.9: ny sedel → ingen serverrader (findMany før skriving = []). Read-back
      // etter createMany (V19.9.8) returnerer de skrevne radenes versjoner.
      findMany: vi.fn(async () =>
        sisteCreateMany.map((r) => ({
          id: r.id as string,
          updatedAt: new Date("2026-10-03T10:00:00Z"),
        })),
      ),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn((args: { data: Record<string, unknown>[] }) => {
        sisteCreateMany = args.data;
        return Promise.resolve({ count: args.data.length });
      }),
    },
    sheetTillegg: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sheetMachine: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    sheetUtlegg: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {
      oppmotested: { findMany: vi.fn().mockResolvedValue([{ id: KONTOR }]) },
    },
    prismaTimer: {
      dailySheet: { findUnique: vi.fn().mockResolvedValue(null) },
      aktivitet: {
        findFirst: vi.fn().mockResolvedValue({ id: AKTIVITET }),
        findMany: vi.fn().mockResolvedValue([{ id: AKTIVITET }]),
      },
      lonnsart: {
        findMany: vi.fn((args?: { where?: { id?: { in?: string[] } } }) => {
          const ids = args?.where?.id?.in;
          return Promise.resolve(
            ids ? alleLonnsarter.filter((l) => ids.includes(l.id)) : alleLonnsarter,
          );
        }),
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
  return { ctx, txMock };
}

/** Grunn-sedel med én timer-rad; rad-feltene + clientUuid overstyres pr. test. */
function sedelMed(
  rad: Record<string, unknown>,
  clientUuid = "77777777-7777-7777-7777-777777777777",
) {
  return {
    clientUuid,
    projectId: PROSJEKT,
    aktivitetId: AKTIVITET,
    byggeplassId: null,
    dato: "2026-09-20",
    status: "draft" as const,
    timer: [
      {
        id: "88888888-8888-8888-8888-888888888888",
        lonnsartId: ORDINAER_LONNSART,
        aktivitetId: AKTIVITET,
        timer: 7.5,
        ...rad,
      },
    ],
    tillegg: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sisteCreateMany = [];
  kjerne.settingFindUnique.mockResolvedValue({ reiseLonnsartId: REISE_LONNSART });
  kjerne.grenseFindMany.mockResolvedValue([]);
  kjerne.matriseFindMany.mockResolvedValue([]);
  kjerne.byggeplassFindMany.mockResolvedValue([
    { id: BYGGEPLASS_EGEN, projectId: PROSJEKT },
    { id: BYGGEPLASS_FREMMED, projectId: ANNET_PROSJEKT },
  ]);
});

describe("syncBatch — lagrer reise-sporet (C1) + utleder flagget (presisering 2)", () => {
  it("🔴 (a) eksplisitt reise-felt (manuell) persisteres i createMany", async () => {
    const { ctx } = lagCtx();
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [
        sedelMed({
          lonnsartId: REISE_LONNSART,
          erReise: true,
          reiseRetning: "ut",
          reiseKilde: "manuell",
          tidKilde: "manuell",
        }),
      ],
    });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(sisteCreateMany).toHaveLength(1);
    const skrevet = sisteCreateMany[0]!;
    expect(skrevet.erReise).toBe(true);
    expect(skrevet.reiseRetning).toBe("ut");
    expect(skrevet.reiseKilde).toBe("manuell");
    expect(skrevet.tidKilde).toBe("manuell");
  });

  it("🔴 (d) reise-lønnsart UTEN erReise (gammel klient) → erReise UTLEDES true", async () => {
    const { ctx } = lagCtx();
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      // Ingen erReise/reise-felt sendt — speiler en pre-lag-2 app.
      sedler: [sedelMed({ lonnsartId: REISE_LONNSART })],
    });
    expect(res.resultater[0]!.resultat).toBe("ok");
    const skrevet = sisteCreateMany[0]!;
    expect(skrevet.erReise).toBe(true); // utledet fra konfigurert reise-art
    expect(skrevet.reiseKilde).toBeNull(); // vi utledet, arbeideren klassifiserte ikke
  });

  it("ordinær lønnsart uten erReise → erReise false (ikke reise)", async () => {
    const { ctx } = lagCtx();
    const caller = dagsseddelRouter.createCaller(ctx);
    await caller.syncBatch({ sedler: [sedelMed({ lonnsartId: ORDINAER_LONNSART })] });
    expect(sisteCreateMany[0]!.erReise).toBe(false);
  });

  it("C2: eksplisitt reise-rad uten kilde → SEDELEN avvises med navngitt feil", async () => {
    const { ctx } = lagCtx();
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [
        sedelMed({
          lonnsartId: REISE_LONNSART,
          erReise: true,
          reiseRetning: "ut",
          // reiseKilde mangler → C2-brudd
        }),
      ],
    });
    expect(res.resultater[0]!.resultat).toBe("avvist");
    expect(res.resultater[0]!.feilmelding).toMatch(/kilde/i);
  });

  it("C2: brudd avviser KUN raden/sedelen — resten av batchen går gjennom", async () => {
    const { ctx } = lagCtx();
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [
        // Ugyldig: eksplisitt reise uten kilde.
        sedelMed(
          { lonnsartId: REISE_LONNSART, erReise: true, reiseRetning: "ut" },
          "aaaaaaa1-0000-0000-0000-000000000001",
        ),
        // Gyldig: ordinær rad.
        sedelMed({ lonnsartId: ORDINAER_LONNSART }, "aaaaaaa2-0000-0000-0000-000000000002"),
      ],
    });
    const ugyldig = res.resultater.find(
      (r) => r.clientUuid === "aaaaaaa1-0000-0000-0000-000000000001",
    )!;
    const gyldig = res.resultater.find(
      (r) => r.clientUuid === "aaaaaaa2-0000-0000-0000-000000000002",
    )!;
    expect(ugyldig.resultat).toBe("avvist");
    expect(gyldig.resultat).toBe("ok");
  });
});

/**
 * Ordre (12): syncBatch avviser IKKE en rad med byggeplass fra et annet prosjekt — en
 * avvist sedel ville ligge i mobilens offline-kø for alltid. Raden lagres med
 * byggeplass null (prosjektet beholdes) og serveren logger. Rød først: før ordren ble
 * byggeplassen lagret ukontrollert.
 */
describe("syncBatch — byggeplass utenfor radens prosjekt (ordre 12)", () => {
  it("🔴 (b) fremmed byggeplass på raden → batchen fullfører, raden lagres med byggeplass null", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ctx } = lagCtx();
    const res = await dagsseddelRouter.createCaller(ctx).syncBatch({
      sedler: [sedelMed({ projectId: PROSJEKT, byggeplassId: BYGGEPLASS_FREMMED })],
    });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(sisteCreateMany).toHaveLength(1);
    expect(sisteCreateMany[0]!.byggeplassId).toBeNull();
    expect(sisteCreateMany[0]!.projectId).toBe(PROSJEKT);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("timer_byggeplass_grense"));
    warn.mockRestore();
  });

  it("🔴 fremmed byggeplass på sedelhodet arves ikke av raden; hodet lagres med null", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ctx, txMock } = lagCtx();
    const sedel = { ...sedelMed({ projectId: PROSJEKT }), byggeplassId: BYGGEPLASS_FREMMED };
    const res = await dagsseddelRouter.createCaller(ctx).syncBatch({ sedler: [sedel] });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(sisteCreateMany[0]!.byggeplassId).toBeNull();
    expect(txMock.dailySheet.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ byggeplassId: null }) }),
    );
    warn.mockRestore();
  });

  it("🔴 M1: gyldig byggeplass på hodet, fremmed på raden → raden lagres med null, arver IKKE hodets", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ctx, txMock } = lagCtx();
    const sedel = {
      ...sedelMed({ projectId: PROSJEKT, byggeplassId: BYGGEPLASS_FREMMED }),
      byggeplassId: BYGGEPLASS_EGEN,
    };
    const res = await dagsseddelRouter.createCaller(ctx).syncBatch({ sedler: [sedel] });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(sisteCreateMany[0]!.byggeplassId).toBeNull();
    expect(sisteCreateMany[0]!.projectId).toBe(PROSJEKT);
    // Hodet er gyldig og står.
    expect(txMock.dailySheet.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ byggeplassId: BYGGEPLASS_EGEN }) }),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("timer_byggeplass_grense"));
    warn.mockRestore();
  });

  it("🔴 M2: maskin-rad under prosjektet arver fremmed byggeplass fra hodet → lagres med null og logges", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ctx, txMock } = lagCtx();
    const sedel = {
      // Timer-raden har egen gyldig byggeplass, så vaskingen som treffer er hodets og maskinens.
      ...sedelMed({ projectId: PROSJEKT, byggeplassId: BYGGEPLASS_EGEN }),
      byggeplassId: BYGGEPLASS_FREMMED,
      maskiner: [
        {
          id: "99999999-9999-9999-9999-999999999999",
          projectId: PROSJEKT,
          vehicleId: "12121212-1212-1212-1212-121212121212",
          timer: 2,
        },
      ],
    };
    const res = await dagsseddelRouter.createCaller(ctx).syncBatch({ sedler: [sedel] });
    expect(res.resultater[0]!.resultat).toBe("ok");
    const maskinData = (txMock.sheetMachine.createMany as ReturnType<typeof vi.fn>).mock.calls[0]![0].data;
    expect(maskinData).toHaveLength(1);
    expect(maskinData[0].byggeplassId).toBeNull();
    expect(maskinData[0].projectId).toBe(PROSJEKT);
    expect(sisteCreateMany[0]!.byggeplassId).toBe(BYGGEPLASS_EGEN);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[timer_byggeplass_grense]"));
    warn.mockRestore();
  });

  it("byggeplass under radens prosjekt beholdes (også arvet fra sedelen)", async () => {
    const { ctx, txMock } = lagCtx();
    const sedel = { ...sedelMed({ projectId: PROSJEKT }), byggeplassId: BYGGEPLASS_EGEN };
    const res = await dagsseddelRouter.createCaller(ctx).syncBatch({ sedler: [sedel] });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(sisteCreateMany[0]!.byggeplassId).toBe(BYGGEPLASS_EGEN);
    expect(txMock.dailySheet.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ byggeplassId: BYGGEPLASS_EGEN }) }),
    );
  });
});

/**
 * ORDRE 36b: maskin-raden bærer egen byggeplass (kortets) i syncBatch-pushen.
 * Feltet er optional — eldre klienter uten feltet beholder sedel-arven.
 */
describe("syncBatch — maskin bærer egen byggeplass (ORDRE 36b)", () => {
  const MASKIN = "99999999-9999-9999-9999-999999999999";
  const TIMER_RAD = "88888888-8888-8888-8888-888888888888";
  const BYGGEPLASS_EGEN_2 = "12345678-1234-1234-1234-123456789abc"; // også under PROSJEKT

  function maskinRad(ekstra: Record<string, unknown>) {
    return {
      id: MASKIN,
      projectId: PROSJEKT,
      vehicleId: "12121212-1212-1212-1212-121212121212",
      timer: 2,
      ...ekstra,
    };
  }

  async function pushOgHentMaskin(sedel: Record<string, unknown>) {
    const { ctx, txMock } = lagCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await dagsseddelRouter.createCaller(ctx).syncBatch({ sedler: [sedel as any] });
    expect(res.resultater[0]!.resultat).toBe("ok");
    const data = (txMock.sheetMachine.createMany as ReturnType<typeof vi.fn>).mock.calls[0]![0].data;
    expect(data).toHaveLength(1);
    return data[0] as Record<string, unknown>;
  }

  beforeEach(() => {
    kjerne.byggeplassFindMany.mockResolvedValue([
      { id: BYGGEPLASS_EGEN, projectId: PROSJEKT },
      { id: BYGGEPLASS_EGEN_2, projectId: PROSJEKT },
      { id: BYGGEPLASS_FREMMED, projectId: ANNET_PROSJEKT },
    ]);
  });

  it("🔴 (a) byggeplassId i eget prosjekt lagres på maskinen — ikke sedelens", async () => {
    const m = await pushOgHentMaskin({
      ...sedelMed({ projectId: PROSJEKT }),
      byggeplassId: BYGGEPLASS_EGEN,
      maskiner: [maskinRad({ byggeplassId: BYGGEPLASS_EGEN_2 })],
    });
    expect(m.byggeplassId).toBe(BYGGEPLASS_EGEN_2);
  });

  it("🔴 (b) byggeplassId fra et annet prosjekt → null (prosjektet beholdes)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = await pushOgHentMaskin({
      ...sedelMed({ projectId: PROSJEKT }),
      byggeplassId: BYGGEPLASS_EGEN,
      maskiner: [maskinRad({ byggeplassId: BYGGEPLASS_FREMMED })],
    });
    expect(m.byggeplassId).toBeNull();
    expect(m.projectId).toBe(PROSJEKT);
    warn.mockRestore();
  });

  it("🔴 RETUR 4: eksplisitt null = arv — maskinen får sedelens byggeplass (som timer-radene)", async () => {
    // Mobil (timerSync) sender null når raden står på sedelens byggeplass.
    // Mot 2c0fab3e ble den lagret som null og forsvant fra byggeplassen.
    const m = await pushOgHentMaskin({
      ...sedelMed({ projectId: PROSJEKT }),
      byggeplassId: BYGGEPLASS_EGEN,
      maskiner: [maskinRad({ byggeplassId: null })],
    });
    expect(m.byggeplassId).toBe(BYGGEPLASS_EGEN);
  });

  it("RETUR 4 negativkontroll: null + sedel-byggeplass fra et annet prosjekt → null", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = await pushOgHentMaskin({
      ...sedelMed({ projectId: PROSJEKT }),
      byggeplassId: BYGGEPLASS_FREMMED,
      maskiner: [maskinRad({ byggeplassId: null })],
    });
    expect(m.byggeplassId).toBeNull();
    expect(m.projectId).toBe(PROSJEKT);
    warn.mockRestore();
  });

  it("(c) uten feltet (eldre klient) → sedelens byggeplass som før", async () => {
    const m = await pushOgHentMaskin({
      ...sedelMed({ projectId: PROSJEKT }),
      byggeplassId: BYGGEPLASS_EGEN,
      maskiner: [maskinRad({})],
    });
    expect(m.byggeplassId).toBe(BYGGEPLASS_EGEN);
  });

  it("🔴 (d) stille tomhet: maskin med samme kort (sheetTimerId + byggeplass) som timer-raden ender på timer-radens byggeplass X", async () => {
    const { ctx, txMock } = lagCtx();
    const sedel = {
      // Sedelhodet har en ANNEN byggeplass enn kortet — før 36b arvet maskinen den.
      ...sedelMed({ id: TIMER_RAD, projectId: PROSJEKT, byggeplassId: BYGGEPLASS_EGEN_2 }),
      byggeplassId: BYGGEPLASS_EGEN,
      maskiner: [maskinRad({ sheetTimerId: TIMER_RAD, byggeplassId: BYGGEPLASS_EGEN_2 })],
    };
    const res = await dagsseddelRouter.createCaller(ctx).syncBatch({ sedler: [sedel] });
    expect(res.resultater[0]!.resultat).toBe("ok");
    const maskin = (txMock.sheetMachine.createMany as ReturnType<typeof vi.fn>).mock.calls[0]![0].data[0];
    const timerRad = sisteCreateMany.find((r) => r.id === TIMER_RAD)!;
    expect(timerRad.byggeplassId).toBe(BYGGEPLASS_EGEN_2);
    // Ikke-tom og lik timer-radens — maskinen havner på samme kort.
    expect(maskin.byggeplassId).toBeTruthy();
    expect(maskin.byggeplassId).toBe(timerRad.byggeplassId);
    expect(maskin.sheetTimerId).toBe(TIMER_RAD);
  });
});
