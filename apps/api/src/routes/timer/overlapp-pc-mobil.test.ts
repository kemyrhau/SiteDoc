import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * V19 (overlapp PC ↔ mobil, ordre V19-A) — syncBatch-vakten (A-1a S2 + A-1b
 * eksisterende-sedel), aarsak-feltet (A-2) og idempotens. Spec § 6 tester
 * 1, 1b, 1e, 2, 13 (+ serverdelen av 12).
 *
 * Drives via dagsseddelRouter.createCaller med mocket ctx (ingen ekte DB) — samme
 * mønster som timer-lag2-sync.test.ts. Overlapp-regelen (finnTidsromKonflikt) er
 * @sitedoc/shared (ekte, ikke mocket), så en divergens mellom union-bygging og den
 * delte regelen ville vist seg her.
 *
 * Rød først (verifisert i engangskopi + comm -13): uten A-1a/A-1b skriver syncBatch
 * mobilens overlappende rader additivt inn på server-sedelen (PC 07–15 + mobil
 * 07–15 = 16 t) og svarer `dato_kollisjon`/`ok` — forslagstabellen røres aldri.
 */

const ORG = "11111111-1111-1111-1111-111111111111";
const USER = "user-1";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const LONNSART = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CLIENT_UUID = "77777777-7777-7777-7777-777777777777";
const SERVER_UUID = "99999999-9999-9999-9999-999999999999";
const SERVER_ID = "aaaaaaaa-0000-0000-0000-000000000001";

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
    // sitedoc_admin → erProsjektLeder/verifiserProsjektmedlem slipper gjennom
    // (attester-vaktens auth-forledd, A-4-testene).
    user: { findUnique: vi.fn().mockResolvedValue({ role: "sitedoc_admin" }) },
    organizationSetting: { findUnique: vi.fn().mockResolvedValue({ reiseLonnsartId: null }) },
    organizationReiseGrense: { findMany: vi.fn().mockResolvedValue([]) },
    reisetidMatrise: { findMany: vi.fn().mockResolvedValue([]) },
    oppmotested: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma } from "@sitedoc/db-timer";
import { dagsseddelRouter } from "./dagsseddel";

const __dir = dirname(fileURLToPath(import.meta.url));
const dagsseddelKilde = readFileSync(join(__dir, "dagsseddel.ts"), "utf8");

type ServerRad = { fraTid: string | null; tilTid: string | null };

/**
 * @param eksisterendeSheet  sedelen `findUnique(clientUuid)` finner (A-1b-veien).
 *                           null → create-veien (A-1a S2 når create kaster P2002).
 * @param serverRader        serverradene vakten sjekker payloaden mot.
 * @param createThrowsP2002  create kaster P2002 (speiler dato-kollisjonen i S2).
 * @param kollisjonSheet     sedelen `findUnique(userId_dato)` finner i S2-catchen.
 * @param forslagUpdateCount antallet lagreOverlappForslags updateMany treffer
 *                           (0 = låst sedel → "laast").
 */
function lagCtx(opts: {
  eksisterendeSheet?: { id: string; clientUuid: string; status: string } | null;
  serverRader?: ServerRad[];
  createThrowsP2002?: boolean;
  kollisjonSheet?: { id: string; clientUuid: string; status: string } | null;
  forslagUpdateCount?: number;
}) {
  const eksisterende = opts.eksisterendeSheet ?? null;
  const serverRader = opts.serverRader ?? [];
  const forslagUpdateCount = opts.forslagUpdateCount ?? 1;

  // V19.9: serveren leser nå HELE radene (id + updatedAt + innhold) for
  // versjonssjekken. Disse V19-A-fikstur-radene har syntetiske id-er som ALDRI
  // matcher payloadens (888…) → payload forblir «ny rad» (R6), union-overlapp som
  // før (V19.1/V19.4-semantikken denne harnessen tester er uendret).
  const serverRaderFull = serverRader.map((r, i) => ({
    id: `99999999-9999-9999-9999-00000000000${i + 1}`,
    updatedAt: new Date("2026-10-05T09:00:00Z"),
    projectId: PROSJEKT,
    byggeplassId: null,
    lonnsartId: LONNSART,
    aktivitetId: AKTIVITET,
    externalCostObjectId: null,
    vehicleId: null,
    timer: 8,
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
    ...r,
  }));

  const sheetHode = (s: { id: string; clientUuid: string; status: string }) => ({
    ...s,
    userId: USER,
    organizationId: ORG,
    lederKommentar: null,
    attestertVed: null,
    updatedAt: new Date("2026-10-05T10:00:00Z"),
  });

  const forslagDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const forslagCreateMany = vi.fn().mockResolvedValue({ count: serverRader.length });
  const dsUpdateMany = vi.fn().mockResolvedValue({ count: forslagUpdateCount });
  const timerCreateMany = vi.fn().mockResolvedValue({ count: 0 });
  const timerDeleteMany = vi.fn().mockResolvedValue({ count: 0 });

  const txMock = {
    dailySheet: {
      findUnique: vi.fn().mockResolvedValue(eksisterende ? { id: eksisterende.id } : null),
      updateMany: dsUpdateMany,
      create: vi.fn(async () => {
        if (opts.createThrowsP2002) {
          throw new Prisma.PrismaClientKnownRequestError("dato-kollisjon", {
            code: "P2002",
            clientVersion: "test",
          });
        }
        return sheetHode({ id: eksisterende?.id ?? CLIENT_UUID, clientUuid: CLIENT_UUID, status: "draft" });
      }),
      findUniqueOrThrow: vi.fn(async () =>
        sheetHode({ id: eksisterende?.id ?? CLIENT_UUID, clientUuid: CLIENT_UUID, status: "draft" }),
      ),
      // V20/PK6: synkroniserHodePause oppdaterer hodet.
      update: vi.fn().mockResolvedValue({}),
    },
    sheetTimer: {
      findMany: vi.fn().mockResolvedValue(serverRaderFull),
      deleteMany: timerDeleteMany,
      createMany: timerCreateMany,
      // V20/PK6: hodet = Σ rad via aggregate.
      aggregate: vi.fn().mockResolvedValue({ _sum: { pauseMin: 0 } }),
    },
    sheetTillegg: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sheetMachine: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sheetUtlegg: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    sheetTimerForslag: { deleteMany: forslagDeleteMany, createMany: forslagCreateMany },
  };

  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {
      oppmotested: { findMany: vi.fn().mockResolvedValue([]) },
    },
    prismaTimer: {
      dailySheet: {
        // Ytre eksisterende-oppslag (clientUuid) + S2-oppslag (userId_dato).
        findUnique: vi.fn(async (args: { where: Record<string, unknown> }) => {
          // Oppslag på clientUuid: den ytre eksisterende-sjekken (:5158) OG
          // serverSedel-re-lesningen etter A-1b-overlapp. I S2 (eksisterende=null)
          // skal dette gi null → create-veien → P2002.
          if ("clientUuid" in args.where) {
            return eksisterende ? sheetHode(eksisterende) : null;
          }
          // Oppslag på userId_dato: S2-catchens kollisjons-sedel (annen clientUuid).
          if ("userId_dato" in args.where) {
            return opts.kollisjonSheet ? sheetHode(opts.kollisjonSheet) : null;
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
      sheetTimer: { findMany: vi.fn().mockResolvedValue(serverRaderFull) },
      $transaction: vi.fn((arg: unknown) =>
        typeof arg === "function"
          ? (arg as (tx: typeof txMock) => Promise<unknown>)(txMock)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    },
  } as unknown as Parameters<typeof dagsseddelRouter.createCaller>[0];

  return { ctx, txMock, forslagCreateMany, forslagDeleteMany, dsUpdateMany, timerCreateMany, timerDeleteMany };
}

function sedelMed(timerRader: Record<string, unknown>[], clientUuid = CLIENT_UUID) {
  return {
    clientUuid,
    projectId: PROSJEKT,
    aktivitetId: AKTIVITET,
    byggeplassId: null,
    dato: "2026-09-20",
    status: "draft" as const,
    timer: timerRader.map((r, i) => ({
      id: `88888888-8888-8888-8888-00000000000${i + 1}`,
      projectId: PROSJEKT,
      lonnsartId: LONNSART,
      aktivitetId: AKTIVITET,
      timer: 8,
      ...r,
    })),
    tillegg: [],
    maskiner: [],
    utlegg: [],
  };
}

beforeEach(() => vi.clearAllMocks());

describe("V19 A-1b — eksisterende sedel, overlapp i tid", () => {
  it("🔴 (1b) PC 07–15 på server, mobil 07–15:30 → forslag lagret, sheet_timer URØRT, conflict/overlapp", async () => {
    const { ctx, forslagCreateMany, timerCreateMany, timerDeleteMany } = lagCtx({
      eksisterendeSheet: { id: CLIENT_UUID, clientUuid: CLIENT_UUID, status: "draft" },
      serverRader: [{ fraTid: "07:00", tilTid: "15:00" }],
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [sedelMed([{ fraTid: "07:00", tilTid: "15:30" }])],
    });
    const r = res.resultater[0]!;
    expect(r.resultat).toBe("conflict");
    expect(r.aarsak).toBe("overlapp");
    // Forslaget er skrevet (idempotent: deleteMany FØR createMany), radene ikke.
    expect(forslagCreateMany).toHaveBeenCalledTimes(1);
    expect(forslagCreateMany.mock.calls[0]![0].data).toHaveLength(1);
    expect(timerCreateMany).not.toHaveBeenCalled();
    expect(timerDeleteMany).not.toHaveBeenCalled();
  });

  it("(2/V19.4) PC 07–11, mobil 12–15 (ingen overlapp) → ingen forslag, normal ok-skriving", async () => {
    const { ctx, forslagCreateMany, timerCreateMany } = lagCtx({
      eksisterendeSheet: { id: CLIENT_UUID, clientUuid: CLIENT_UUID, status: "draft" },
      serverRader: [{ fraTid: "07:00", tilTid: "11:00" }],
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [sedelMed([{ fraTid: "12:00", tilTid: "15:00" }])],
    });
    expect(res.resultater[0]!.resultat).toBe("ok");
    expect(forslagCreateMany).not.toHaveBeenCalled();
    expect(timerCreateMany).toHaveBeenCalledTimes(1);
  });

});

describe("V19 A-1a — S2 (første push, dag ført på PC først)", () => {
  it("🔴 (1) create kaster P2002, server-sedelen overlapper → forslag lagret, conflict/overlapp", async () => {
    const { ctx, forslagCreateMany, forslagDeleteMany } = lagCtx({
      eksisterendeSheet: null, // mobilens clientUuid finnes ikke → create-veien
      createThrowsP2002: true,
      kollisjonSheet: { id: SERVER_ID, clientUuid: SERVER_UUID, status: "draft" },
      serverRader: [{ fraTid: "07:00", tilTid: "15:00" }],
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [sedelMed([{ fraTid: "07:00", tilTid: "15:30" }])],
    });
    const r = res.resultater[0]!;
    expect(r.resultat).toBe("conflict");
    expect(r.aarsak).toBe("overlapp");
    expect(r.serverData?.clientUuid).toBe(SERVER_UUID);
    // Idempotent erstatning: deleteMany før createMany.
    expect(forslagDeleteMany).toHaveBeenCalledTimes(1);
    expect(forslagCreateMany).toHaveBeenCalledTimes(1);
  });

  it("(2 S2) create kaster P2002 men INGEN overlapp (PC 07–11 / mobil 12–15) → aarsak «dato_kollisjon», ingen forslag", async () => {
    const { ctx, forslagCreateMany } = lagCtx({
      eksisterendeSheet: null,
      createThrowsP2002: true,
      kollisjonSheet: { id: SERVER_ID, clientUuid: SERVER_UUID, status: "draft" },
      serverRader: [{ fraTid: "07:00", tilTid: "11:00" }],
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [sedelMed([{ fraTid: "12:00", tilTid: "15:00" }])],
    });
    const r = res.resultater[0]!;
    expect(r.resultat).toBe("conflict");
    expect(r.aarsak).toBe("dato_kollisjon");
    expect(r.serverData?.clientUuid).toBe(SERVER_UUID);
    expect(forslagCreateMany).not.toHaveBeenCalled();
  });

  it("🔴 (13/§8.6) overlapp mot LÅST kollisjons-sedel (updateMany treffer 0) → aarsak «laast», INGEN forslag skrevet", async () => {
    // PC-sedelen er alt attestert (accepted). lagreOverlappForslags status-betingede
    // updateMany(status notIn sent/accepted) treffer 0 → "laast": ingen forslag, ingen
    // konfliktVentendeSiden på en låst sedel (§8.6). forslagUpdateCount=0 speiler det.
    const { ctx, forslagCreateMany, forslagDeleteMany } = lagCtx({
      eksisterendeSheet: null,
      createThrowsP2002: true,
      kollisjonSheet: { id: SERVER_ID, clientUuid: SERVER_UUID, status: "accepted" },
      serverRader: [{ fraTid: "07:00", tilTid: "15:00" }],
      forslagUpdateCount: 0,
    });
    const caller = dagsseddelRouter.createCaller(ctx);
    const res = await caller.syncBatch({
      sedler: [sedelMed([{ fraTid: "07:00", tilTid: "15:30" }])],
    });
    const r = res.resultater[0]!;
    expect(r.resultat).toBe("conflict");
    expect(r.aarsak).toBe("laast");
    expect(forslagDeleteMany).not.toHaveBeenCalled();
    expect(forslagCreateMany).not.toHaveBeenCalled();
  });
});

describe("V19 A-4 — attester-vakt blokkerer mens overlapp venter (spec § 6 test 5, begge veier)", () => {
  const TIMER_RAD = "cccccccc-0000-0000-0000-000000000001";

  it("🔴 attesterRader avvises (PRECONDITION_FAILED) når konfliktVentendeSiden er satt — INGEN rad-attestering", () => {
    return (async () => {
      const sheetUpdate = vi.fn();
      const ctx = {
        userId: USER,
        req: { log: { info: vi.fn(), warn: vi.fn() } },
        prisma: {},
        prismaTimer: {
          sheetTimer: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: TIMER_RAD,
                sheetId: SERVER_ID,
                projectId: PROSJEKT,
                attestertStatus: "pending",
                lonnsart: { id: LONNSART },
                aktivitet: { id: AKTIVITET },
              },
            ]),
            update: sheetUpdate,
          },
          sheetTillegg: { findMany: vi.fn().mockResolvedValue([]) },
          sheetMachine: { findMany: vi.fn().mockResolvedValue([]) },
          // Vakten: sedelen har uavklart overlapp.
          dailySheet: {
            findFirst: vi.fn().mockResolvedValue({ id: SERVER_ID }),
            findMany: vi.fn().mockResolvedValue([]),
          },
          $transaction: vi.fn(),
        },
      } as unknown as Parameters<typeof dagsseddelRouter.createCaller>[0];
      const caller = dagsseddelRouter.createCaller(ctx);
      await expect(
        caller.attesterRader({ radIder: { timerIder: [TIMER_RAD], tilleggIder: [], maskinIder: [] } }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(sheetUpdate).not.toHaveBeenCalled();
    })();
  });

  it("🔴 attester (thin-wrapper) avvises når konfliktVentendeSiden er satt", async () => {
    const transaction = vi.fn();
    const ctx = {
      userId: USER,
      req: { log: { info: vi.fn(), warn: vi.fn() } },
      prisma: {},
      prismaTimer: {
        dailySheet: {
          findUnique: vi.fn().mockResolvedValue({
            status: "sent",
            dato: new Date("2026-09-20T00:00:00Z"),
            userId: USER,
            organizationId: ORG,
          }),
          findFirst: vi.fn().mockResolvedValue({ id: SERVER_ID }), // uavklart overlapp
        },
        $transaction: transaction,
      },
    } as unknown as Parameters<typeof dagsseddelRouter.createCaller>[0];
    const caller = dagsseddelRouter.createCaller(ctx);
    await expect(caller.attester({ id: SERVER_ID })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("V19 grep-vakter (spec § 6 test 3, 9, 1c, 1d)", () => {
  it("🔴 (3) overlapp-regelen er finnTidsromKonflikt, ikke en ny kopi", () => {
    // finnOverlappMotServer bygger unionen og kaller den DELTE regelen. Ingen egen
    // overlapp-løkke i vakten.
    const def = dagsseddelKilde.match(
      /function finnOverlappMotServer[\s\S]*?\n}/,
    )?.[0];
    expect(def).toBeTruthy();
    expect(def).toContain("finnTidsromKonflikt([...serverRader, ...payloadRader])");
  });

  it("🔴 (9) de to overlapp-stedene (A-1a/A-1b) kaller ÉN finnOverlappMotServer", () => {
    // Nøyaktig én definisjon + minst to kallesteder (S2-catchen + eksisterende-grenen).
    const defs = dagsseddelKilde.match(/function finnOverlappMotServer\(/g) ?? [];
    const kall = dagsseddelKilde.match(/finnOverlappMotServer\(/g) ?? [];
    expect(defs).toHaveLength(1);
    expect(kall.length - defs.length).toBeGreaterThanOrEqual(2);
  });

  it("🔴 (1c) TOCTOU: lagreOverlappForslag + server-rad-lesingen tar tx, aldri ctx.prismaTimer", () => {
    // Forslags-skrivingen og lesingen den sjekker overlapp mot MÅ dele samme tx,
    // ellers kan en sedel attesteres i vinduet. Ingen kall mot ctx.prismaTimer.
    expect(dagsseddelKilde).not.toMatch(/lagreOverlappForslag\(\s*ctx\.prismaTimer/);
    const defs = dagsseddelKilde.match(/lagreOverlappForslag\(\s*tx,/g) ?? [];
    expect(defs.length).toBeGreaterThanOrEqual(2); // A-1a + A-1b, begge med tx
  });

  it("🔴 (1d) forslaget leses KUN i de tillatte prosedyrene — ingen lønnsleser i api-et", () => {
    // Ingen referanse til forslags-tabellen utenfor dagsseddel.ts (overtidsgrunnlag,
    // rapport/eksport, attesteringens radsett). Rekursivt sveip over api/src/routes.
    const rot = join(__dir, "..");
    const treff: string[] = [];
    const sveip = (kat: string) => {
      for (const e of readdirSync(kat, { withFileTypes: true })) {
        const p = join(kat, e.name);
        if (e.isDirectory()) sveip(p);
        else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) {
          if (p.endsWith("timer/dagsseddel.ts")) continue; // eneste tillatte
          if (/sheetTimerForslag|SheetTimerForslag/.test(readFileSync(p, "utf8"))) {
            treff.push(p);
          }
        }
      }
    };
    sveip(rot);
    expect(treff).toEqual([]);
  });

  it("🔴 (1d) forslaget leses i dagsseddel.ts KUN i hentMedId/hentForAttestering/forsonDagskort/pull-count", () => {
    // Positiv vakt: hver sheetTimerForslag-referanse står i en tillatt kontekst
    // (findMany for eier/leder, deleteMany/createMany i forslags-skrivingen +
    // forsonDagskort, groupBy COUNT i pull). Ingen findMany som bærer radene inn i
    // et attesterings-/overtids-/eksport-radsett.
    const linjer = dagsseddelKilde
      .split("\n")
      .filter((l) => /sheetTimerForslag/.test(l));
    expect(linjer.length).toBeGreaterThan(0);
    for (const l of linjer) {
      expect(l).toMatch(/\.(findMany|deleteMany|createMany|groupBy)\(/);
    }
  });
});
