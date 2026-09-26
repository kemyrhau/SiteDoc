import { describe, it, expect, vi } from "vitest";

/**
 * «Stille tomhet» krav (c) for `firmamal.oppdater` (ordre prefiks-residual-oppdater):
 * en test som FEILER hvis oppdater kan skrive prefiks til null.
 *
 * Residualen (meldt fra steg 1+2, bestilt her): `oppdater` hadde
 *   ...(input.prefix !== undefined ? { prefix: input.prefix?.trim() || null } : {})
 * → en tom streng fra klienten skrev NULL tilbake over et gyldig prefiks. Backfillen fyller,
 * denne veien tømte igjen. Nå betyr tom/blank «ikke endre», ikke «fjern».
 *
 * RØD først: mot develops firmamal.ts skrev `prefix: ""` → `{ prefix: null }` i update-data.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: vi.fn(),
  autoriserMalTilgang: vi.fn(),
  verifiserAdmin: vi.fn(),
  erFirmaAdminForProsjekt: vi.fn(),
}));
vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));
vi.mock("./mal", () => ({ finnLedigeMalVerdier: vi.fn(), objektIderMedInnhold: vi.fn() }));
vi.mock("./objektkopi", () => ({ kopierObjektTre: vi.fn(), diffObjektTre: vi.fn() }));

import { firmamalRouter } from "./firmamal";

const ORG = "22222222-2222-2222-2222-222222222222";
const MAL = "55555555-5555-5555-5555-555555555555";

function lagCtx(oppdaterData: Record<string, unknown>[]) {
  return {
    userId: "u1",
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    prisma: {
      organizationTemplate: {
        findFirst: vi.fn().mockResolvedValue({ id: MAL, organizationId: ORG }),
        update: vi.fn(async (a: { data: Record<string, unknown> }) => {
          oppdaterData.push(a.data);
          return { id: MAL };
        }),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("firmamal.oppdater — prefiks kan aldri tømmes til null", () => {
  it("tom streng → prefiks IKKE i update-data (RØD før fix: skrev null)", async () => {
    const data: Record<string, unknown>[] = [];
    await firmamalRouter.createCaller(lagCtx(data)).oppdater({ id: MAL, prefix: "" });
    expect(Object.prototype.hasOwnProperty.call(data[0], "prefix")).toBe(false);
  });

  it("bare mellomrom → prefiks IKKE i update-data", async () => {
    const data: Record<string, unknown>[] = [];
    await firmamalRouter.createCaller(lagCtx(data)).oppdater({ id: MAL, prefix: "   " });
    expect(Object.prototype.hasOwnProperty.call(data[0], "prefix")).toBe(false);
  });

  it("ekte prefiks → skrives trimmet (endring virker fortsatt)", async () => {
    const data: Record<string, unknown>[] = [];
    await firmamalRouter.createCaller(lagCtx(data)).oppdater({ id: MAL, prefix: "  KX9  " });
    expect(data[0]?.prefix).toBe("KX9");
  });

  it("prefiks utelatt → prefiks IKKE i update-data (uendret), andre felt går gjennom", async () => {
    const data: Record<string, unknown>[] = [];
    await firmamalRouter.createCaller(lagCtx(data)).oppdater({ id: MAL, name: "Nytt navn" });
    expect(Object.prototype.hasOwnProperty.call(data[0], "prefix")).toBe(false);
    expect(data[0]?.name).toBe("Nytt navn");
  });
});
