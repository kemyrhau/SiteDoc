import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * `dagsseddel.flyttJobb` — O8 D (plan § 8.22, Kenneth 2026-11-22): prosjekt og byggeplass endres
 * på et lagret, redigerbart jobbkort, og jobben flyttes dit. Alt som henger på jobben følger,
 * unntatt reisen (punkt 2). Nytt prosjekt → underprosjekt «Uten» (punkt 1). Varer følger også
 * til prosjekt uten varelager (punkt 3), utlegg krever lik ordning (punkt 4).
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
const R1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

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
vi.mock("../../services/timer/maskinJobbVakt", () => ({
  lesMaskinJobbTilstand: vi.fn(async () => ({})),
  krevIngenNyeMaskinBrudd: vi.fn(async () => undefined),
  koblMaskinerTilJobb: vi.fn(),
  koblUkobledeForerMaskinerTilRad: vi.fn(async () => []),
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
  arbeidReiseRetning?: string | null;
  fraTid?: string;
  tilTid?: string;
  timer?: number;
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
  arbeidReiseRetning?: null;
  OR?: Array<{ erReise?: boolean; arbeidReiseRetning?: { not: null } }>;
  projectId?: { not: null };
  attestertStatus?: { not: string };
};

function treff(r: Rad, w: Where): boolean {
  if (w.id && !w.id.in.includes(r.id)) return false;
  if (w.sheetId !== undefined && r.sheetId !== w.sheetId) return false;
  if (w.dagsseddelId !== undefined && r.sheetId !== w.dagsseddelId) return false;
  if (w.kortId !== undefined && r.kortId !== w.kortId) return false;
  if (w.erReise !== undefined && (r.erReise ?? false) !== w.erReise) return false;
  if (w.arbeidReiseRetning === null && (r.arbeidReiseRetning ?? null) !== null) return false;
  if (
    w.OR &&
    !w.OR.some((o) =>
      o.erReise !== undefined ? (r.erReise ?? false) === o.erReise : (r.arbeidReiseRetning ?? null) !== null,
    )
  )
    return false;
  if (w.projectId && r.projectId === null) return false;
  if (w.attestertStatus && (r.attestertStatus ?? "pending") === w.attestertStatus.not) return false;
  return true;
}

const felles = { sheetId: SHEET, kortId: KORT, projectId: P1, byggeplassId: BP1, externalCostObjectId: ECO1, attestertStatus: "pending" };

/** Jobb A på P1/BP1/ECO1 med alt som kan henge på en jobb, en reise, og jobb B som står. */
function data() {
  return {
    timer: [
      { ...felles, id: "t1", fraTid: "07:00", tilTid: "15:00" },
      { ...felles, id: "t2", fraTid: "15:00" },
      { ...felles, id: R1, erReise: true, fraTid: "06:30", tilTid: "07:00" },
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
  o: { overstyring?: string; vareFeil?: boolean } = {},
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
    update: async ({ where, data: endring }: { where: { id: string }; data: Partial<Rad> }) => {
      const r = rader.find((x) => x.id === where.id)!;
      Object.assign(r, endring);
      return r;
    },
    deleteMany: async ({ where }: { where: Where }) => {
      const valgt = rader.filter((r) => treff(r, where));
      for (const r of valgt) rader.splice(rader.indexOf(r), 1);
      return { count: valgt.length };
    },
    aggregate: async () => ({ _sum: { pauseMin: 0 } }),
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
  // Vare-steget er rå SQL på transaksjonen (Kontrollør 138 vilkår 2). Verdiene kommer i
  // rekkefølgen prosjekt, byggeplass, eco, kort-id, id-lista (`Prisma.join`).
  const tx = {
    ...db,
    $executeRaw: async (_s: TemplateStringsArray, ...v: unknown[]) => {
      if (o.vareFeil) throw new Error("tilkoblingen brøt");
      const [projectId, byggeplassId, externalCostObjectId, kortId, liste] = v as [string, string | null, string | null, string, { values: string[] }];
      const valgt = d.varer.filter((r) => liste.values.includes(r.id));
      for (const r of valgt) Object.assign(r, { projectId, byggeplassId, externalCostObjectId, kortId });
      return valgt.length;
    },
  };
  // Transaksjon som ruller tilbake: kaster callbacken, legges radene tilbake slik de var.
  const transaksjon = async (fn: (t: typeof tx) => unknown) => {
    const foer = structuredClone(d);
    try {
      return await fn(tx);
    } catch (e) {
      for (const k of Object.keys(d) as (keyof typeof d)[]) d[k].splice(0, d[k].length, ...foer[k]);
      throw e;
    }
  };
  const ctx = {
    userId: USER,
    prisma: { organizationSetting: { findUnique: async () => ({ timerRegistreringsmodus: "prosjektkort" }) } },
    prismaTimer: { ...db, $transaction: transaksjon, $executeRaw: tx.$executeRaw },
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
/** O12 pkt 18: valget arbeideren gjør i vinduet; uten tider beholder reisen sine tider. */
const FLYTT = { valg: "flytt" as const, tider: [] };

beforeEach(() => vi.clearAllMocks());

describe("dagsseddel.flyttJobb — prosjekt og byggeplass på lagret jobbkort", () => {
  it("utkast: alt på jobben flyttes til nytt prosjekt, byggeplass, underprosjekt «Uten» (O12 pkt 18: reisen med «flytt»)", async () => {
    const { caller, d } = oppsett("draft");
    const svar = await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2, reise: FLYTT });
    expect(svar.antall).toBeGreaterThanOrEqual(6);
    for (const r of jobbRader(d)) expect({ id: r.id, sted: sted(r) }).toEqual({ id: r.id, sted: [P2, BP2, null] });
    // Intet igjen på gammelt prosjekt, unntatt den erstattede historikken.
    const igjen = [...d.timer, ...d.tillegg, ...d.maskin, ...d.utlegg, ...d.varer]
      .filter((r) => r.projectId === P1 && r.id !== "tB")
      .map((r) => r.id);
    expect(igjen.sort()).toEqual(["tErstattet"]);
    // Ny kort-id, felles for hele jobben.
    const kortIder = new Set(jobbRader(d).map((r) => r.kortId));
    expect(kortIder.size).toBe(1);
    expect(kortIder.has(KORT)).toBe(false);
    expect([...kortIder][0]).toBe(svar.kortId);
    // Jobb B står.
    expect(sted(d.timer.find((r) => r.id === "tB")!)).toEqual([P1, BP1, ECO1]);
    expect(d.timer.find((r) => r.id === "tB")!.kortId).toBe(KORT_B);
  });

  it("O12 pkt 18: reise i jobben uten valg → avvist, ingenting endres", async () => {
    const { caller, d } = oppsett("draft");
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2 }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Jobben har en reise. Velg om reisen flyttes med ny tid eller slettes.",
    });
    expect(JSON.stringify(d)).toBe(urort());
  });

  it("O12 pkt 18: «Flytt reisen med ny tid» — reisen følger jobben til nytt sted og kort med ny tid", async () => {
    const { caller, d } = oppsett("draft");
    await caller.flyttJobb({
      sheetId: SHEET,
      kortId: KORT,
      projectId: P2,
      byggeplassId: BP2,
      reise: { valg: "flytt", tider: [{ id: R1, fraTid: "06:15", tilTid: "07:00", kjoretidMin: 45 }] },
    });
    const reise = d.timer.find((r) => r.id === R1)!;
    const t1 = d.timer.find((r) => r.id === "t1")!;
    expect(sted(reise)).toEqual([P2, BP2, null]);
    expect(reise.kortId).toBe(t1.kortId);
    expect(reise).toMatchObject({ fraTid: "06:15", tilTid: "07:00", timer: 0.75 });
  });

  it("O12 pkt 18: «Slett reisen» — reisen er borte, jobben flyttet", async () => {
    const { caller, d } = oppsett("draft");
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2, reise: { valg: "slett" } });
    expect(d.timer.find((r) => r.id === R1)).toBeUndefined();
    expect(sted(d.timer.find((r) => r.id === "t1")!)).toEqual([P2, BP2, null]);
  });

  it("O12 pkt 16/18: reise ført som arbeidstid (merket) behandles som reise — slettes med «Slett reisen»", async () => {
    const d = data();
    const r1 = d.timer.find((r) => r.id === R1)!;
    r1.erReise = false;
    r1.arbeidReiseRetning = "ut";
    const { caller } = oppsett("draft", d);
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2, reise: { valg: "slett" } });
    expect(d.timer.find((r) => r.id === R1)).toBeUndefined();
  });

  it("O12 pkt 18 (R7): umerket arbeidstid-reise fra før er arbeid — følger stille med, uten valg", async () => {
    const d = data();
    const r1 = d.timer.find((r) => r.id === R1)!;
    r1.erReise = false;
    const { caller } = oppsett("draft", d);
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2 });
    expect(sted(r1)).toEqual([P2, BP2, null]);
    expect(r1).toMatchObject({ fraTid: "06:30", tilTid: "07:00" });
  });

  it("O12 pkt 18: ny tid som overlapper en annen rad → avvist, ingenting endres", async () => {
    const { caller, d } = oppsett("draft");
    await expect(
      caller.flyttJobb({
        sheetId: SHEET,
        kortId: KORT,
        projectId: P2,
        byggeplassId: BP2,
        reise: { valg: "flytt", tider: [{ id: R1, fraTid: "06:30", tilTid: "07:30", kjoretidMin: 60 }] },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Reisens nye tid overlapper en annen rad på dagsseddelen." });
    expect(JSON.stringify(d)).toBe(urort());
  });

  it("returnert dag kan også flyttes", async () => {
    const { caller, d } = oppsett("returned");
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: null, reise: FLYTT });
    expect(sted(d.timer.find((r) => r.id === "t1")!)).toEqual([P2, null, null]);
  });

  it.each(["sent", "accepted", "approved"])("%s dag avvises, ingenting flyttes", async (status) => {
    const { caller, d } = oppsett(status);
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2, reise: FLYTT }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: `Dagsseddel er låst (status: ${status})` });
    expect(JSON.stringify(d)).toBe(urort());
  });

  it.each([
    ["timer", "t2"],
    ["reise", R1],
    ["tillegg", "tl1"],
    ["maskin", "m1"],
  ])("attestert %s-linje i jobben blokkerer, ingenting flyttes", async (_type, radId) => {
    const d = data();
    const alle = [...d.timer, ...d.tillegg, ...d.maskin];
    alle.find((r) => r.id === radId)!.attestertStatus = "attestert";
    const foer = JSON.stringify(d);
    const { caller } = oppsett("draft", d);
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2, reise: FLYTT }),
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
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2, reise: FLYTT }),
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

  it("vilkår 2: feiler vare-steget, står hele jobben på gammelt sted (én transaksjon)", async () => {
    const { caller, d } = oppsett("draft", data(), { vareFeil: true });
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2, reise: FLYTT }),
    ).rejects.toThrow("tilkoblingen brøt");
    expect(JSON.stringify(d)).toBe(urort());
  });

  it("punkt 3: varene følger jobben til prosjekt uten varelager — ingen blir igjen", async () => {
    const { caller, d } = oppsett("draft");
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P_UTEN_VARE, byggeplassId: null, reise: FLYTT });
    expect(d.timer.find((r) => r.id === "t1")!.projectId).toBe(P_UTEN_VARE);
    expect(d.varer.map((v) => v.projectId)).toEqual([P_UTEN_VARE]);
    expect(d.varer[0]!.kortId).toBe(d.timer.find((r) => r.id === "t1")!.kortId);
  });

  it("punkt 4: utlegget føres annerledes på nytt prosjekt → avvist med Kenneths tekst", async () => {
    const { caller, d } = oppsett("draft", data(), { overstyring: "fakturert" });
    await expect(
      caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2, reise: FLYTT }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Utlegget føres annerledes på dette prosjektet. Fjern det først.",
    });
    expect(JSON.stringify(d)).toBe(urort());
  });

  it("punkt 4: lik ordning → utlegget følger jobben", async () => {
    const { caller, d } = oppsett("draft", data(), { overstyring: "utlegg" });
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P2, byggeplassId: BP2, reise: FLYTT });
    expect(sted(d.utlegg[0]!)).toEqual([P2, BP2, null]);
  });

  it("bare ny byggeplass i samme prosjekt: underprosjektet står", async () => {
    const d = data();
    for (const r of [...d.timer, ...d.tillegg, ...d.maskin, ...d.utlegg, ...d.varer]) r.byggeplassId = null;
    const { caller } = oppsett("draft", d);
    await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P1, byggeplassId: BP1, reise: FLYTT });
    expect(sted(d.timer.find((r) => r.id === "t1")!)).toEqual([P1, BP1, ECO1]);
  });

  it("samme prosjekt og byggeplass: ingenting endres", async () => {
    const { caller, d } = oppsett("draft");
    const svar = await caller.flyttJobb({ sheetId: SHEET, kortId: KORT, projectId: P1, byggeplassId: BP1 });
    expect(svar).toEqual({ kortId: KORT, antall: 0 });
    expect(JSON.stringify(d)).toBe(urort());
  });
});
