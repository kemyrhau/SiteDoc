import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Vei C del 2 (ordre malbygger-sitedoc-niva, Krav 4) — PARITETSBEVIS.
 *
 * Gate-kriteriet Kenneth ba om: at sitedoc-nivået (`bibliotek.*`) gjør DET SAMME som
 * firmanivået (`firmamal.*`) mot samme objekt-form, for hver av de fem MalBygger-
 * operasjonene: legg til · oppdater · flytt (rekkefølge) · slett · oppdater mal.
 *
 * Testen kjører SAMME logiske input gjennom BEGGE routere og sammenligner payloaden som
 * skrives til objekt-tabellen (BibliotekMalObjekt vs OrganizationTemplateObject). Der de
 * er identiske er nivåene like; der de avviker (metadata-kolonnene på malen) er avviket
 * meldt (BibliotekMal mangler subjects/showX — ingen skjemaendring denne runden).
 *
 * Gatene mockes/oppfylles: firma via `autoriserMalTilgang` (mock), sitedoc via
 * `verifiserSiteDocAdmin` (leser ctx.prisma.user → sitedoc_admin).
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserMalTilgang: vi.fn().mockResolvedValue(undefined),
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
  erFirmaAdminForProsjekt: vi.fn(),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));
vi.mock("./mal", () => ({ finnLedigeMalVerdier: vi.fn() }));

import { firmamalRouter } from "./firmamal";
import { bibliotekRouter } from "./bibliotek";

const MAL = "11111111-1111-1111-1111-111111111111";
const OBJ = "33333333-3333-3333-3333-333333333333";
const OBJ2 = "44444444-4444-4444-4444-444444444444";
const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function lagCtx(prisma: unknown) {
  return {
    userId: "user-1",
    tokenKilde: null,
    sessionToken: null,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    nyttSessionTokenForRespons: { value: null },
    prisma,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
const firma = (prisma: unknown) => firmamalRouter.createCaller(lagCtx(prisma));
const sitedoc = (prisma: unknown) => bibliotekRouter.createCaller(lagCtx(prisma));

// Sitedoc-gaten (verifiserSiteDocAdmin) leser ctx.prisma.user.findUnique → sitedoc_admin.
const sitedocAdminBruker = { findUnique: vi.fn().mockResolvedValue({ role: "sitedoc_admin" }) };

beforeEach(() => {
  sitedocAdminBruker.findUnique.mockClear().mockResolvedValue({ role: "sitedoc_admin" });
});

const INPUT_LEGG_TIL = {
  templateId: MAL,
  type: "text_field" as const,
  label: "Kommentar",
  config: { zone: "datafelter" },
  sortOrder: 0,
  required: false,
  parentId: null,
};

function fangCreateData(mock: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  return (mock.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
}

describe("(1) leggTilObjekt — sitedoc = firma mot samme objekt-form", () => {
  it("begge skriver identisk type/label/config/sortOrder/required/parentId", async () => {
    const firmaPrisma = {
      organizationTemplate: { findUniqueOrThrow: vi.fn().mockResolvedValue({ organizationId: ORG_A }) },
      organizationTemplateObject: { create: vi.fn().mockResolvedValue({ id: OBJ }) },
    };
    const sitedocPrisma = {
      user: sitedocAdminBruker,
      bibliotekMal: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: MAL }) },
      bibliotekMalObjekt: { create: vi.fn().mockResolvedValue({ id: OBJ }) },
    };

    await firma(firmaPrisma).leggTilObjekt(INPUT_LEGG_TIL);
    await sitedoc(sitedocPrisma).leggTilObjekt(INPUT_LEGG_TIL);

    const f = fangCreateData(firmaPrisma.organizationTemplateObject.create);
    const s = fangCreateData(sitedocPrisma.bibliotekMalObjekt.create);
    for (const felt of ["templateId", "type", "label", "config", "sortOrder", "required", "parentId"]) {
      expect(s[felt]).toEqual(f[felt]);
    }
    // Sitedoc-gaten ble faktisk sjekket (sitedoc_admin).
    expect(sitedocAdminBruker.findUnique).toHaveBeenCalled();
  });
});

describe("(2) oppdaterObjekt — sitedoc = firma", () => {
  it("begge oppdaterer samme felt-payload mot sitt objekt-bord", async () => {
    const inp = { id: OBJ, label: "Ny etikett", required: true, config: { zone: "datafelter", helpText: "x" } };
    const firmaPrisma = {
      organizationTemplateObject: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ templateId: MAL }),
        update: vi.fn().mockResolvedValue({ id: OBJ }),
      },
      organizationTemplate: { findUniqueOrThrow: vi.fn().mockResolvedValue({ organizationId: ORG_A }) },
    };
    const sitedocPrisma = {
      user: sitedocAdminBruker,
      bibliotekMalObjekt: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: OBJ }),
        update: vi.fn().mockResolvedValue({ id: OBJ }),
      },
    };

    await firma(firmaPrisma).oppdaterObjekt(inp);
    await sitedoc(sitedocPrisma).oppdaterObjekt(inp);

    const f = (firmaPrisma.organizationTemplateObject.update.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    const s = (sitedocPrisma.bibliotekMalObjekt.update.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(s.label).toEqual(f.label);
    expect(s.required).toEqual(f.required);
    expect(s.config).toEqual(f.config);
  });
});

describe("(3) oppdaterRekkefolge — sitedoc = firma (flytt)", () => {
  it("begge skriver sortOrder for hvert objekt i en transaksjon", async () => {
    const inp = {
      objekter: [
        { id: OBJ, sortOrder: 1, parentId: null },
        { id: OBJ2, sortOrder: 0, parentId: null },
      ],
    };
    const lagTxPrisma = (objBord: string) => {
      const update = vi.fn().mockResolvedValue({ id: OBJ });
      const tx = { [objBord]: { update, findUniqueOrThrow: vi.fn() } };
      return {
        update,
        // $transaction kjører callbacken med tx-objektet.
        $transaction: vi.fn().mockImplementation((cb: (t: unknown) => unknown) => cb(tx)),
      };
    };
    const firmaTx = lagTxPrisma("organizationTemplateObject");
    const firmaPrisma = {
      organizationTemplateObject: { findUniqueOrThrow: vi.fn().mockResolvedValue({ templateId: MAL }) },
      organizationTemplate: { findUniqueOrThrow: vi.fn().mockResolvedValue({ organizationId: ORG_A }) },
      $transaction: firmaTx.$transaction,
    };
    const sitedocTx = lagTxPrisma("bibliotekMalObjekt");
    const sitedocPrisma = {
      user: sitedocAdminBruker,
      $transaction: sitedocTx.$transaction,
    };

    await firma(firmaPrisma).oppdaterRekkefolge(inp);
    await sitedoc(sitedocPrisma).oppdaterRekkefolge(inp);

    expect(firmaTx.update).toHaveBeenCalledTimes(2);
    expect(sitedocTx.update).toHaveBeenCalledTimes(2);
    // Samme sortOrder-payload for begge (første objekt → sortOrder 1).
    const fFørste = (firmaTx.update.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    const sFørste = (sitedocTx.update.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(sFørste.sortOrder).toEqual(fFørste.sortOrder);
  });
});

describe("(4) slettObjekt — sitedoc = firma, ingen slett-vern", () => {
  it("begge sletter uten en eneste dokument-bruks-sjekk", async () => {
    const firmaPrisma = {
      organizationTemplateObject: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ templateId: MAL }),
        delete: vi.fn().mockResolvedValue({ id: OBJ }),
      },
      organizationTemplate: { findUniqueOrThrow: vi.fn().mockResolvedValue({ organizationId: ORG_A }) },
      checklist: { count: vi.fn(), findMany: vi.fn() },
      task: { count: vi.fn(), findMany: vi.fn() },
    };
    const sitedocPrisma = {
      user: sitedocAdminBruker,
      bibliotekMalObjekt: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: OBJ }),
        delete: vi.fn().mockResolvedValue({ id: OBJ }),
      },
      checklist: { count: vi.fn(), findMany: vi.fn() },
      task: { count: vi.fn(), findMany: vi.fn() },
    };

    await firma(firmaPrisma).slettObjekt({ id: OBJ });
    await sitedoc(sitedocPrisma).slettObjekt({ id: OBJ });

    expect(firmaPrisma.organizationTemplateObject.delete).toHaveBeenCalledWith({ where: { id: OBJ } });
    expect(sitedocPrisma.bibliotekMalObjekt.delete).toHaveBeenCalledWith({ where: { id: OBJ } });
    // Ingen dokument-oppslag på noen av nivåene (objektene bærer ingen dokumentdata).
    expect(sitedocPrisma.checklist.count).not.toHaveBeenCalled();
    expect(sitedocPrisma.task.count).not.toHaveBeenCalled();
  });
});

describe("(5) oppdater mal — navnendring virker på begge", () => {
  it("firma skriver name, sitedoc skriver navn (samme handling, ulik kolonne = meldt avvik)", async () => {
    const firmaPrisma = {
      organizationTemplate: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: MAL, organizationId: ORG_A }),
        update: vi.fn().mockResolvedValue({ id: MAL }),
      },
    };
    const sitedocPrisma = {
      user: sitedocAdminBruker,
      bibliotekMal: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: MAL }),
        update: vi.fn().mockResolvedValue({ id: MAL }),
      },
    };

    await firma(firmaPrisma).oppdater({ id: MAL, name: "Nytt navn" });
    await sitedoc(sitedocPrisma).oppdater({ id: MAL, name: "Nytt navn" });

    const f = (firmaPrisma.organizationTemplate.update.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    const s = (sitedocPrisma.bibliotekMal.update.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(f.name).toBe("Nytt navn");
    expect(s.navn).toBe("Nytt navn");
  });
});

describe("gate — sitedoc-objekt-CRUD krever sitedoc_admin", () => {
  it("ikke-admin avvises FØR skriving", async () => {
    const sitedocPrisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ role: "company_admin" }) },
      bibliotekMal: { findUniqueOrThrow: vi.fn() },
      bibliotekMalObjekt: { create: vi.fn() },
    };
    await expect(sitedoc(sitedocPrisma).leggTilObjekt(INPUT_LEGG_TIL)).rejects.toThrow();
    expect(sitedocPrisma.bibliotekMalObjekt.create).not.toHaveBeenCalled();
  });
});
