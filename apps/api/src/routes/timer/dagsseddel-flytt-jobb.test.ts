import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * `dagsseddel.flyttJobb` — O8 D (plan § 8.22, Kenneth 2026-11-22): prosjekt og byggeplass endres
 * på et lagret, redigerbart jobbkort, og jobben flyttes dit. Alt som henger på jobben følger,
 * unntatt reisen (punkt 2). Nytt prosjekt → underprosjekt «Uten» (punkt 1). Varer krever
 * varelager på nytt prosjekt (punkt 3, åpen), utlegg lik ordning (punkt 4).
 *
 * Mocket transaksjon; `sikreKortId` er mocket (reisens nye kort og vare-kort-id testes mot ekte
 * Postgres i flytt-jobb-prosjekt.integration.test.ts). Negativkontroll: uten `flyttJobb` er alle røde.
 */

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const P_UTEN_VARE = "33333333-3333-4333-8333-333333333333";
const P_ANNET_FIRMA = "44444444-4444-4444-8444-444444444444";
const BP1 = "55555555-5555-4555-8555-555555555551";
const BP2 = "55555555-5555-4555-8555-555555555552";
const ECO1 = "66666666-6666-4666-8666-666666666666";
const KAT = "77777777-7777-4777-8777-777777777777";
const KORT = "88888888-8888-4888-8888-888888888881";
const KORT_B = "88888888-8888-4888-8888-888888888882";
const SHEET = "99999999-9999-4999-8999-999999999999";
const USER = "user-1";

vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn(async (ider: string[]) => {
    if (ider.includes(P_ANNET_FIRMA)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Prosjektet tilhører ikke firmaet" });
    }
  }),
  autoriserAdminForFirma: vi.fn(),
  verifiserProsjektmedlem: vi.fn(),
  hentBrukersOrg: vi.fn(),
  krevBrukersOrg: vi.fn(),
  resolverOrgFraInput: vi.fn(),
  resolverOrgForEgenTimeføring: vi.fn(),
  verifiserAnsattIFirma: vi.fn(),
}));
vi.mock("../../services/timer", () => ({
  krevTimerAktivert: vi.fn(),
  hentEffektivArbeidstid: vi.fn(),
}));
vi.mock("../../services/varelager/moduleGate", () => ({
  erVarelagerAktivert: vi.fn(async (_org: string, p: string) => p !== P_UTEN_VARE),
}));
vi.mock("../../services/timer/maskinJobbVakt", () => ({
  lesMaskinJobbTilstand: vi.fn(async () => ({})),
  krevIngenNyeMaskinBrudd: vi.fn(async () => undefined),
  koblMaskinerTilJobb: vi.fn(),
}));
vi.mock("../../services/timer/kortId", async (orig) => ({
  ...(await orig<typeof import("../../services/timer/kortId")>()),
  sikreKortId: vi.fn(async () => ({ brudd: [], kortIdFor: new Map() })),
}));
vi.mock("@sitedoc/db", () => ({
  Prisma: {},
  prisma: {
    organizationSetting: { findUnique: async () => null },
    activity: { create: async () => ({}) },
    byggeplass: {
      findFirst: async ({ where }: { where: { id: string; projectId: string } }) =>
        (where.id === BP1 && where.projectId === P1) || (where.id === BP2 && where.projectId === P2)
          ? { id: where.id }
          : null,
    },
  },
}));

import { dagsseddelRouter } from "./dagsseddel";

type Rad = {
  id: string;
  sheetId: string;
  kortId: string | null;
  projectId: string | null;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
  attestertStatus?: string;
  erReise?: boolean;
  fraTid?: string;
  createdAt?: Date;
  expenseCategoryId?: string;
  ordningVedFoering?: string;
  attestertSnapshot?: unknown;
};
type Where = {
  id?: { in: string[] };
  sheetId?: string;
  dagsseddelId?: string;
  kortId?: string;
  erReise?: boolean;
  projectId?: { not: null };
  attestertStatus?: { not: string };
};

function treff(r: Rad, w: Where): boolean {
  if (w.id && !w.id.in.includes(r.id)) return false;
  if (w.sheetId !== undefined && r.sheetId !== w.sheetId) return false;
  if (w.dagsseddelId !== undefined && r.sheetId !== w.dagsseddelId) return false;
  if (w.kortId !== undefined && r.kortId !== w.kortId) return false;
  if (w.erReise !== undefined && (r.erReise ?? false) !== w.erReise) return false;
  if (w.projectId && r.projectId === null) return false;
  if (w.attestertStatus && (r.attestertStatus ?? "pending") === w.attestertStatus.not) return false;
  return true;
}

const felles = { sheetId: SHEET, kortId: KORT, projectId: P1, byggeplassId: BP1, externalCostObjectId: ECO1, attestertStatus: "pending" };

/** Jobb A på P1/BP1/ECO1 med alt som kan henge på en jobb, en reise, og jobb B som står. */
function data() {
  return {
    timer: [
      { ...felles, id: "t1", fraTid: "07:00" },
      { ...felles, id: "t2", fraTid: "15:00" },
      { ...felles, id: "r1", erReise: true, fraTid: "06:30" },
      { ...felles, id: "tErstattet", attestertStatus: "erstattet", fraTid: "08:00" },
      { ...felles, id: "tB", kortId: KORT_B, fraTid: "16:00" },
    ] as Rad[],
    tillegg: [{ ...felles, id: "tl1" }] as Rad[],
    maskin: [{ ...felles, id: "m1" }] as Rad[],
    utlegg: [{ ...felles, id: "u1", expenseCategoryId: KAT, ordningVedFoering: "utlegg" }] as Rad[],
    varer: [{ ...felles, id: "v1", attestertSnapshot: null }] as Rad[],
  };
}

function oppsett(
  status: string,
  d: ReturnType<typeof data> = data(),
  o: { overstyring?: string } = {},
) {
  const modell = (rader: Rad[]) => ({
    findMany: async ({ where }: { where: Where }) => rader.filter((r) => treff(r, where)),
    findFirst: async ({ where }: { where: Where }) =>
      rader.filter((r) => treff(r, where)).sort((a, b) => ((a.fraTid ?? "") < (b.fraTid ?? "") ? -1 : 1))[0] ?? null,
    updateMany: async ({ where, data: endring }: { where: Where; data: Partial<Rad> }) => {
      const valgt = rader.filter((r) => treff(r, where));
      for (const r of valgt) Object.assign(r, endring);
      return { count: valgt.length };
    },
  });
  const db = {
    sheetTimer: modell(d.timer),
    sheetTillegg: modell(d.tillegg),
    sheetMachine: modell(d.maskin),
    sheetUtlegg: modell(d.utlegg),
    expenseCategory: { findMany: async () => [{ id: KAT, ordning: "utlegg" }] },
    prosjektOrdningOverstyring: {
      findMany: async ({ where }: { where: { prosjektId: string } }) =>
        o.overstyring && where.prosjektId === P2 ? [{ expenseCategoryId: KAT, ordning: o.overstyring }] : [],
    },
    dailySheet: {
      findUnique: async ({ where }: { where: { id?: string } }) =>
        where.id === SHEET
          ? { id: SHEET, clientUuid: SHEET, userId: USER, organizationId: "org", status, dato: new Date() }
          : null,
      update: async () => ({ id: SHEET }),
    },
  };
  const ctx = {
    userId: USER,
    prisma: { organizationSetting: { findUnique: async () => ({ timerRegistreringsmodus: "prosjektkort" }) } },
    prismaTimer: { ...db, $transaction: (fn: (t: typeof db) => unknown) => fn(db) },
    prismaMaskin: {},
    prismaVarelager: { vareforbruk: modell(d.varer) },
    req: { log: { error: () => {} } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { caller: dagsseddelRouter.createCaller(ctx), d };
}

const sted = (r: Rad) => [r.projectId, r.byggeplassId, r.externalCostObjectId];
const jobbRader = (d: ReturnType<typeof data>) => [
  ...d.timer.filter((r) => !r.erReise && r.attestertStatus !== "erstattet" && r.id !== "tB"),
  ...d.tillegg,
  ...d.maskin,
  ...d.utlegg,
  ...d.varer,
];
const urort = () => JSON.stringify(data());

beforeEach(() => vi.clearAllMocks());

describe("dagsseddel.flyttJobb — prosjekt og byggeplass på lagret jobbkort", () => {
  it("utkast: alt på jobben (unntatt reise) flyttes til nytt prosjekt, byggeplass, underprosjekt «Uten»", async () => {
    const { caller, d } = oppsett("draft");
    const svar = await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2 });
    expect(svar.antall).toBe(6);
    for (const r of jobbRader(d)) expect({ id: r.id, sted: sted(r) }).toEqual({ id: r.id, sted: [P2, BP2, null] });
    // Intet igjen på gammelt prosjekt, unntatt reisen og den erstattede historikken.
    const igjen = [...d.timer, ...d.tillegg, ...d.maskin, ...d.utlegg, ...d.varer]
      .filter((r) => r.projectId === P1 && r.id !== "tB")
      .map((r) => r.id);
    expect(igjen.sort()).toEqual(["r1", "tErstattet"]);
    // Ny kort-id, felles for hele jobben.
    const kortIder = new Set(jobbRader(d).map((r) => r.kortId));
    expect(kortIder.size).toBe(1);
    expect(kortIder.has(KORT)).toBe(false);
    expect([...kortIder][0]).toBe(svar.kortId);
    // Jobb B står.
    expect(sted(d.timer.find((r) => r.id === "tB")!)).toEqual([P1, BP1, ECO1]);
    expect(d.timer.find((r) => r.id === "tB")!.kortId).toBe(KORT_B);
  });

  it("reisen flyttes ikke: prosjekt, byggeplass og underprosjekt står; bare jobbens kort-id tas av", async () => {
    const { caller, d } = oppsett("draft");
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2 });
    const reise = d.timer.find((r) => r.id === "r1")!;
    expect(sted(reise)).toEqual([P1, BP1, ECO1]);
    expect(reise.kortId).toBeNull();
  });

  it("returnert dag kan også flyttes", async () => {
    const { caller, d } = oppsett("returned");
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: null });
    expect(sted(d.timer.find((r) => r.id === "t1")!)).toEqual([P2, null, null]);
  });

  it.each(["sent", "accepted", "approved"])("%s dag avvises, ingenting flyttes", async (status) => {
    const { caller, d } = oppsett(status);
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: `Dagsseddel er låst (status: ${status})` });
    expect(JSON.stringify(d)).toBe(urort());
  });

  it.each([
    ["timer", "t2"],
    ["reise", "r1"],
    ["tillegg", "tl1"],
    ["maskin", "m1"],
  ])("attestert %s-linje i jobben blokkerer, ingenting flyttes", async (_type, radId) => {
    const d = data();
    const alle = [...d.timer, ...d.tillegg, ...d.maskin];
    alle.find((r) => r.id === radId)!.attestertStatus = "attestert";
    const foer = JSON.stringify(d);
    const { caller } = oppsett("draft", d);
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2 }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Bare jobber der alle linjene venter på attestering kan flyttes. Gjenåpne linjene først.",
    });
    expect(JSON.stringify(d)).toBe(foer);
  });

  it("attestert vare blokkerer", async () => {
    const d = data();
    d.varer[0]!.attestertSnapshot = { pris: 1 };
    const foer = JSON.stringify(d);
    const { caller } = oppsett("draft", d);
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2 }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(JSON.stringify(d)).toBe(foer);
  });

  it("prosjekt i et annet firma avvises, ingenting flyttes", async () => {
    const { caller, d } = oppsett("draft");
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P_ANNET_FIRMA, byggeplassId: null }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(JSON.stringify(d)).toBe(urort());
  });

  it("byggeplass utenfor valgt prosjekt avvises", async () => {
    const { caller, d } = oppsett("draft");
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP1 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Byggeplassen hører ikke til radens prosjekt" });
    expect(JSON.stringify(d)).toBe(urort());
  });

  it("punkt 3: varer på jobben og nytt prosjekt uten varelager → avvist", async () => {
    const { caller, d } = oppsett("draft");
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P_UTEN_VARE, byggeplassId: null }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Prosjektet har ikke varelager. Fjern varene først.",
    });
    expect(JSON.stringify(d)).toBe(urort());
  });

  it("punkt 3: uten varer flyttes jobben til prosjekt uten varelager", async () => {
    const d = data();
    d.varer.length = 0;
    const { caller } = oppsett("draft", d);
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P_UTEN_VARE, byggeplassId: null });
    expect(d.timer.find((r) => r.id === "t1")!.projectId).toBe(P_UTEN_VARE);
  });

  it("punkt 4: utlegget føres annerledes på nytt prosjekt → avvist med Kenneths tekst", async () => {
    const { caller, d } = oppsett("draft", data(), { overstyring: "fakturert" });
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2 }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Utlegget føres annerledes på dette prosjektet. Fjern det først.",
    });
    expect(JSON.stringify(d)).toBe(urort());
  });

  it("punkt 4: lik ordning → utlegget følger jobben", async () => {
    const { caller, d } = oppsett("draft", data(), { overstyring: "utlegg" });
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2 });
    expect(sted(d.utlegg[0]!)).toEqual([P2, BP2, null]);
  });

  it("bare ny byggeplass i samme prosjekt: underprosjektet står", async () => {
    const d = data();
    for (const r of [...d.timer, ...d.tillegg, ...d.maskin, ...d.utlegg, ...d.varer]) r.byggeplassId = null;
    const { caller } = oppsett("draft", d);
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P1, byggeplassId: BP1 });
    expect(sted(d.timer.find((r) => r.id === "t1")!)).toEqual([P1, BP1, ECO1]);
  });

  it("samme prosjekt og byggeplass: ingenting endres", async () => {
    const { caller, d } = oppsett("draft");
    const svar = await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P1, byggeplassId: BP1 });
    expect(svar).toEqual({ kortId: KORT, antall: 0 });
    expect(JSON.stringify(d)).toBe(urort());
  });
});
