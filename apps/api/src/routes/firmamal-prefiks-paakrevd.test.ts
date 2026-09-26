import { describe, it, expect, vi } from "vitest";

/**
 * «Stille tomhet» krav (c) for prefiks (ordre prefiks-påkrevd §E): tester som FEILER når en
 * mal opprettes uten prefiks. Alle tre var RØDE mot origin/develop før §B/§C — bevist ved å
 * kjøre dem mot den ustashede firmamal.ts.
 *
 * Rotårsaken (designs måling 2): `firmamal.ts` bibliotek→firmamal satte aldri prefiks, mens
 * bibliotek→prosjektmal gjorde det. Samme kilde, to destinasjoner, én mistet prefikset.
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
// @sitedoc/shared er BEVISST ikke mocket — testene måler den EKTE prefiksFraReferanse.

import { firmamalRouter } from "./firmamal";

const ORG = "22222222-2222-2222-2222-222222222222";
const RT = "44444444-4444-4444-4444-444444444444";

const logg = { req: { log: { info: vi.fn(), warn: vi.fn() } } };

// Fanger create-data fra $transaction-callbacken.
function txMock(created: Record<string, unknown>[]) {
  return vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({
      organizationTemplate: {
        create: vi.fn(async (a: { data: Record<string, unknown> }) => {
          created.push(a.data);
          return { id: "ny-mal" };
        }),
      },
      organizationTemplateObject: { create: vi.fn(), update: vi.fn() },
      reportTemplate: { update: vi.fn() },
    }),
  );
}

describe("firmamal — prefiks påkrevd (stille tomhet krav c)", () => {
  it("(1) laanFraSentralarkiv SETTER prefiks fra referansen — RØD før §B", async () => {
    const created: Record<string, unknown>[] = [];
    const ctx = {
      userId: "u1",
      ...logg,
      prisma: {
        organizationTemplate: { findFirst: vi.fn().mockResolvedValue(null) },
        bibliotekMal: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "bm1",
            navn: "Kontroll KB2",
            referanse: "KB2",
            beskrivelse: null,
            version: 1,
            kategori: "sjekkliste",
            domene: "kvalitet",
            kapittel: { standard: { kode: "NS 3420-K" } },
          }),
        },
        bibliotekMalObjekt: { findMany: vi.fn().mockResolvedValue([]) },
        $transaction: txMock(created),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await firmamalRouter.createCaller(ctx).laanFraSentralarkiv({ organizationId: ORG, bibliotekMalId: "bm1" });
    expect(created[0]?.prefix).toBe("KB2");
  });

  it("(1b) laanFraSentralarkiv AVVISER når referansen ikke gir prefiks", async () => {
    const created: Record<string, unknown>[] = [];
    const ctx = {
      userId: "u1",
      ...logg,
      prisma: {
        organizationTemplate: { findFirst: vi.fn().mockResolvedValue(null) },
        bibliotekMal: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "bm2",
            navn: "Uten referanse",
            referanse: "", // → prefiksFraReferanse = null
            beskrivelse: null,
            version: 1,
            kategori: "sjekkliste",
            domene: "kvalitet",
            kapittel: { standard: { kode: "NS 3420-K" } },
          }),
        },
        bibliotekMalObjekt: { findMany: vi.fn().mockResolvedValue([]) },
        $transaction: txMock(created),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await expect(
      firmamalRouter.createCaller(ctx).laanFraSentralarkiv({ organizationId: ORG, bibliotekMalId: "bm2" }),
    ).rejects.toThrow();
    expect(created).toHaveLength(0); // aldri lagret en mal uten nummer
  });

  it("(2) opprett UTEN prefiks avvises av Zod — RØD før §C (.optional())", async () => {
    const create = vi.fn();
    const ctx = {
      userId: "u1",
      ...logg,
      prisma: { organizationTemplate: { create } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      firmamalRouter.createCaller(ctx).opprett({ organizationId: ORG, name: "Uten prefiks", category: "sjekkliste" } as any),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled(); // Zod stopper før skriving
  });

  it("(2b) opprett med BLANK prefiks avvises (trim + min(1))", async () => {
    const create = vi.fn();
    const ctx = {
      userId: "u1",
      ...logg,
      prisma: { organizationTemplate: { create } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await expect(
      firmamalRouter.createCaller(ctx).opprett({
        organizationId: ORG,
        name: "Blank prefiks",
        category: "sjekkliste",
        prefix: "   ",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("(3) promoter arver ALDRI null — avviser når kilden mangler prefiks og opphav", async () => {
    const created: Record<string, unknown>[] = [];
    const ctx = {
      userId: "u1",
      ...logg,
      prisma: {
        reportTemplate: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: RT,
            name: "Håndbygd",
            description: null,
            prefix: null,
            category: "sjekkliste",
            domain: "bygg",
            subdomain: null,
            hmsSynlighet: null,
            subjects: [],
            showSubject: true,
            showFaggruppe: true,
            showLocation: true,
            showPriority: true,
            enableChangeLog: false,
            kontrollomrade: null,
            organizationTemplateId: null, // ingen opphav å utlede fra
            objects: [],
            project: { primaryOrganizationId: ORG },
          }),
        },
        organizationTemplate: { findUnique: vi.fn() },
        $transaction: txMock(created),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await expect(firmamalRouter.createCaller(ctx).promoter({ templateId: RT })).rejects.toThrow();
    expect(created).toHaveLength(0);
  });

  it("(3b) promoter UTLEDER fra opphavets bibliotekmal når kilden mangler prefiks", async () => {
    const created: Record<string, unknown>[] = [];
    const ctx = {
      userId: "u1",
      ...logg,
      prisma: {
        reportTemplate: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: RT,
            name: "Kopi av lånt",
            description: null,
            prefix: null,
            category: "sjekkliste",
            domain: "bygg",
            subdomain: null,
            hmsSynlighet: null,
            subjects: [],
            showSubject: true,
            showFaggruppe: true,
            showLocation: true,
            showPriority: true,
            enableChangeLog: false,
            kontrollomrade: null,
            organizationTemplateId: "ot1",
            objects: [],
            project: { primaryOrganizationId: ORG },
          }),
        },
        organizationTemplate: {
          findUnique: vi.fn().mockResolvedValue({
            prefix: null,
            laantFraBibliotek: { referanse: "KD1" },
          }),
        },
        $transaction: txMock(created),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await firmamalRouter.createCaller(ctx).promoter({ templateId: RT });
    expect(created[0]?.prefix).toBe("KD1");
  });
});
