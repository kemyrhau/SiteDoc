import { describe, it, expect, vi } from "vitest";

/**
 * `firmamal.arkivTilgang` — klient-gate for «Hent fra arkiv»-modalen. Matrisen
 * `autoriserMalTilgang` er ENESTE kilde (ordre hent-fra-arkiv Krav 3). Denne dekker at
 * try/catch-mappingen returnerer riktig per rolle, og at eier-firmaet følger med som mål
 * for `laanFraSentralarkiv`:
 *   (1) prosjektadmin: firma=ja, sitedoc=nei (låst SiteDoc-fane),
 *   (2) firmaadmin: begge ja,
 *   (3) vanlig medlem: begge nei,
 *   (4) standalone-prosjekt (uten eier-firma): organizationId = null.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserMalTilgang: vi.fn(),
  autoriserAdminForFirma: vi.fn(),
  verifiserAdmin: vi.fn(),
  erFirmaAdminForProsjekt: vi.fn(),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));

vi.mock("./mal", () => ({ finnLedigeMalVerdier: vi.fn() }));

import { firmamalRouter } from "./firmamal";
import { autoriserMalTilgang } from "../trpc/tilgangskontroll";

const PROSJEKT = "33333333-3333-3333-3333-333333333333";
const ORG = "22222222-2222-2222-2222-222222222222";

function settTilgang(firma: boolean, sitedoc: boolean) {
  (autoriserMalTilgang as ReturnType<typeof vi.fn>).mockImplementation(
    async (_userId: string, arg: { nivaa: string }) => {
      const ok = arg.nivaa === "firma" ? firma : sitedoc;
      if (!ok) throw new Error("FORBIDDEN");
    },
  );
}

function lagCaller(orgId: string | null = ORG) {
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      project: {
        findUnique: vi.fn().mockResolvedValue({ primaryOrganizationId: orgId }),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return firmamalRouter.createCaller(ctx);
}

describe("firmamal.arkivTilgang", () => {
  it("(1) prosjektadmin: firmaarkiv ja, SiteDoc-arkiv nei", async () => {
    settTilgang(true, false);
    const res = await lagCaller().arkivTilgang({ projectId: PROSJEKT });
    expect(res).toEqual({
      kanHenteFraFirma: true,
      kanHenteFraSitedoc: false,
      organizationId: ORG,
    });
  });

  it("(2) firmaadmin: begge faner", async () => {
    settTilgang(true, true);
    const res = await lagCaller().arkivTilgang({ projectId: PROSJEKT });
    expect(res.kanHenteFraFirma).toBe(true);
    expect(res.kanHenteFraSitedoc).toBe(true);
  });

  it("(3) vanlig medlem: ingen faner", async () => {
    settTilgang(false, false);
    const res = await lagCaller().arkivTilgang({ projectId: PROSJEKT });
    expect(res.kanHenteFraFirma).toBe(false);
    expect(res.kanHenteFraSitedoc).toBe(false);
  });

  it("(4) standalone-prosjekt: organizationId = null", async () => {
    settTilgang(true, false);
    const res = await lagCaller(null).arkivTilgang({ projectId: PROSJEKT });
    expect(res.organizationId).toBeNull();
  });
});
