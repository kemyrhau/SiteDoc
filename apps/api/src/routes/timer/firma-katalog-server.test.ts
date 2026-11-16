import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Post 2026-11-14 (7) punkt 1 + punkt 5.
 *
 * Punkt 1: lønnsart, aktivitet og tillegg er firma-eide kataloger. En ID fra et
 * annet firma skal avvises FØR den kobles til sedelen — i alle skrive-stier
 * (oppdaterTimerRad, redigerSedelRader, oppdater, oppdaterTilleggRad).
 * Katalog-mockene filtrerer ekte på `organizationId` i WHERE, så testen feiler
 * hvis vakten slår opp uten firma-filter.
 *
 * Punkt 5: maskin-kontrollen (maskin ≤ arbeid + pause) måles mot arbeid UTEN
 * reise — maskin 7 / arbeid 7 / reise 2 godtas, maskin 8 / arbeid 7 / reise 2
 * avvises.
 *
 * Drives via dagsseddelRouter.createCaller med mocket ctx — samme mønster som
 * byggeplass-rad.test.ts.
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
vi.mock("@sitedoc/db", () => ({
  prisma: {
    organizationSetting: { findUnique: vi.fn().mockResolvedValue(null) },
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

import { dagsseddelRouter, krevKatalogIFirma } from "./dagsseddel";

const USER = "user-1";
const ORG = "11111111-1111-1111-1111-111111111111";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SHEET = "22222222-2222-2222-2222-222222222222";
const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const LONNSART = "44444444-4444-4444-4444-444444444444";
const AKTIVITET = "55555555-5555-5555-5555-555555555555";
const TILLEGG = "56565656-5656-5656-5656-565656565656";
const RAD = "66666666-6666-6666-6666-666666666666";
const UTSTYR = "77777777-7777-7777-7777-777777777777";
// Fremmede katalog-ID-er: finnes, men hører til ORG_B.
const FREMMED_LONNSART = "c4444444-4444-4444-4444-444444444444";
const FREMMED_AKTIVITET = "c5555555-5555-5555-5555-555555555555";
const FREMMED_TILLEGG = "c5656565-5656-5656-5656-565656565656";

type KatalogRad = { id: string; organizationId: string; navn: string; satsEnhet?: string };
/** Katalog-mock som filtrerer på WHERE {id, organizationId} som Prisma ville. */
function katalog(rader: KatalogRad[]) {
  const treff = (where: Record<string, unknown> | undefined) =>
    rader.filter((r) => {
      if (!where) return true;
      const id = where.id as string | { in: string[] } | undefined;
      if (typeof id === "string" && r.id !== id) return false;
      if (id && typeof id === "object" && !id.in.includes(r.id)) return false;
      if (where.organizationId !== undefined && r.organizationId !== where.organizationId) return false;
      return true;
    });
  return {
    findMany: vi.fn(async (a?: { where?: Record<string, unknown> }) => treff(a?.where)),
    findFirst: vi.fn(async (a?: { where?: Record<string, unknown> }) => treff(a?.where)[0] ?? null),
  };
}

function lagCtx(opts: {
  status?: string;
  timerRader?: Array<{ timer: number; erReise: boolean }>;
} = {}) {
  const sheet = {
    id: SHEET,
    clientUuid: SHEET,
    userId: USER,
    organizationId: ORG,
    status: opts.status ?? "draft",
    pauseMin: 0,
    dato: new Date("2026-11-14T00:00:00Z"),
  };
  const timerUpdate = vi.fn().mockResolvedValue({ id: RAD });
  const tilleggUpdate = vi.fn().mockResolvedValue({ id: RAD });
  const sheetUpdate = vi.fn().mockResolvedValue({ ...sheet });
  const maskinCreate = vi.fn().mockResolvedValue({ id: RAD });
  const tx = {
    sheetTimer: {
      update: timerUpdate,
      aggregate: vi.fn().mockResolvedValue({ _sum: { pauseMin: 0 } }),
    },
    sheetTillegg: { update: tilleggUpdate },
    sheetMachine: { create: maskinCreate },
    dailySheet: { update: sheetUpdate },
  };
  const transaction = vi.fn(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => Promise<unknown>)(tx),
  );
  const timerRader = (opts.timerRader ?? []).map((r, i) => ({
    id: `rad-${i}`,
    projectId: PROSJEKT,
    externalCostObjectId: null,
    timer: r.timer,
    erReise: r.erReise,
  }));
  const ctx = {
    userId: USER,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {
      organizationSetting: {
        findUnique: vi.fn().mockResolvedValue({ tillattRedigerVedAttestering: true }),
      },
    },
    prismaTimer: {
      $transaction: transaction,
      dailySheet: { findUnique: vi.fn().mockResolvedValue(sheet), update: sheetUpdate },
      lonnsart: katalog([
        { id: LONNSART, organizationId: ORG, navn: "Ordinær", satsEnhet: "per_time" },
        { id: FREMMED_LONNSART, organizationId: ORG_B, navn: "Ordinær B", satsEnhet: "per_time" },
      ]),
      aktivitet: katalog([
        { id: AKTIVITET, organizationId: ORG, navn: "Graving" },
        { id: FREMMED_AKTIVITET, organizationId: ORG_B, navn: "Graving B" },
      ]),
      tillegg: katalog([
        { id: TILLEGG, organizationId: ORG, navn: "Smuss" },
        { id: FREMMED_TILLEGG, organizationId: ORG_B, navn: "Smuss B" },
      ]),
      sheetTimer: {
        findUnique: vi.fn().mockResolvedValue({
          id: RAD, sheetId: SHEET, projectId: PROSJEKT, lonnsartId: LONNSART,
          aktivitetId: AKTIVITET, timer: 4, erReise: false, attestertStatus: "pending",
          externalCostObjectId: null, fraTid: "07:00", tilTid: "11:00", pauseMin: 0,
        }),
        findMany: vi.fn().mockResolvedValue(timerRader),
        update: timerUpdate,
      },
      sheetTillegg: {
        findUnique: vi.fn().mockResolvedValue({
          id: RAD, sheetId: SHEET, projectId: PROSJEKT, tilleggId: TILLEGG, antall: 1,
        }),
        delete: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        update: tilleggUpdate,
      },
      sheetMachine: {
        findMany: vi.fn().mockResolvedValue([]),
        create: maskinCreate,
      },
    },
  };
  return { ctx, timerUpdate, tilleggUpdate, sheetUpdate, maskinCreate };
}

const caller = (ctx: unknown) =>
  dagsseddelRouter.createCaller(ctx as Parameters<typeof dagsseddelRouter.createCaller>[0]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("krevKatalogIFirma — delt firmavakt (punkt 1)", () => {
  const { ctx } = lagCtx();
  const pt = ctx.prismaTimer as unknown as Parameters<typeof krevKatalogIFirma>[0];

  it("egne ID-er godtas", async () => {
    await expect(
      krevKatalogIFirma(pt, ORG, {
        lonnsartIder: [LONNSART], aktivitetIder: [AKTIVITET, AKTIVITET], tilleggIder: [TILLEGG],
      }),
    ).resolves.toBeUndefined();
  });

  it("null/undefined/tomme lister slår ikke opp", async () => {
    await expect(
      krevKatalogIFirma(pt, ORG, { lonnsartIder: [undefined], aktivitetIder: [null], tilleggIder: [] }),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["lønnsart", { lonnsartIder: [FREMMED_LONNSART] }, /Lønnsart finnes ikke i firmaets katalog/],
    ["aktivitet", { aktivitetIder: [AKTIVITET, FREMMED_AKTIVITET] }, /Aktivitet finnes ikke i firmaets katalog/],
    ["tillegg", { tilleggIder: [FREMMED_TILLEGG] }, /Tillegg finnes ikke i firmaets katalog/],
  ])("🔴 fremmed %s avvises", async (_navn, ider, feil) => {
    await expect(krevKatalogIFirma(pt, ORG, ider)).rejects.toThrow(feil);
  });
});

describe("oppdaterTimerRad — katalog-firmavakt (punkt 1)", () => {
  it("🔴 fremmed lønnsart: BAD_REQUEST, ingen oppdatering", async () => {
    const { ctx, timerUpdate } = lagCtx();
    await expect(
      caller(ctx).oppdaterTimerRad({ id: RAD, lonnsartId: FREMMED_LONNSART, fraTid: "07:00", tilTid: "11:00" }),
    ).rejects.toThrow(/Lønnsart finnes ikke i firmaets katalog/);
    expect(timerUpdate).not.toHaveBeenCalled();
  });

  it("🔴 fremmed aktivitet: BAD_REQUEST, ingen oppdatering", async () => {
    const { ctx, timerUpdate } = lagCtx();
    await expect(
      caller(ctx).oppdaterTimerRad({ id: RAD, aktivitetId: FREMMED_AKTIVITET, fraTid: "07:00", tilTid: "11:00" }),
    ).rejects.toThrow(/Aktivitet finnes ikke i firmaets katalog/);
    expect(timerUpdate).not.toHaveBeenCalled();
  });

  it("egen lønnsart + aktivitet: oppdateres med connect", async () => {
    const { ctx, timerUpdate } = lagCtx();
    await caller(ctx).oppdaterTimerRad({
      id: RAD, lonnsartId: LONNSART, aktivitetId: AKTIVITET, fraTid: "07:00", tilTid: "11:00",
    });
    expect(timerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lonnsart: { connect: { id: LONNSART } },
          aktivitet: { connect: { id: AKTIVITET } },
        }),
      }),
    );
  });
});

describe("oppdater (sedel-aktivitet) — katalog-firmavakt", () => {
  it("🔴 fremmed aktivitet: BAD_REQUEST, sedelen oppdateres ikke", async () => {
    const { ctx, sheetUpdate } = lagCtx();
    await expect(
      caller(ctx).oppdater({ id: SHEET, aktivitetId: FREMMED_AKTIVITET }),
    ).rejects.toThrow(/Aktivitet finnes ikke i firmaets katalog/);
    expect(sheetUpdate).not.toHaveBeenCalled();
  });

  it("egen aktivitet: oppdateres med connect", async () => {
    const { ctx, sheetUpdate } = lagCtx();
    await caller(ctx).oppdater({ id: SHEET, aktivitetId: AKTIVITET });
    expect(sheetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ aktivitet: { connect: { id: AKTIVITET } } }),
      }),
    );
  });
});

describe("oppdaterTilleggRad — katalog-firmavakt", () => {
  it("🔴 fremmed tillegg: BAD_REQUEST, ingen oppdatering", async () => {
    const { ctx, tilleggUpdate } = lagCtx();
    await expect(
      caller(ctx).oppdaterTilleggRad({ id: RAD, tilleggId: FREMMED_TILLEGG }),
    ).rejects.toThrow(/Tillegg finnes ikke i firmaets katalog/);
    expect(tilleggUpdate).not.toHaveBeenCalled();
  });

  it("eget tillegg: oppdateres med connect", async () => {
    const { ctx, tilleggUpdate } = lagCtx();
    await caller(ctx).oppdaterTilleggRad({ id: RAD, tilleggId: TILLEGG });
    expect(tilleggUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tillegg: { connect: { id: TILLEGG } } }),
      }),
    );
  });
});

describe("redigerSedelRader — katalog-firmavakt (punkt 1)", () => {
  const timerRad = (lonnsartId: string, aktivitetId: string) => ({
    originalId: null, projectId: PROSJEKT, lonnsartId, aktivitetId, timer: 4, fraTid: "07:00", tilTid: "11:00",
  });
  const tilleggRad = (tilleggId: string) => ({ originalId: null, projectId: PROSJEKT, tilleggId, antall: 1 });
  const kjør = (ctx: unknown, nyeRader: Record<string, unknown>) =>
    caller(ctx).redigerSedelRader({
      sheetId: SHEET,
      nyeRader: { timer: [], tillegg: [], maskin: [], ...nyeRader },
    } as Parameters<ReturnType<typeof caller>["redigerSedelRader"]>[0]);

  it.each([
    ["lønnsart", { timer: [timerRad(FREMMED_LONNSART, AKTIVITET)] }, /Lønnsart finnes ikke i firmaets katalog/],
    ["aktivitet", { timer: [timerRad(LONNSART, FREMMED_AKTIVITET)] }, /Aktivitet finnes ikke i firmaets katalog/],
    ["tillegg", { tillegg: [tilleggRad(FREMMED_TILLEGG)] }, /Tillegg finnes ikke i firmaets katalog/],
  ])("🔴 fremmed %s: BAD_REQUEST, ingen transaksjon", async (_navn, nyeRader, feil) => {
    const { ctx } = lagCtx({ status: "sent" });
    await expect(kjør(ctx, nyeRader)).rejects.toThrow(feil);
    expect(ctx.prismaTimer.$transaction).not.toHaveBeenCalled();
  });

  it("egne ID-er passerer katalog-vakten", async () => {
    const { ctx } = lagCtx({ status: "sent" });
    // Senere steg i redigeringen er utenfor denne testens mock; kravet er at
    // katalog-vakten slår opp med firma-filter og ikke avviser egne ID-er.
    const feil = await kjør(ctx, {
      timer: [timerRad(LONNSART, AKTIVITET)],
      tillegg: [tilleggRad(TILLEGG)],
    }).then(() => null, (e: unknown) => e);
    expect(String(feil ?? "")).not.toMatch(/finnes ikke i firmaets katalog/);
    expect(ctx.prismaTimer.aktivitet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [AKTIVITET] }, organizationId: ORG } }),
    );
    expect(ctx.prismaTimer.tillegg.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [TILLEGG] }, organizationId: ORG } }),
    );
  });
});

describe("maskin-kontrollen måles mot arbeid uten reise (punkt 5)", () => {
  const ARBEID_OG_REISE = [
    { timer: 7, erReise: false },
    { timer: 2, erReise: true },
  ];

  it("maskin 7 / arbeid 7 / reise 2: godtas", async () => {
    const { ctx, maskinCreate } = lagCtx({ timerRader: ARBEID_OG_REISE });
    await caller(ctx).maskin.tilfoy({
      sheetId: SHEET, projectId: PROSJEKT, vehicleId: UTSTYR, timer: 7,
    });
    expect(maskinCreate).toHaveBeenCalled();
  });

  it("🔴 maskin 8 / arbeid 7 / reise 2: avvises (reise teller ikke som arbeid)", async () => {
    const { ctx, maskinCreate } = lagCtx({ timerRader: ARBEID_OG_REISE });
    await expect(
      caller(ctx).maskin.tilfoy({ sheetId: SHEET, projectId: PROSJEKT, vehicleId: UTSTYR, timer: 8 }),
    ).rejects.toThrow(/Maskintimer \(8\.00t\) overstiger arbeidstimer \(7\.00t\)/);
    expect(maskinCreate).not.toHaveBeenCalled();
  });
});

/**
 * RETUR 1 V2 — splitt-vakten i `validerSplittFelles`. Nye splitt-rader (timer:
 * lønnsart + aktivitet; tillegg: tillegg) må bruke sedelens firmakatalog. Drives
 * gjennom begge innganger (leder `splittRad`, eier `splittRadEier`). Avvist =
 * ingen transaksjon; egne ID-er slipper forbi vakten (transaksjonen startes).
 */
describe("splitt — katalog-firmavakt i validerSplittFelles (RETUR 1 V2)", () => {
  const timerDeler = (lonnsartId: string, aktivitetId: string) => [
    { projectId: PROSJEKT, lonnsartId: LONNSART, aktivitetId: AKTIVITET, fraTid: "07:00", tilTid: "09:00", timer: 2 },
    { projectId: PROSJEKT, lonnsartId, aktivitetId, fraTid: "09:00", tilTid: "11:00", timer: 2 },
  ];
  const tilleggDeler = (tilleggId: string) => [
    { projectId: PROSJEKT, tilleggId: TILLEGG, antall: 0.5 },
    { projectId: PROSJEKT, tilleggId, antall: 0.5 },
  ];
  const KATALOGFEIL = /finnes ikke i firmaets katalog/;

  it.each([
    ["eier, timer, fremmed lønnsart", "draft", "splittRadEier", { radType: "timer", radId: RAD, nyeRader: timerDeler(FREMMED_LONNSART, AKTIVITET) }, /Lønnsart finnes ikke i firmaets katalog/],
    ["eier, timer, fremmed aktivitet", "draft", "splittRadEier", { radType: "timer", radId: RAD, nyeRader: timerDeler(LONNSART, FREMMED_AKTIVITET) }, /Aktivitet finnes ikke i firmaets katalog/],
    ["eier, tillegg, fremmed tillegg", "draft", "splittRadEier", { radType: "tillegg", radId: RAD, nyeRader: tilleggDeler(FREMMED_TILLEGG) }, /Tillegg finnes ikke i firmaets katalog/],
    ["leder, timer, fremmed lønnsart", "sent", "splittRad", { radType: "timer", radId: RAD, nyeRader: timerDeler(FREMMED_LONNSART, AKTIVITET) }, /Lønnsart finnes ikke i firmaets katalog/],
    ["leder, timer, fremmed aktivitet", "sent", "splittRad", { radType: "timer", radId: RAD, nyeRader: timerDeler(LONNSART, FREMMED_AKTIVITET) }, /Aktivitet finnes ikke i firmaets katalog/],
  ] as const)("🔴 %s: BAD_REQUEST, ingen transaksjon", async (_navn, status, inngang, input, feil) => {
    const { ctx } = lagCtx({ status });
    const c = caller(ctx) as unknown as Record<string, (i: unknown) => Promise<unknown>>;
    await expect(c[inngang]!(input)).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(feil) });
    expect(ctx.prismaTimer.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["eier, timer", "draft", "splittRadEier", { radType: "timer", radId: RAD, nyeRader: timerDeler(LONNSART, AKTIVITET) }],
    ["eier, tillegg", "draft", "splittRadEier", { radType: "tillegg", radId: RAD, nyeRader: tilleggDeler(TILLEGG) }],
    ["leder, timer", "sent", "splittRad", { radType: "timer", radId: RAD, nyeRader: timerDeler(LONNSART, AKTIVITET) }],
  ] as const)("%s med egne ID-er: slipper forbi vakten (transaksjonen startes)", async (_navn, status, inngang, input) => {
    const { ctx } = lagCtx({ status });
    const c = caller(ctx) as unknown as Record<string, (i: unknown) => Promise<unknown>>;
    // Transaksjons-mocken dekker ikke splitt-skrivingen; det som måles er at vakten slapp gjennom.
    const feil = await c[inngang]!(input).then(() => null, (e: unknown) => e as Error);
    expect(feil?.message ?? "").not.toMatch(KATALOGFEIL);
    expect(ctx.prismaTimer.$transaction).toHaveBeenCalled();
  });
});
