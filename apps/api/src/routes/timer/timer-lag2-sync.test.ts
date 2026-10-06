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

vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn().mockResolvedValue(undefined),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  hentBrukersOrg: vi.fn(),
  // Literal (ikke ORG-const) — vi.mock hoistes over const-deklarasjonene (TDZ).
  krevBrukersOrg: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
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
}));
vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationSetting: { findUnique: kjerne.settingFindUnique },
    organizationReiseGrense: { findMany: kjerne.grenseFindMany },
    reisetidMatrise: { findMany: kjerne.matriseFindMany },
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
    sheetMachine: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
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
