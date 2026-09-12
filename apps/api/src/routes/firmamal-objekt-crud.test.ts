import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `firmamal.*` objekt-CRUD (MalBygger i firma-modus) + prosjektadmins lesetilgang.
 *
 * Ordre malbygger-tre-nivaa (Krav 1/2) + TILLEGG 1. Dekker det som MÅ holde:
 *   (1) leggTilObjekt/oppdaterObjekt/oppdaterRekkefolge/slettObjekt skriver mot
 *       OrganizationTemplateObject og går gjennom matrisen (firma + rediger),
 *   (2) slettObjekt har INGEN slett-vern (firmamal-objekter bærer ingen dokumenter) —
 *       den sletter uten en eneste bruks-sjekk,
 *   (3) en skrivevei nektes når matrisen avviser (prosjektadmin uten firma-admin),
 *   (4) FIRMAGRENSE: listeForProsjekt returnerer KUN prosjektets egne firma-org-ider —
 *       en prosjektadmin i firma A ser aldri firma B (org-filteret ekskluderer B).
 *
 * `autoriserMalTilgang` mockes her (dispatch-logikken har egen test i
 * tilgangskontroll-matrise). Vi verifiserer at den kalles med RIKTIG (nivaa, handling).
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserMalTilgang: vi.fn().mockResolvedValue(undefined),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  erFirmaAdminForProsjekt: vi.fn(),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));
vi.mock("./mal", () => ({ finnLedigeMalVerdier: vi.fn() }));

import { firmamalRouter } from "./firmamal";
import { autoriserMalTilgang } from "../trpc/tilgangskontroll";

const MAL = "11111111-1111-1111-1111-111111111111";
const OBJ = "33333333-3333-3333-3333-333333333333";
const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROJ = "22222222-2222-2222-2222-222222222222";

function lagCaller(prisma: unknown) {
  const ctx = {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return firmamalRouter.createCaller(ctx);
}

beforeEach(() => {
  vi.mocked(autoriserMalTilgang).mockReset().mockResolvedValue(undefined);
});

describe("firmamal objekt-CRUD", () => {
  it("(1) leggTilObjekt skriver OrganizationTemplateObject + går gjennom matrisen (firma+rediger)", async () => {
    const prisma = {
      organizationTemplate: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ organizationId: ORG_A }),
      },
      organizationTemplateObject: {
        create: vi.fn().mockResolvedValue({ id: OBJ }),
      },
    };
    await lagCaller(prisma).leggTilObjekt({
      templateId: MAL,
      type: "text_field",
      label: "Kommentar",
      config: { zone: "datafelter" },
      sortOrder: 0,
      required: false,
      parentId: null,
    });

    expect(autoriserMalTilgang).toHaveBeenCalledWith("user-1", {
      nivaa: "firma",
      handling: "rediger",
      organizationId: ORG_A,
    });
    const call = prisma.organizationTemplateObject.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.templateId).toBe(MAL);
    expect(call.data.type).toBe("text_field");
    expect(call.data.label).toBe("Kommentar");
  });

  it("(2) slettObjekt sletter UTEN slett-vern (ingen bruks-sjekk)", async () => {
    const prisma = {
      organizationTemplateObject: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ templateId: MAL }),
        delete: vi.fn().mockResolvedValue({ id: OBJ }),
      },
      organizationTemplate: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ organizationId: ORG_A }),
      },
      // Skulle en dokument-tabell blitt spurt (feilaktig lås), fanges det her.
      checklist: { count: vi.fn(), findMany: vi.fn() },
      task: { count: vi.fn(), findMany: vi.fn() },
    };
    await lagCaller(prisma).slettObjekt({ id: OBJ });

    expect(prisma.organizationTemplateObject.delete).toHaveBeenCalledWith({ where: { id: OBJ } });
    // Ingen dokument-oppslag: firmamalen er fritt redigerbar (Krav 2).
    expect(prisma.checklist.count).not.toHaveBeenCalled();
    expect(prisma.task.count).not.toHaveBeenCalled();
  });

  it("(3) skrivevei nektes når matrisen avviser (prosjektadmin uten firma-admin)", async () => {
    vi.mocked(autoriserMalTilgang).mockRejectedValueOnce(
      Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" }),
    );
    const prisma = {
      organizationTemplate: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ organizationId: ORG_A }),
      },
      organizationTemplateObject: { create: vi.fn() },
    };
    await expect(
      lagCaller(prisma).leggTilObjekt({
        templateId: MAL,
        type: "text_field",
        label: "X",
        config: {},
        sortOrder: 0,
        required: false,
        parentId: null,
      }),
    ).rejects.toThrow();
    // Vakten avviste FØR skriving — ingenting opprettes.
    expect(prisma.organizationTemplateObject.create).not.toHaveBeenCalled();
  });
});

describe("firmamal.listeForProsjekt — firmagrense", () => {
  it("(4) returnerer KUN prosjektets egne firma-org-ider (firma A ser ikke firma B)", async () => {
    const prisma = {
      project: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ primaryOrganizationId: ORG_A }),
      },
      projectOrganization: { findMany: vi.fn().mockResolvedValue([]) },
      organizationTemplate: { findMany: vi.fn().mockResolvedValue([]) },
    };
    await lagCaller(prisma).listeForProsjekt({ projectId: PROJ });

    // Lesingen går gjennom matrisen som firma+les via prosjektet (TILLEGG 1).
    expect(autoriserMalTilgang).toHaveBeenCalledWith("user-1", {
      nivaa: "firma",
      handling: "les",
      viaProjectId: PROJ,
    });
    // Org-filteret inneholder KUN prosjektets eget firma — ORG_B er ekskludert.
    const findManyArg = prisma.organizationTemplate.findMany.mock.calls[0]![0] as {
      where: { organizationId: { in: string[] } };
    };
    expect(findManyArg.where.organizationId.in).toEqual([ORG_A]);
    expect(findManyArg.where.organizationId.in).not.toContain(ORG_B);
  });
});
