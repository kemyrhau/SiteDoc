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
 *
 * PLUSS rediger-signalene (ordre arkivmodal-typefilter, TILLEGG 1+3): bunntekstens
 * klikkbare vei krever `rediger`, ikke `les`. 🔴 Negativkontrollens kjerne er at signalene
 * SKILLER — en firmaadmin har `les` på sitedoc men IKKE `rediger`, og en prosjektadmin har
 * `les` på firma men IKKE `rediger`. En test der les og rediger er like for alle roller
 * måler ingenting.
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

// Full matrise (nivå × handling) — speiler autoriserMalTilgang. Rediger er en egen akse
// enn les, som er hele poenget med testen.
type Matrise = {
  firmaLes: boolean;
  firmaRediger: boolean;
  sitedocLes: boolean;
  sitedocRediger: boolean;
};

function settMatrise(m: Matrise) {
  (autoriserMalTilgang as ReturnType<typeof vi.fn>).mockImplementation(
    async (_userId: string, arg: { nivaa: string; handling: string }) => {
      const nokkel = `${arg.nivaa}/${arg.handling}`;
      const ok =
        nokkel === "firma/les"
          ? m.firmaLes
          : nokkel === "firma/rediger"
            ? m.firmaRediger
            : nokkel === "sitedoc/les"
              ? m.sitedocLes
              : nokkel === "sitedoc/rediger"
                ? m.sitedocRediger
                : false;
      if (!ok) throw new Error("FORBIDDEN");
    },
  );
}

// Rollene uttrykt i matrisen (jf. autoriserMalTilgang: firma/rediger = firmaadmin+,
// sitedoc/rediger = kun sitedoc_admin).
const PROSJEKTADMIN: Matrise = {
  firmaLes: true,
  firmaRediger: false,
  sitedocLes: false,
  sitedocRediger: false,
};
const FIRMAADMIN: Matrise = {
  firmaLes: true,
  firmaRediger: true,
  sitedocLes: true,
  sitedocRediger: false,
};
const SITEDOCADMIN: Matrise = {
  firmaLes: true,
  firmaRediger: true,
  sitedocLes: true,
  sitedocRediger: true,
};
const MEDLEM: Matrise = {
  firmaLes: false,
  firmaRediger: false,
  sitedocLes: false,
  sitedocRediger: false,
};

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
    settMatrise(PROSJEKTADMIN);
    const res = await lagCaller().arkivTilgang({ projectId: PROSJEKT });
    expect(res).toEqual({
      kanHenteFraFirma: true,
      kanHenteFraSitedoc: false,
      kanRedigereFirma: false,
      kanRedigereSitedoc: false,
      organizationId: ORG,
    });
  });

  it("(2) firmaadmin: begge faner", async () => {
    settMatrise(FIRMAADMIN);
    const res = await lagCaller().arkivTilgang({ projectId: PROSJEKT });
    expect(res.kanHenteFraFirma).toBe(true);
    expect(res.kanHenteFraSitedoc).toBe(true);
  });

  it("(3) vanlig medlem: ingen faner", async () => {
    settMatrise(MEDLEM);
    const res = await lagCaller().arkivTilgang({ projectId: PROSJEKT });
    expect(res.kanHenteFraFirma).toBe(false);
    expect(res.kanHenteFraSitedoc).toBe(false);
  });

  it("(4) standalone-prosjekt: organizationId = null, kanRedigereFirma = false", async () => {
    settMatrise(FIRMAADMIN);
    const res = await lagCaller(null).arkivTilgang({ projectId: PROSJEKT });
    expect(res.organizationId).toBeNull();
    // Uten eier-firma finnes intet firmaarkiv å redigere — signalet er false uten å spørre matrisen.
    expect(res.kanRedigereFirma).toBe(false);
  });

  // 🔴 Negativkontroll — signalene SKILLER les fra rediger (TILLEGG 3, kjernen).
  it("(5) firmaadmin: kanHenteFraSitedoc SANN, men kanRedigereSitedoc USANN", async () => {
    settMatrise(FIRMAADMIN);
    const res = await lagCaller().arkivTilgang({ projectId: PROSJEKT });
    expect(res.kanHenteFraSitedoc).toBe(true);
    expect(res.kanRedigereSitedoc).toBe(false); // <- ville lovet en låst dør om den var sann
    // Firma-nivået: firmaadmin HAR rediger.
    expect(res.kanRedigereFirma).toBe(true);
  });

  it("(6) prosjektadmin: kanHenteFraFirma SANN, men kanRedigereFirma USANN", async () => {
    settMatrise(PROSJEKTADMIN);
    const res = await lagCaller().arkivTilgang({ projectId: PROSJEKT });
    expect(res.kanHenteFraFirma).toBe(true);
    expect(res.kanRedigereFirma).toBe(false);
  });

  it("(7) sitedoc_admin: rediger på begge nivåer", async () => {
    settMatrise(SITEDOCADMIN);
    const res = await lagCaller().arkivTilgang({ projectId: PROSJEKT });
    expect(res.kanRedigereFirma).toBe(true);
    expect(res.kanRedigereSitedoc).toBe(true);
  });
});
