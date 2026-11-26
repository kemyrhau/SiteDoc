import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `dagsseddel.slett` — bare et UTKAST kan slettes (S1, plan § 8.22, Kenneth 2026-11-21:
 * «returnert dag bør kun redigeres»). Erstatter Kenneth-vedtak 2026-10-09 (2), der en
 * returnert, ikke-attestert dag kunne slettes. Sendt/godkjent avvises som før.
 *
 * Negativkontroll (rød uten fiksen): med gammel vakt (`returned && attestertVed === null`
 * tillatt) blir «NEKTER returnert uten attestert» rød. Hele slettingen (alle tabeller, begge
 * skjemaene, feil halvveis) testes mot ekte Postgres i slett-dagsseddel-alt.integration.test.ts.
 * Drives via dagsseddelRouter.createCaller med mocket ctx — samme mønster som forson-dagskort.test.ts.
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

const slett = vi.fn();
const findUnique = vi.fn();

function lagCaller(sheet: { status: string; attestertVed: Date | null }) {
  findUnique.mockImplementation(({ where }: { where: { id?: string; clientUuid?: string } }) => {
    // hentEgenDagsseddel slår opp på id FØRST; returner sedelen der.
    if (where.id === SHEET) {
      return Promise.resolve({ id: SHEET, clientUuid: SHEET, userId: USER, organizationId: "org", ...sheet });
    }
    return Promise.resolve(null);
  });
  slett.mockResolvedValue({ id: SHEET });
  const teller = { count: () => Promise.resolve(0), findMany: () => Promise.resolve([]), deleteMany: () => Promise.resolve({ count: 0 }) };
  const tx = {
    // Raden låses med FOR UPDATE og leses på nytt; tellinger (varer) gir 0.
    $queryRaw: (deler: TemplateStringsArray) =>
      Promise.resolve(deler.join("?").includes("FOR UPDATE") ? [{ id: SHEET, status: sheet.status }] : [{ n: 0 }]),
    $executeRaw: () => Promise.resolve(0),
    sheetTimer: teller,
    sheetTillegg: teller,
    sheetUtlegg: teller,
    sheetMachine: teller,
    sheetTilleggVedlegg: teller,
    sheetUtleggVedlegg: teller,
    // O27: sporet etter sletting på PC (tomt).
    slettetFraPc: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
    dailySheet: {
      delete: (...a: unknown[]) => slett(...a),
      // O27: sporet leser eier og dato.
      findUniqueOrThrow: () =>
        Promise.resolve({ clientUuid: SHEET, userId: USER, organizationId: "org", dato: new Date("2026-11-20") }),
    },
  };
  const ctx = {
    userId: USER,
    prismaTimer: {
      // O27: sporet etter sletting på PC (tomt).
      slettetFraPc: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
      dailySheet: {
        findUnique: (...a: unknown[]) => findUnique(...(a as [{ where: { id?: string; clientUuid?: string } }])),
      },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return dagsseddelRouter.createCaller(ctx);
}

describe("dagsseddel.slett — bare utkast", () => {
  beforeEach(() => {
    slett.mockReset();
    findUnique.mockReset();
  });

  it("sletter utkast (draft) — bevart oppførsel", async () => {
    await lagCaller({ status: "draft", attestertVed: null }).slett({ id: SHEET });
    expect(slett).toHaveBeenCalledOnce();
  });

  it("NEKTER sletting av returnert dag som ikke er attestert (S1)", async () => {
    await expect(
      lagCaller({ status: "returned", attestertVed: null }).slett({ id: SHEET }),
    ).rejects.toThrow(/returnert dag kan ikke slettes/);
    expect(slett).not.toHaveBeenCalled();
  });

  it("NEKTER sletting av returnert som ER attestert", async () => {
    await expect(
      lagCaller({ status: "returned", attestertVed: new Date("2026-09-01") }).slett({ id: SHEET }),
    ).rejects.toThrow(/returnert dag kan ikke slettes/);
    expect(slett).not.toHaveBeenCalled();
  });

  it("NEKTER sletting av sendt dagsseddel", async () => {
    await expect(
      lagCaller({ status: "sent", attestertVed: null }).slett({ id: SHEET }),
    ).rejects.toThrow(/Bare utkast kan slettes/);
    expect(slett).not.toHaveBeenCalled();
  });
});
