import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Post 2026-11-14 (7) punkt 3 — maskin.equipment.list med sedelens firma.
 *
 * Timer-sedelen sender nå `organizationId` til maskin-katalogen. Før krevde en
 * oppgitt firma-ID firmaadmin, så en vanlig ansatt ville fått FORBIDDEN på egen
 * sedel. `list` godtar derfor brukerens EGET firma (samme resultat som uten
 * input); fremmed firma er fortsatt FORBIDDEN, og skrive-stiene (`opprett`)
 * er uendret: oppgitt firma krever fortsatt firmaadmin.
 */

const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const tilgang = vi.hoisted(() => ({ admin: false, brukersOrg: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }));

vi.mock("@sitedoc/db", () => ({ prisma: {} }));

vi.mock("../../trpc/tilgangskontroll", async () => {
  const { TRPCError: Feil } = await import("@trpc/server");
  return {
    // Ekte kontrakt: sitedoc_admin/firmaadmin slipper gjennom, ellers FORBIDDEN.
    autoriserAdminForFirma: vi.fn(async () => {
      if (!tilgang.admin) throw new Feil({ code: "FORBIDDEN", message: "Krever firmaadmin" });
    }),
    hentBrukersOrg: vi.fn(async () => tilgang.brukersOrg),
    krevBrukersOrg: vi.fn(async () => tilgang.brukersOrg),
  };
});

vi.mock("../../services/maskin", () => ({
  forhandsvisningSynkron: vi.fn(),
  extractKjennemerke: vi.fn(),
  parseForhandsvisning: vi.fn(),
  krevMaskinAktivert: vi.fn(),
  VegvesenIkkeFunnetError: class extends Error {},
  VegvesenRateLimitError: class extends Error {},
  VegvesenApiNokkelMangler: class extends Error {},
}));

import { equipmentRouter } from "./equipment";

function lagCaller() {
  const findMany = vi.fn(async (args: { where: { organizationId: string } }) => [
    { id: `maskin-${args.where.organizationId}` },
  ]);
  const create = vi.fn(async () => ({ id: "ny" }));
  const ctx = {
    userId: "bruker-1",
    prismaMaskin: { equipment: { findMany, create } },
    req: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocket ctx
  return { caller: equipmentRouter.createCaller(ctx as any), findMany, create };
}

async function feilkode(p: Promise<unknown>): Promise<string | null> {
  return p.then(
    () => null,
    (e: unknown) => (e instanceof TRPCError ? e.code : String(e)),
  );
}

describe("maskin.equipment.list — sedelens firma (post (7) punkt 3)", () => {
  beforeEach(() => {
    tilgang.admin = false;
    tilgang.brukersOrg = ORG_A;
  });

  it("vanlig ansatt med eget firma: får eget firmas maskiner", async () => {
    const { caller, findMany } = lagCaller();
    await caller.list({ organizationId: ORG_A });
    expect(findMany.mock.calls[0]![0].where.organizationId).toBe(ORG_A);
  });

  it("vanlig ansatt med fremmed firma: FORBIDDEN, ingen oppslag", async () => {
    const { caller, findMany } = lagCaller();
    expect(await feilkode(caller.list({ organizationId: ORG_B }))).toBe("FORBIDDEN");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("firmaadmin/sitedoc_admin med valgt firma: slipper gjennom", async () => {
    tilgang.admin = true;
    const { caller, findMany } = lagCaller();
    await caller.list({ organizationId: ORG_B });
    expect(findMany.mock.calls[0]![0].where.organizationId).toBe(ORG_B);
  });

  it("skrive-stien er uendret: opprett med eget firma krever fortsatt firmaadmin", async () => {
    const { caller, create } = lagCaller();
    const kode = await feilkode(
      caller.opprett({
        organizationId: ORG_A,
        kategori: "kjoretoy",
        type: "Lastebil",
        merke: "Volvo",
        modell: "FH",
      }),
    );
    expect(kode).toBe("FORBIDDEN");
    expect(create).not.toHaveBeenCalled();
  });
});
