import { describe, it, expect, vi } from "vitest";

/**
 * `dagsseddel.slettKort` / `slettKortOversikt` — retur O8 tillegg 2 (b), plan § 8.22: «Slett
 * jobben» sletter ETT feilført jobbkort i sin helhet; dagen og de andre kortene står. Draft og
 * returned (som fjernTimerRad); attestert rad eller vare med attestert_snapshot blokkerer.
 *
 * Mocket transaksjon (samme mønster som dagsseddel-slett-returnert.test.ts). SQL-en for varer og
 * slettingen på tvers av skjemaene testes mot ekte Postgres i slett-jobbkort.integration.test.ts.
 * Negativkontroll: develop har ingen `slettKort` — alle røde.
 */

vi.mock("../../trpc/tilgangskontroll", () => ({
  verifiserProsjekterTilhørerFirma: vi.fn(),
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
vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));

import { dagsseddelRouter } from "./dagsseddel";

const USER = "user-1";
const SHEET = "22222222-2222-2222-2222-222222222222";

type Rad = { id: string; kortId?: string | null; sheetTimerId?: string | null; attestertStatus?: string; erReise?: boolean };
type Where = {
  kortId?: string;
  attestertStatus?: { not: string };
  OR?: Array<{ kortId?: string; sheetTimerId?: { in: string[] } }>;
  id?: { in: string[] };
  sheetTilleggId?: { in: string[] };
  sheetUtleggId?: { in: string[] };
};

function treff(r: Rad, w: Where): boolean {
  if (w.kortId !== undefined && r.kortId !== w.kortId) return false;
  if (w.attestertStatus && (r.attestertStatus ?? "pending") === w.attestertStatus.not) return false;
  if (w.OR && !w.OR.some((o) => (o.kortId !== undefined && r.kortId === o.kortId) || (o.sheetTimerId && o.sheetTimerId.in.includes(r.sheetTimerId ?? "")))) return false;
  return true;
}

function oppsett(status: string, data: { timer?: Rad[]; maskin?: Rad[]; tillegg?: Rad[]; utlegg?: Rad[]; varer?: Array<{ id: string; attestert: boolean }> }) {
  const slettet: Record<string, string[]> = {};
  const modell = (navn: string, rader: Rad[]) => ({
    findMany: ({ where }: { where: Where }) => Promise.resolve(rader.filter((r) => treff(r, where))),
    deleteMany: ({ where }: { where: Where }) => {
      const ider = where.id?.in ?? where.sheetTilleggId?.in ?? where.sheetUtleggId?.in ?? [];
      slettet[navn] = [...(slettet[navn] ?? []), ...ider];
      return Promise.resolve({ count: ider.length });
    },
  });
  const db = {
    $queryRaw: (deler: TemplateStringsArray) =>
      Promise.resolve(deler.join("?").includes("FOR UPDATE") ? [{ id: SHEET, status }] : (data.varer ?? [])),
    $executeRaw: (deler: TemplateStringsArray) => {
      if (deler.join("?").includes("vareforbruk")) slettet.varer = (data.varer ?? []).map((v) => v.id);
      return Promise.resolve(0);
    },
    sheetTimer: modell("timer", data.timer ?? []),
    sheetMachine: modell("maskin", data.maskin ?? []),
    sheetTillegg: modell("tillegg", data.tillegg ?? []),
    sheetUtlegg: modell("utlegg", data.utlegg ?? []),
    // R1 b3: returnert dag skriver de slettede radene til historikken.
    sheetRadHistorikk: { createMany: () => Promise.resolve({ count: 0 }) },
    sheetTilleggVedlegg: modell("tilleggVedlegg", []),
    sheetUtleggVedlegg: modell("utleggVedlegg", []),
    // O27: sporet etter sletting på PC (tomt).
    slettetFraPc: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
    dailySheet: {
      findUnique: ({ where }: { where: { id?: string } }) =>
        Promise.resolve(where.id === SHEET ? { id: SHEET, clientUuid: SHEET, userId: USER, organizationId: "org", status } : null),
      // O27: sporet leser eier og dato.
      findUniqueOrThrow: () =>
        Promise.resolve({ clientUuid: SHEET, userId: USER, organizationId: "org", dato: new Date("2026-11-20") }),
      delete: () => {
        slettet.dag = [SHEET];
        return Promise.resolve({ id: SHEET });
      },
    },
  };
  const ctx = {
    userId: USER,
    prismaTimer: { ...db, $transaction: (fn: (t: typeof db) => unknown) => fn(db) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { caller: dagsseddelRouter.createCaller(ctx), slettet };
}

const TO_KORT = {
  timer: [
    { id: "tA", kortId: "kA" },
    { id: "rA", kortId: "kA", erReise: true },
    { id: "tB", kortId: "kB" },
    { id: "eA", kortId: "kA", attestertStatus: "erstattet" },
  ],
  maskin: [
    { id: "mVia", sheetTimerId: "tA" },
    { id: "mA", kortId: "kA" },
    { id: "mB", kortId: "kB" },
  ],
  tillegg: [{ id: "tlA", kortId: "kA" }, { id: "tlB", kortId: "kB" }],
  utlegg: [{ id: "uA", kortId: "kA" }, { id: "uB", kortId: "kB" }],
  varer: [{ id: "vA", attestert: false }],
};

describe("dagsseddel.slettKort — ett kort, dagen står", () => {
  it("utkast: sletter bare kort A (maskin også via timeraden), erstattet rad og dagen står", async () => {
    const { caller, slettet } = oppsett("draft", TO_KORT);
    const svar = await caller.slettKort({ id: SHEET, kortId: "kA" });
    expect(svar).toEqual({
      id: SHEET, kortId: "kA",
      slettet: { timer: 1, reise: 1, maskin: 2, varer: 1, tillegg: 1, utlegg: 1 },
    });
    expect(slettet.timer).toEqual(["tA", "rA"]);
    expect(slettet.maskin).toEqual(["mVia", "mA"]);
    expect(slettet.tillegg).toEqual(["tlA"]);
    expect(slettet.tilleggVedlegg).toEqual(["tlA"]);
    expect(slettet.utlegg).toEqual(["uA"]);
    expect(slettet.utleggVedlegg).toEqual(["uA"]);
    expect(slettet.varer).toEqual(["vA"]);
    expect(slettet.dag).toBeUndefined();
  });

  it("returnert dag uten attestert rad: kortet kan slettes", async () => {
    const { caller, slettet } = oppsett("returned", TO_KORT);
    await caller.slettKort({ id: SHEET, kortId: "kA" });
    expect(slettet.timer).toEqual(["tA", "rA"]);
  });

  it.each(["sent", "approved"])("%s dag avvises, ingenting slettes", async (status) => {
    const { caller, slettet } = oppsett(status, TO_KORT);
    await expect(caller.slettKort({ id: SHEET, kortId: "kA" })).rejects.toThrow(/låst/);
    expect(slettet).toEqual({});
  });

  it("attestert timerad i kortet blokkerer — «be leder gjenåpne»", async () => {
    const data = { ...TO_KORT, timer: [{ id: "tA", kortId: "kA", attestertStatus: "attestert" }] };
    const { caller, slettet } = oppsett("returned", data);
    await expect(caller.slettKort({ id: SHEET, kortId: "kA" })).rejects.toThrow(/Be leder gjenåpne/);
    expect(slettet).toEqual({});
  });

  it("vare med attestert_snapshot i kortet blokkerer", async () => {
    const data = { ...TO_KORT, varer: [{ id: "vA", attestert: true }] };
    const { caller, slettet } = oppsett("draft", data);
    await expect(caller.slettKort({ id: SHEET, kortId: "kA" })).rejects.toThrow(/Be leder gjenåpne/);
    expect(slettet).toEqual({});
  });

  it("ukjent kort → «Jobben finnes ikke»", async () => {
    const { caller } = oppsett("draft", { timer: [{ id: "tB", kortId: "kB" }] });
    await expect(caller.slettKort({ id: SHEET, kortId: "kZ" })).rejects.toThrow(/Jobben finnes ikke/);
  });
});

describe("dagsseddel.slettKortOversikt", () => {
  it("teller kortets innhold og sier at det kan slettes", async () => {
    const { caller, slettet } = oppsett("draft", TO_KORT);
    expect(await caller.slettKortOversikt({ id: SHEET, kortId: "kA" })).toEqual({
      innhold: { timer: 1, reise: 1, maskin: 2, varer: 1, tillegg: 1, utlegg: 1 },
      kanSlettes: true,
      grunn: null,
    });
    expect(slettet).toEqual({});
  });

  it("attestert rad: kanSlettes false med grunnen", async () => {
    const data = { ...TO_KORT, maskin: [{ id: "mA", kortId: "kA", attestertStatus: "attestert" }] };
    const { caller } = oppsett("draft", data);
    const o = await caller.slettKortOversikt({ id: SHEET, kortId: "kA" });
    expect(o.kanSlettes).toBe(false);
    expect(o.grunn).toMatch(/Be leder gjenåpne/);
  });
});
