import { describe, it, expect, vi } from "vitest";

/**
 * Avstandsbånd på mobil (2026-09-11) — server-halvdelen av koblingen.
 *
 * Mobilens offline-resolver leser firmaets grensepunkter fra en lokal katalog
 * (`reise_grensepunkt_local`) som fylles av `refreshReiseGrensepunktKatalog`,
 * som igjen pull-er `organisasjon.hentArbeidstidDefaults` (member-lesbart T4-d-
 * subsett — IKKE firma-admin-`hentSetting`). Denne testen låser at prosedyren
 * FAKTISK leverer `reiseGrenser` til en vanlig ansatt.
 *
 * 🔴 «Stille tomhet»-vakt for SERVER-seamen: faller `reiseGrenser` ut av
 * `hentArbeidstidDefaults`, fødes mobilens katalog tom selv om firmaet HAR bånd
 * → reisen havner på feil lønnsart. Da FEILER testen under. (Katalog→resolver-
 * seamen på mobil har ingen test-harness i repoet — se meldingen i ordre-svaret;
 * resolver-logikken er dekket av `packages/shared` `reise.test.ts`.)
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: vi.fn(),
  harFirmaHmsTilgang: vi.fn(),
  hentBrukersOrg: vi.fn(),
  verifiserOrganisasjonTilgang: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {} }));

import { organisasjonRouter } from "./organisasjon";
import { verifiserOrganisasjonTilgang } from "../trpc/tilgangskontroll";

const ORG = "11111111-1111-1111-1111-111111111111";
const ANSATT = "22222222-2222-2222-2222-222222222222";

/** Ctx med prisma-stubb: setting-upsert + grensepunkt-findMany. */
function lagCtx(grenser: { grenseM: number; lonnsartId: string | null }[]) {
  const findMany = vi.fn().mockResolvedValue(grenser);
  const ctx = {
    userId: ANSATT,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      organizationSetting: {
        upsert: vi.fn().mockResolvedValue({
          standardStartTid: "07:00",
          standardSluttTid: "15:00",
          standardPauseMin: 30,
          standardPauseEtterTimer: 4,
          standardPauseFra: null,
          tillattRedigerVedAttestering: true,
          tidsrundingMinutter: 15,
          arbeidstidVarselTimer: 13,
          reiseTerskelMin: 30,
          reiseTerskelEnhet: "km",
          reiseTerskelM: 7500,
          reiseUnderTerskelType: "arbeidstid",
          reiseOverTerskelType: "reisetid",
          reisetidTellerOvertid: false,
          reiseLonnsartId: null,
        }),
      },
      organizationReiseGrense: { findMany },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, findMany };
}

describe("hentArbeidstidDefaults — avstandsbånd for mobil", () => {
  it("leverer reiseGrenser til en vanlig ansatt (member-tilgang, ikke firma-admin)", async () => {
    const { ctx } = lagCtx([
      { grenseM: 7500, lonnsartId: "art-7-15" },
      { grenseM: 15000, lonnsartId: "art-15-30" },
    ]);
    const res = await organisasjonRouter
      .createCaller(ctx)
      .hentArbeidstidDefaults({ organizationId: ORG });
    // Gikk gjennom member-porten, ikke firma-admin.
    expect(verifiserOrganisasjonTilgang).toHaveBeenCalledWith(ANSATT, ORG);
    expect(res.reiseGrenser).toEqual([
      { grenseM: 7500, lonnsartId: "art-7-15" },
      { grenseM: 15000, lonnsartId: "art-15-30" },
    ]);
  });

  it("henter grensepunktene org-isolert og sortert stigende (oppslaget «største ≤ avstand»)", async () => {
    const { ctx, findMany } = lagCtx([]);
    await organisasjonRouter
      .createCaller(ctx)
      .hentArbeidstidDefaults({ organizationId: ORG });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG },
        orderBy: { grenseM: "asc" },
      }),
    );
  });

  it("REGRESJON: firma uten bånd → reiseGrenser = [] (uendret oppførsel)", async () => {
    const { ctx } = lagCtx([]);
    const res = await organisasjonRouter
      .createCaller(ctx)
      .hentArbeidstidDefaults({ organizationId: ORG });
    expect(res.reiseGrenser).toEqual([]);
    // Arbeidstid-defaults leveres fortsatt (ingen regresjon i det gamle subsettet).
    expect(res.standardStartTid).toBe("07:00");
  });
});
