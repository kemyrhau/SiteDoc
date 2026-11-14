import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Post 2026-11-14 (7) punkt 2 — prosjektisolasjon for eksternKostObjekt.list.
 *
 * En bruker skal aldri få underprosjekter fra et firma han eller hun ikke har
 * tilgang til. Tilgangs-hjelperne mockes med samme kontrakt som de ekte
 * (`resolverOrgFraInput`: kun eget firma, ellers FORBIDDEN; `verifiserProsjektmedlem`:
 * FORBIDDEN utenfor prosjektet). ECO-mocken filtrerer ekte på WHERE, så testen
 * feiler hvis endepunktet henter uten firma-filter.
 */

const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROSJEKT_A = "a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1";
const PROSJEKT_B = "b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1";
const USER_A = "user-a";

const tilgang = vi.hoisted(() => ({
  brukersOrg: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  prosjekter: new Set<string>(["a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1"]),
}));

vi.mock("../trpc/tilgangskontroll", async () => {
  const { TRPCError: Feil } = await import("@trpc/server");
  return {
    krevBrukersOrg: vi.fn(async () => tilgang.brukersOrg),
    resolverOrgFraInput: vi.fn(async (_u: string, inputOrgId?: string) => {
      if (!inputOrgId || inputOrgId === tilgang.brukersOrg) return tilgang.brukersOrg;
      throw new Feil({ code: "FORBIDDEN", message: "Ikke ditt firma" });
    }),
    verifiserProsjektmedlem: vi.fn(async (_u: string, projectId: string) => {
      if (!tilgang.prosjekter.has(projectId)) {
        throw new Feil({ code: "FORBIDDEN", message: "Du er ikke medlem av dette prosjektet" });
      }
    }),
  };
});

import { eksternKostObjektRouter } from "./eksternKostObjekt";

interface Eco {
  id: string;
  organizationId: string;
  projectId: string;
}

const ECOER: Eco[] = [
  { id: "eco-a", organizationId: ORG_A, projectId: PROSJEKT_A },
  { id: "eco-b", organizationId: ORG_B, projectId: PROSJEKT_B },
  // Firma B sitt underprosjekt på firma A sitt prosjekt (kryssfirma).
  { id: "eco-b-paa-a", organizationId: ORG_B, projectId: PROSJEKT_A },
];

const PROSJEKT_FIRMA: Record<string, string> = {
  [PROSJEKT_A]: ORG_A,
  [PROSJEKT_B]: ORG_B,
};

function lagCaller() {
  const ecoFindMany = vi.fn(
    async (args: { where: { organizationId?: string; projectId?: string } }) =>
      ECOER.filter(
        (e) =>
          (args.where.organizationId === undefined ||
            e.organizationId === args.where.organizationId) &&
          (args.where.projectId === undefined || e.projectId === args.where.projectId),
      ),
  );
  const ctx = {
    userId: USER_A,
    prisma: {
      externalCostObject: { findMany: ecoFindMany },
      project: {
        findUnique: vi.fn(async (args: { where: { id: string } }) => ({
          primaryOrganizationId: PROSJEKT_FIRMA[args.where.id] ?? null,
        })),
      },
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocket ctx
  return { caller: eksternKostObjektRouter.createCaller(ctx as any), ecoFindMany };
}

async function feilkode(p: Promise<unknown>): Promise<string | null> {
  return p.then(
    () => null,
    (e: unknown) => (e instanceof TRPCError ? e.code : String(e)),
  );
}

describe("eksternKostObjekt.list — prosjektisolasjon (post (7) punkt 2)", () => {
  beforeEach(() => {
    tilgang.brukersOrg = ORG_A;
    tilgang.prosjekter = new Set([PROSJEKT_A]);
  });

  it("uten input (mobil-cache): kun brukerens firma", async () => {
    const { caller } = lagCaller();
    const r = await caller.list();
    expect(r.map((e) => e.id)).toEqual(["eco-a"]);
  });

  it("eget firma oppgitt: får eget firmas underprosjekter", async () => {
    const { caller } = lagCaller();
    const r = await caller.list({ organizationId: ORG_A, projectId: PROSJEKT_A });
    expect(r.map((e) => e.id)).toEqual(["eco-a"]);
  });

  it("fremmed firma oppgitt: FORBIDDEN, ingen oppslag", async () => {
    const { caller, ecoFindMany } = lagCaller();
    expect(await feilkode(caller.list({ organizationId: ORG_B }))).toBe("FORBIDDEN");
    expect(ecoFindMany).not.toHaveBeenCalled();
  });

  it("prosjekt brukeren ikke har tilgang til: FORBIDDEN, ingen oppslag", async () => {
    const { caller, ecoFindMany } = lagCaller();
    expect(await feilkode(caller.list({ projectId: PROSJEKT_B }))).toBe("FORBIDDEN");
    expect(ecoFindMany).not.toHaveBeenCalled();
  });

  it("kun projectId: firmaet utledes fra prosjektet — fremmed firmas ECO på samme prosjekt kommer ikke med", async () => {
    const { caller, ecoFindMany } = lagCaller();
    const r = await caller.list({ projectId: PROSJEKT_A });
    expect(r.map((e) => e.id)).toEqual(["eco-a"]);
    expect(ecoFindMany.mock.calls[0]![0].where).toMatchObject({
      organizationId: ORG_A,
      projectId: PROSJEKT_A,
    });
  });
});
