import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * F13c-2 punkt 3 (Kenneth 2026-11-23): «kontrollplanen er for prosjektadmin. et vanlig medlem
 * skal kun kunne utføre en sjekkliste som allerede er i kontrollplanen».
 *
 *  - Alle mutasjoner som endrer selve planen krever verifiserAdmin → vanlig medlem får FORBIDDEN.
 *    Import = `opprettPunkter` (med importKilde) og `anvendRevisjon`.
 *  - Utføring er urørt: `koblePunkt` slipper vanlig medlem gjennom, og «Start»
 *    (`sjekkliste.opprett` med kontrollplanPunktId) bruker ikke verifiserAdmin.
 *
 * Portene er stubbet: «vanlig» passerer verifiserProsjektmedlem men ikke verifiserAdmin.
 *
 * Kjør: cd apps/api && npx vitest run src/routes/f13c2-kontrollplan-admin.test.ts
 */

vi.mock("../trpc/tilgangskontroll", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../trpc/tilgangskontroll")>()),
  verifiserProsjektmedlem: vi.fn(async () => undefined),
  verifiserAdmin: vi.fn(async (userId: string) => {
    if (userId === "vanlig") {
      const { TRPCError: Feil } = await import("@trpc/server");
      throw new Feil({ code: "FORBIDDEN", message: "Kun administratorer kan utføre denne handlingen" });
    }
  }),
}));
vi.mock("../services/kontrollplanKobling", () => ({
  koblePunktTilSjekkliste: vi.fn(async () => undefined),
}));
vi.mock("../services/tegningVakt", () => ({
  verifiserTegningIProsjekt: vi.fn(async () => undefined),
}));

import { kontrollplanRouter } from "./kontrollplan";

const PROSJEKT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const BYGGEPLASS = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MAL = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const FAGGRUPPE = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const SJEKKLISTE = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

function lagPrisma() {
  const medProsjekt = vi.fn(async () => ({
    id: "x",
    projectId: PROSJEKT,
    status: "utkast",
    kontrollplan: { projectId: PROSJEKT },
    sjekkliste: null,
  }));
  const tx = {
    kontrollplanPunkt: { findUniqueOrThrow: vi.fn(async () => ({ id: "punkt-1" })) },
  };
  return {
    kontrollplan: { findUniqueOrThrow: medProsjekt },
    kontrollplanPunkt: { findUniqueOrThrow: medProsjekt },
    milepel: { findUniqueOrThrow: medProsjekt },
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  };
}

function caller(userId: string) {
  return kontrollplanRouter.createCaller({
    userId,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: lagPrisma(),
  } as unknown as Parameters<typeof kontrollplanRouter.createCaller>[0]);
}

async function kode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "OK";
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
}

const v = () => caller("vanlig");

describe("F13c-2 — kontrollplanen endres bare av prosjektadmin", () => {
  it("🔴 import av fremdriftsplan (opprettPunkter med importKilde) avvises for vanlig medlem", async () => {
    expect(
      await kode(
        v().opprettPunkter({
          kontrollplanId: "plan-1",
          sjekklisteMalId: MAL,
          faggruppeId: FAGGRUPPE,
          punkter: [{ omradeId: null, importTaskUid: 1, importNavn: "Rad 1" }],
          importKilde: { filnavn: "plan.xml", antallParsedeRader: 1, hoppetOver: [] },
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("🔴 revisjon fra fremdriftsplan (anvendRevisjon) avvises for vanlig medlem", async () => {
    expect(
      await kode(
        v().anvendRevisjon({ kontrollplanId: "plan-1", filnavn: "plan.xml", antallParsedeRader: 1 }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("🔴 planendringer avvises for vanlig medlem", async () => {
    const c = v();
    const resultater = {
      opprettEllerHent: await kode(c.opprettEllerHent({ projectId: PROSJEKT, byggeplassId: BYGGEPLASS })),
      oppdaterPunkt: await kode(c.oppdaterPunkt({ punktId: "punkt-1", fristUke: 10, fristAar: 2027 })),
      slettPunkt: await kode(c.slettPunkt({ punktId: "punkt-1" })),
      settPunktPlassering: await kode(
        c.settPunktPlassering({ punktId: "punkt-1", drawingId: null, positionX: null, positionY: null }),
      ),
      opprettMilepel: await kode(c.opprettMilepel({ kontrollplanId: "plan-1", navn: "M1", maalUke: 10, maalAar: 2027 })),
      oppdaterMilepel: await kode(c.oppdaterMilepel({ milepelId: "m-1", navn: "M2" })),
      slettMilepel: await kode(c.slettMilepel({ milepelId: "m-1" })),
      oppdaterStatus: await kode(c.oppdaterStatus({ kontrollplanId: "plan-1", status: "aktiv" })),
      skyvOmrade: await kode(
        c.skyvOmrade({ kontrollplanId: "plan-1", omradeId: "o-1", antallUker: 1 }),
      ),
      kopierPunkter: await kode(
        c.kopierPunkter({ kontrollplanId: "plan-1", kildeOmradeIder: ["a"], maalOmradeIder: ["b"], fristForskyvningUker: 0 }),
      ),
      skyvKaskade: await kode(
        c.skyvKaskade({ punktId: "punkt-1", antallUker: 1 }),
      ),
    };
    for (const [navn, k] of Object.entries(resultater)) {
      expect({ navn, k }).toEqual({ navn, k: "FORBIDDEN" });
    }
  });

  it("🟢 utføring: vanlig medlem kan koble en sjekkliste til et punkt i planen", async () => {
    expect(await kode(v().koblePunkt({ punktId: "punkt-1", sjekklisteId: SJEKKLISTE }))).toBe("OK");
  });

  it("🟢 utføring: «Start» (sjekkliste.opprett med kontrollplanPunktId) krever ikke prosjektadmin", () => {
    const kilde = readFileSync(resolve(__dirname, "sjekkliste.ts"), "utf8");
    const start = kilde.indexOf("  opprett: protectedProcedure");
    const slutt = kilde.indexOf("\n  }),", start);
    expect(start).toBeGreaterThan(-1);
    const opprett = kilde.slice(start, slutt);
    expect(opprett).toContain("kontrollplanPunktId");
    expect(opprett).not.toContain("verifiserAdmin(");
  });
});
