import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * V19.9 (versjonssjekk pr. rad — ordre V19.9-A) — syncBatch ende-til-ende.
 * Spec § 9.6 tester 1–7 + 13 (serverdelen). Klassifiseringen rad-for-rad
 * (R1–R12/S1–S4) + presisjon (test 9) ligger i sync-versjon.test.ts; paring/valg
 * (test 8) i @sitedoc/shared forsonValg.test.ts. Her kjøres hele mutasjonen med en
 * TILSTANDSFULL in-memory sheet_timer-mock, så «skrevet / hoppet over / forslag»
 * kan observeres på faktisk tilstand.
 *
 * Rød først (verifisert i engangskopi): uten klassifiseringen skriver syncBatch
 * payload-raden rått over serverraden (Kenneths 5. okt-sak) — test 1 forventer at
 * den PC-endrede 15:30 står og payload-15:00 hoppes over.
 */

const ORG = "11111111-1111-1111-1111-111111111111";
const USER = "user-1";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const LONNSART = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CLIENT_UUID = "77777777-7777-7777-7777-777777777777";
const RAD_A = "88888888-8888-8888-8888-000000000001";
const RAD_NY = "88888888-8888-8888-8888-000000000002";

const V1 = "2026-10-05T08:00:00.000Z"; // versjonen telefonen hentet
const V2 = "2026-10-05T09:30:00.000Z"; // PC skrev etterpå (nyere)
const WRITE_TID = new Date("2026-10-06T12:00:00.000Z");

vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn().mockResolvedValue(undefined),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  verifiserKjoretoyTilhørerFirma: vi.fn().mockResolvedValue(undefined),
  hentBrukersOrg: vi.fn(),
  krevBrukersOrg: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
  resolverOrgFraInput: vi.fn().mockResolvedValue("11111111-1111-1111-1111-111111111111"),
}));
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn().mockResolvedValue(undefined),
  hentEffektivArbeidstid: vi.fn().mockResolvedValue({ startTid: "07:00", sluttTid: "15:00", pauseMin: 30, dagsnorm: 7.5, normKilde: "fast", pauseEtterTimer: 4, pauseReferanse: "ankomst" }),
}));
vi.mock("@sitedoc/db", () => ({
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue({ role: "sitedoc_admin" }) },
    organizationSetting: { findUnique: vi.fn().mockResolvedValue({ reiseLonnsartId: null }) },
    organizationReiseGrense: { findMany: vi.fn().mockResolvedValue([]) },
    reisetidMatrise: { findMany: vi.fn().mockResolvedValue([]) },
    oppmotested: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dagsseddelRouter } from "./dagsseddel";

const __dir = dirname(fileURLToPath(import.meta.url));
const dagsseddelKilde = readFileSync(join(__dir, "dagsseddel.ts"), "utf8");
const versjonKilde = readFileSync(join(__dir, "sync-versjon.ts"), "utf8");

type Rad = {
  id: string;
  updatedAt: Date;
  projectId: string;
  byggeplassId: string | null;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  vehicleId: string | null;
  timer: number;
  fraTid: string | null;
  tilTid: string | null;
  beskrivelse: string | null;
  pauseMin: number;
  erReise: boolean;
  reiseRetning: string | null;
  reiseOppmotestedId: string | null;
  reiseKjoretidMin: number | null;
  reiseAvstandM: number | null;
  reiseKilde: string | null;
  reiseRegel: unknown;
  tidKilde: string | null;
};

function serverRad(over: Partial<Rad>): Rad {
  return {
    id: RAD_A,
    updatedAt: new Date(V1),
    projectId: PROSJEKT,
    byggeplassId: null,
    lonnsartId: LONNSART,
    aktivitetId: AKTIVITET,
    externalCostObjectId: null,
    vehicleId: null,
    timer: 8,
    fraTid: "07:00",
    tilTid: "15:00",
    beskrivelse: null,
    pauseMin: 0,
    erReise: false,
    reiseRetning: null,
    reiseOppmotestedId: null,
    reiseKjoretidMin: null,
    reiseAvstandM: null,
    reiseKilde: null,
    reiseRegel: null,
    tidKilde: null,
    ...over,
  };
}

/** Bygg et ctx med en TILSTANDSFULL sheet_timer (delete/create muterer `rows`). */
function lagCtx(initielleRader: Rad[]) {
  let rows: Rad[] = initielleRader.map((r) => ({ ...r }));
  let forslag: Record<string, unknown>[] = [];

  const matchWhere = (r: Rad, where: { id?: { in?: string[] } } | undefined) =>
    !where?.id?.in || where.id.in.includes(r.id);

  const txMock = {
    dailySheet: {
      findUnique: vi.fn().mockResolvedValue({ id: CLIENT_UUID }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      // V20/PK6: synkroniserHodePause setter hodet = Σ rad etter radskriving.
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn(async () => ({
        id: CLIENT_UUID,
        clientUuid: CLIENT_UUID,
        status: "draft",
        lederKommentar: null,
        attestertVed: null,
        updatedAt: WRITE_TID,
      })),
    },
    sheetTimer: {
      // V20/PK6: hodet utledes via aggregate(_sum pauseMin) over radene.
      aggregate: vi.fn(async () => ({
        _sum: { pauseMin: rows.reduce((s, r) => s + ((r as { pauseMin?: number }).pauseMin ?? 0), 0) },
      })),
      findMany: vi.fn(async (args?: { where?: { id?: { in?: string[] } } }) =>
        rows.filter((r) => matchWhere(r, args?.where)),
      ),
      deleteMany: vi.fn(async (args: { where: { id: { in: string[] } } }) => {
        const ids = args.where.id.in;
        const n = rows.filter((r) => ids.includes(r.id)).length;
        rows = rows.filter((r) => !ids.includes(r.id));
        return { count: n };
      }),
      createMany: vi.fn(async (args: { data: Record<string, unknown>[] }) => {
        for (const d of args.data) rows.push({ ...(d as unknown as Rad), updatedAt: WRITE_TID });
        return { count: args.data.length };
      }),
    },
    sheetTillegg: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sheetMachine: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sheetUtlegg: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sheetTimerForslag: {
      deleteMany: vi.fn(async () => {
        const n = forslag.length;
        forslag = [];
        return { count: n };
      }),
      createMany: vi.fn(async (args: { data: Record<string, unknown>[] }) => {
        forslag = args.data;
        return { count: args.data.length };
      }),
    },
  };

  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: { oppmotested: { findMany: vi.fn().mockResolvedValue([]) } },
    prismaTimer: {
      dailySheet: {
        findUnique: vi.fn(async (args: { where: Record<string, unknown> }) => {
          if ("clientUuid" in args.where) {
            return {
              id: CLIENT_UUID,
              clientUuid: CLIENT_UUID,
              status: "draft",
              userId: USER,
              organizationId: ORG,
              lederKommentar: null,
              attestertVed: null,
              konfliktVentendeSiden: null,
              updatedAt: WRITE_TID,
            };
          }
          return null;
        }),
      },
      aktivitet: {
        findFirst: vi.fn().mockResolvedValue({ id: AKTIVITET }),
        findMany: vi.fn().mockResolvedValue([{ id: AKTIVITET }]),
      },
      lonnsart: { findMany: vi.fn().mockResolvedValue([{ id: LONNSART, satsEnhet: null }]) },
      tillegg: { findMany: vi.fn().mockResolvedValue([]) },
      expenseCategory: { findMany: vi.fn().mockResolvedValue([]) },
      sheetTimer: { findMany: vi.fn(async () => rows.map((r) => ({ ...r }))) },
      $transaction: vi.fn((arg: unknown) =>
        typeof arg === "function"
          ? (arg as (tx: typeof txMock) => Promise<unknown>)(txMock)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    },
  } as unknown as Parameters<typeof dagsseddelRouter.createCaller>[0];

  return {
    ctx,
    txMock,
    sluttRader: () => rows,
    forslagData: () => forslag,
  };
}

type PayloadRad = Record<string, unknown> & { id: string };

function sedel(timer: PayloadRad[], slettedeIder?: Record<string, unknown>) {
  return {
    clientUuid: CLIENT_UUID,
    projectId: PROSJEKT,
    aktivitetId: AKTIVITET,
    byggeplassId: null,
    dato: "2026-09-20",
    status: "draft" as const,
    timer: timer.map((t) => ({
      projectId: PROSJEKT,
      lonnsartId: LONNSART,
      aktivitetId: AKTIVITET,
      timer: 8,
      fraTid: "07:00",
      tilTid: "15:00",
      ...t,
    })),
    tillegg: [],
    maskiner: [],
    utlegg: [],
    ...(slettedeIder ? { slettedeIder } : {}),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("V19.9-A syncBatch — versjonssjekk pr. rad (§ 9.6)", () => {
  it("test 1 (Kenneths sak): PC endret 15:00→15:30, telefonen pusher raden URØRT → hopp over, 15:30 står", async () => {
    const { ctx, sluttRader, forslagData, txMock } = lagCtx([
      serverRad({ id: RAD_A, updatedAt: new Date(V2), tilTid: "15:30" }),
    ]);
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [sedel([{ id: RAD_A, serverVersjon: V1, endretLokalt: false, tilTid: "15:00" }])],
    });
    const r = res.resultater[0]!;
    expect(r.resultat).toBe("ok");
    expect(r.serverData!.hoppetOver).toEqual([RAD_A]);
    expect(r.serverData!.rader).toEqual([]);
    // 15:30 står urørt; payload-15:00 ble IKKE skrevet.
    expect(sluttRader()).toHaveLength(1);
    expect(sluttRader()[0]!.tilTid).toBe("15:30");
    expect(forslagData()).toHaveLength(0);
    expect(txMock.sheetTimer.createMany).not.toHaveBeenCalled();
  });

  it("test 2 (R4): telefonen endret til 15:15, PC til 15:30 → 15:30 står, forslag endret_begge m/ 15:15, conflict/overlapp", async () => {
    const { ctx, sluttRader, forslagData } = lagCtx([
      serverRad({ id: RAD_A, updatedAt: new Date(V2), tilTid: "15:30" }),
    ]);
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [sedel([{ id: RAD_A, serverVersjon: V1, endretLokalt: true, tilTid: "15:15" }])],
    });
    const r = res.resultater[0]!;
    expect(r.resultat).toBe("conflict");
    expect(r.aarsak).toBe("overlapp");
    expect(sluttRader()[0]!.tilTid).toBe("15:30"); // serverraden urørt
    expect(forslagData()).toHaveLength(1);
    expect(forslagData()[0]).toMatchObject({ id: RAD_A, grunn: "endret_begge", tilTid: "15:15" });
  });

  it("test 3 (R7): PC slettet raden, telefonen endret den → forslag slettet_pc, INGEN gjenoppstandelse", async () => {
    const { ctx, sluttRader, forslagData } = lagCtx([]); // serverraden finnes ikke (PC slettet)
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [sedel([{ id: RAD_A, serverVersjon: V1, endretLokalt: true, tilTid: "15:15" }])],
    });
    expect(res.resultater[0]!.resultat).toBe("conflict");
    expect(sluttRader()).toHaveLength(0); // ingen rad gjenoppstår i sheet_timer
    expect(forslagData()).toHaveLength(1);
    expect(forslagData()[0]).toMatchObject({ id: RAD_A, grunn: "slettet_pc" });
  });

  it("test 3b (R8): PC slettet, telefonen URØRT → hopp over, ingen rad, intet forslag", async () => {
    const { ctx, sluttRader, forslagData } = lagCtx([]);
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [sedel([{ id: RAD_A, serverVersjon: V1, endretLokalt: false }])],
    });
    const r = res.resultater[0]!;
    expect(r.resultat).toBe("ok");
    expect(r.serverData!.hoppetOver).toEqual([RAD_A]);
    expect(sluttRader()).toHaveLength(0);
    expect(forslagData()).toHaveLength(0);
  });

  it("test 4 (S2'): PC endret, telefonen slettet → raden står, forslag slettet_telefon (kopi, samme id)", async () => {
    const { ctx, sluttRader, forslagData } = lagCtx([
      serverRad({ id: RAD_A, updatedAt: new Date(V2), tilTid: "15:30" }),
    ]);
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [
        sedel([], { timer: [], tillegg: [], maskiner: [], utlegg: [], timerVersjoner: [{ id: RAD_A, serverVersjon: V1 }] }),
      ],
    });
    expect(res.resultater[0]!.resultat).toBe("conflict");
    expect(sluttRader()).toHaveLength(1); // serverraden står
    expect(sluttRader()[0]!.tilTid).toBe("15:30");
    expect(forslagData()).toHaveLength(1);
    expect(forslagData()[0]).toMatchObject({ id: RAD_A, grunn: "slettet_telefon", tilTid: "15:30" });
  });

  it("test 5 (R10 eldre app, ingen versjon): ulikt innhold → forslag endret_begge", async () => {
    const { ctx, forslagData } = lagCtx([serverRad({ id: RAD_A, tilTid: "15:00" })]);
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [sedel([{ id: RAD_A, tilTid: "15:30" }])], // ingen serverVersjon/endretLokalt
    });
    expect(res.resultater[0]!.resultat).toBe("conflict");
    expect(forslagData()[0]).toMatchObject({ id: RAD_A, grunn: "endret_begge" });
  });

  it("test 5 (R9 eldre app): likt innhold → skriv (idempotent), ingen forslag", async () => {
    const { ctx, forslagData, txMock } = lagCtx([serverRad({ id: RAD_A, tilTid: "15:00", timer: 8 })]);
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [sedel([{ id: RAD_A, tilTid: "15:00", timer: 8 }])],
    });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(forslagData()).toHaveLength(0);
    expect(txMock.sheetTimer.createMany).toHaveBeenCalledTimes(1);
  });

  it("test 6: uomstridt NY rad skrives i SAMME tx som avvik-forslaget lagres (Kenneths krav 4)", async () => {
    const { ctx, sluttRader, forslagData } = lagCtx([
      serverRad({ id: RAD_A, updatedAt: new Date(V2), fraTid: "07:00", tilTid: "11:00" }),
    ]);
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [
        sedel([
          // avvik (endret begge, 07–11), ingen tidsoverlapp mot NY
          { id: RAD_A, serverVersjon: V1, endretLokalt: true, fraTid: "07:00", tilTid: "11:00", timer: 5 },
          // uomstridt ny rad 12–15
          { id: RAD_NY, serverVersjon: null, fraTid: "12:00", tilTid: "15:00" },
        ]),
      ],
    });
    const r = res.resultater[0]!;
    expect(r.resultat).toBe("conflict");
    // NY-raden ER skrevet selv om sedelen fikk conflict/overlapp.
    expect(sluttRader().some((x) => x.id === RAD_NY)).toBe(true);
    expect(r.serverData!.rader!.map((x) => x.id)).toContain(RAD_NY);
    expect(forslagData()).toHaveLength(1);
    expect(forslagData()[0]).toMatchObject({ id: RAD_A, grunn: "endret_begge" });
  });

  it("test 7: overlapp i tid + versjonsavvik samtidig → HELE payloaden forslag, ingen skriving (V19.1 forrang)", async () => {
    const { ctx, sluttRader, forslagData, txMock } = lagCtx([
      serverRad({ id: RAD_A, updatedAt: new Date(V2), fraTid: "07:00", tilTid: "11:00" }),
    ]);
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [
        sedel([
          // avvik endret_begge — telefonens A 07–09 (ulikt serverens 07–11)
          { id: RAD_A, serverVersjon: V1, endretLokalt: true, fraTid: "07:00", tilTid: "09:00", timer: 2 },
          // ny rad 10–12 → overlapper serverens overlevende A (07–11) i unionen
          { id: RAD_NY, serverVersjon: null, fraTid: "10:00", tilTid: "12:00", timer: 2 },
        ]),
      ],
    });
    const r = res.resultater[0]!;
    expect(r.resultat).toBe("conflict");
    expect(r.aarsak).toBe("overlapp");
    // Ingen skriving — hele payloaden ble forslag.
    expect(txMock.sheetTimer.createMany).not.toHaveBeenCalled();
    expect(sluttRader()[0]!.tilTid).toBe("11:00"); // serverraden urørt
    expect(forslagData()).toHaveLength(2);
    const grunnById = Object.fromEntries(forslagData().map((f) => [f.id, f.grunn]));
    expect(grunnById[RAD_A]).toBe("endret_begge");
    expect(grunnById[RAD_NY]).toBe("overlapp");
  });
  it("(fabel-vilkår a): hoppOver-rad (stale telefon-kopi) tas IKKE med i overlapp-forslaget", async () => {
    // Server A ligger 10–12 (PC flyttet den, V2). Telefonen pusher sin STALE A 07–09
    // URØRT (R3 hoppOver) + en ny rad 11–13 (R6 skriv). Unionen (server-A 10–12 ∪
    // skriv 11–13) overlapper → V19-A-forrang. Stale A SKAL ikke bli valgbar i forslaget
    // (ellers ruller «appen for hele dagen» PC-ens flytting tilbake).
    const { ctx, forslagData, txMock } = lagCtx([
      serverRad({ id: RAD_A, updatedAt: new Date(V2), fraTid: "10:00", tilTid: "12:00" }),
    ]);
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [
        sedel([
          { id: RAD_A, serverVersjon: V1, endretLokalt: false, fraTid: "07:00", tilTid: "09:00", timer: 2 },
          { id: RAD_NY, serverVersjon: null, fraTid: "11:00", tilTid: "13:00", timer: 2 },
        ]),
      ],
    });
    expect(res.resultater[0]!.resultat).toBe("conflict");
    expect(txMock.sheetTimer.createMany).not.toHaveBeenCalled(); // V19-A: ingen skriving
    // KUN den nye raden er forslag; stale A er filtrert bort.
    expect(forslagData().map((f) => f.id)).toEqual([RAD_NY]);
  });

  it("(V19.9-A2 d): overlapp i tid + slettet_telefon-tombstone → forslaget BÆRER slettet_telefon-raden", async () => {
    const RAD_B = "88888888-8888-8888-8888-000000000003";
    // Server A 07–11 (urørt, overlever) + B 13–15 (PC endret, V2). Telefonen sletter B
    // (tombstone m/ gammel versjon → S2' slettet_telefon) og pusher en ny rad 07:30–08:00
    // som overlapper A i tid → V19-A-forrang. Uten fiksen forsvinner B-slettingen stille.
    const { ctx, forslagData, txMock } = lagCtx([
      serverRad({ id: RAD_A, updatedAt: new Date(V1), fraTid: "07:00", tilTid: "11:00" }),
      serverRad({ id: RAD_B, updatedAt: new Date(V2), fraTid: "13:00", tilTid: "15:00" }),
    ]);
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [
        sedel(
          [{ id: RAD_NY, serverVersjon: null, fraTid: "07:30", tilTid: "08:00", timer: 0.5 }],
          { timer: [], tillegg: [], maskiner: [], utlegg: [], timerVersjoner: [{ id: RAD_B, serverVersjon: V1 }] },
        ),
      ],
    });
    expect(res.resultater[0]!.resultat).toBe("conflict");
    expect(txMock.sheetTimer.createMany).not.toHaveBeenCalled(); // V19-A: ingen skriving
    const grunnById = Object.fromEntries(forslagData().map((f) => [f.id, f.grunn]));
    // Både den nye raden OG tombstone-avviket er i forslaget.
    expect(grunnById[RAD_NY]).toBe("overlapp");
    expect(grunnById[RAD_B]).toBe("slettet_telefon");
  });
});

describe("V19.9-A grep-vakter (§ 9.6 test 13)", () => {
  it("klassifiserSyncRader er ENESTE leser av serverVersjon (dagsseddel.ts sammenligner den aldri)", () => {
    // Versjons-SAMMENLIGNINGEN bor i sync-versjon.ts.
    expect(versjonKilde).toMatch(/iso\(s\.updatedAt\)\s*===\s*v/);
    // dagsseddel.ts leser serverVersjon KUN som pass-through (payloadVersjon/tombstone),
    // aldri i en beslutning (===/!==/</>) — ellers er det en annen leser.
    expect(dagsseddelKilde).not.toMatch(/serverVersjon\s*(===|!==|<|>)/);
    // Eneste kaller av klassifiseringen.
    const kall = dagsseddelKilde.match(/klassifiserSyncRader\(/g) ?? [];
    expect(kall).toHaveLength(1);
  });

  it("ingen createMany på sheet_timer i syncBatch med en id som ikke kom fra skriv[]", () => {
    // Timer-createMany i syncBatch skriver KUN skrivTimerListe (klassifisert «skriv»),
    // aldri hele lokal.timer.
    expect(dagsseddelKilde).toMatch(/data: skrivTimerListe\.map/);
    expect(dagsseddelKilde).not.toMatch(/tx\.sheetTimer\.createMany\({\s*data: lokal\.timer\.map/);
  });
});
