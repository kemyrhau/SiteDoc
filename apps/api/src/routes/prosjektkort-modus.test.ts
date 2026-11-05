import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Prosjektkort L1 (2026-11-05) — firmaets visningsmodus for timeføring.
 *
 * Låser: (1) `hentArbeidstidDefaults` leverer `timerRegistreringsmodus` til en
 * vanlig ansatt (web-sedelen leser modusen derfra), (2) `oppdaterSetting`
 * lagrer modusen bak firma-admin-porten, (3) ikke-admin avvises og ingenting
 * skrives, (4) ukjent modus avvises av Zod.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: vi.fn(),
  harFirmaHmsTilgang: vi.fn(),
  hentBrukersOrg: vi.fn(),
  verifiserOrganisasjonTilgang: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {} }));

import { organisasjonRouter } from "./organisasjon";
import {
  autoriserAdminForFirma,
  verifiserOrganisasjonTilgang,
} from "../trpc/tilgangskontroll";

const ORG = "11111111-1111-1111-1111-111111111111";
const BRUKER = "22222222-2222-2222-2222-222222222222";

function lagCtx(lagret: Record<string, unknown> = {}) {
  const upsert = vi.fn().mockImplementation(async (args: { select?: unknown; update?: object }) => {
    if (args.select) return { timerRegistreringsmodus: "dagskort", ...lagret };
    return { organizationId: ORG, ...args.update };
  });
  const ctx = {
    userId: BRUKER,
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma: {
      organizationSetting: {
        upsert,
        findUnique: vi.fn().mockResolvedValue({ reiseTerskelEnhet: "minutter" }),
      },
      organizationReiseGrense: { findMany: vi.fn().mockResolvedValue([]) },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { ctx, upsert };
}

beforeEach(() => {
  vi.mocked(autoriserAdminForFirma).mockReset();
});

describe("timerRegistreringsmodus — lesing", () => {
  it("hentArbeidstidDefaults selekterer og leverer modusen til en vanlig ansatt", async () => {
    const { ctx, upsert } = lagCtx({ timerRegistreringsmodus: "prosjektkort" });
    const res = await organisasjonRouter
      .createCaller(ctx)
      .hentArbeidstidDefaults({ organizationId: ORG });
    expect(verifiserOrganisasjonTilgang).toHaveBeenCalledWith(BRUKER, ORG);
    expect(upsert.mock.calls[0]![0].select.timerRegistreringsmodus).toBe(true);
    expect(res.timerRegistreringsmodus).toBe("prosjektkort");
  });
});

describe("timerRegistreringsmodus — skriving", () => {
  it("firma-admin lagrer prosjektkort", async () => {
    vi.mocked(autoriserAdminForFirma).mockResolvedValue(undefined as never);
    const { ctx, upsert } = lagCtx();
    await organisasjonRouter
      .createCaller(ctx)
      .oppdaterSetting({ organizationId: ORG, timerRegistreringsmodus: "prosjektkort" });
    expect(autoriserAdminForFirma).toHaveBeenCalledWith(BRUKER, ORG);
    const arg = upsert.mock.calls[0]![0];
    expect(arg.update).toEqual({ timerRegistreringsmodus: "prosjektkort" });
    expect(arg.create).toEqual({ organizationId: ORG, timerRegistreringsmodus: "prosjektkort" });
  });

  it("ikke-admin avvises og ingenting skrives", async () => {
    vi.mocked(autoriserAdminForFirma).mockRejectedValue(
      new TRPCError({ code: "FORBIDDEN", message: "Ikke firma-admin" }),
    );
    const { ctx, upsert } = lagCtx();
    await expect(
      organisasjonRouter
        .createCaller(ctx)
        .oppdaterSetting({ organizationId: ORG, timerRegistreringsmodus: "prosjektkort" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("ukjent modus avvises av validering", async () => {
    vi.mocked(autoriserAdminForFirma).mockResolvedValue(undefined as never);
    const { ctx, upsert } = lagCtx();
    await expect(
      organisasjonRouter.createCaller(ctx).oppdaterSetting({
        organizationId: ORG,
        // @ts-expect-error — ugyldig verdi er poenget
        timerRegistreringsmodus: "ukeskort",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(upsert).not.toHaveBeenCalled();
  });
});
