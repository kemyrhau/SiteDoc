import { describe, it, expect, vi } from "vitest";

/**
 * `firmamal.laanFraSentralarkiv` — dobbelt-lån-vakt (ordre fix/firmaarkiv-dobbeltlaan).
 * Hvert klikk på «Lån fra SiteDoc-arkivet» lagde før en ny, identisk firmamal (Kenneth så
 * KB4 tre ganger). Denne dekker at ANDRE lån av samme `bibliotekMalId` inn i SAMME firma
 * kaster CONFLICT og ikke skriver noe — serveren er gaten, ikke UI-et.
 *
 * 🔴 Negativ kontroll kjørt (ordre Krav 4): fjernet findFirst-vakten → test (2) ble rød;
 * satt tilbake → grønn. En test som er grønn både med og uten vakten måler ingenting.
 */

vi.mock("../trpc/tilgangskontroll", () => ({
  autoriserAdminForFirma: vi.fn().mockResolvedValue(undefined),
  verifiserAdmin: vi.fn().mockResolvedValue(undefined),
  erFirmaAdminForProsjekt: vi.fn(),
  autoriserMalTilgang: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));

vi.mock("./mal", () => ({ finnLedigeMalVerdier: vi.fn() }));

import { firmamalRouter } from "./firmamal";

const ORG = "22222222-2222-2222-2222-222222222222";
const BIB = "bib-mal-1";

const BIB_MAL = {
  id: BIB,
  navn: "KB4 – Grasdekker",
  referanse: "KB4",
  beskrivelse: "Kontroll av grasdekker",
  kategori: "sjekkliste",
  domene: "kvalitet",
  kapittel: { standard: { kode: "NS 3420" } },
};

// Vei C: lånevegen leser objekt-RADENE (BibliotekMalObjekt), ikke lenger malInnhold.
const BIB_RADER = [
  { id: "r1", parentId: null, type: "heading", label: "Kontroll FØR utførelse", config: {}, translations: {}, sortOrder: 1, required: false },
  { id: "r2", parentId: null, type: "list_single", label: "Type", config: { zone: "datafelter" }, translations: {}, sortOrder: 2, required: false },
  { id: "r3", parentId: null, type: "heading", label: "Kontroll ETTER utførelse", config: {}, translations: {}, sortOrder: 3, required: false },
  { id: "r4", parentId: null, type: "traffic_light", label: "Resultat", config: { zone: "datafelter" }, translations: {}, sortOrder: 4, required: false },
];

// Delt in-memory-lager: findFirst (ctx.prisma) og create (tx) ser samme tilstand,
// slik at ANDRE lån finner det FØRSTE la inn.
function lagPrisma() {
  const lagrede: Array<{ organizationId: string; laantFraBibliotekMalId: string | null }> = [];
  const tx = {
    organizationTemplate: {
      create: vi.fn(async ({ data }: { data: { organizationId: string; laantFraBibliotekMalId: string | null } }) => {
        lagrede.push({
          organizationId: data.organizationId,
          laantFraBibliotekMalId: data.laantFraBibliotekMalId,
        });
        return { id: `ot-${lagrede.length}` };
      }),
    },
    organizationTemplateObject: {
      create: vi.fn().mockResolvedValue({ id: "obj" }),
      update: vi.fn().mockResolvedValue({ id: "obj" }),
    },
  };
  return {
    _lagrede: lagrede,
    organizationTemplate: {
      findFirst: vi.fn(
        async ({ where }: { where: { organizationId: string; laantFraBibliotekMalId: string } }) =>
          lagrede.find(
            (r) =>
              r.organizationId === where.organizationId &&
              r.laantFraBibliotekMalId === where.laantFraBibliotekMalId,
          ) ?? null,
      ),
    },
    bibliotekMal: { findUniqueOrThrow: vi.fn().mockResolvedValue(BIB_MAL) },
    bibliotekMalObjekt: { findMany: vi.fn().mockResolvedValue(BIB_RADER) },
    $transaction: vi.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
}

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

describe("firmamal.laanFraSentralarkiv — dobbelt-lån-vakt", () => {
  it("(1) første lån går gjennom", async () => {
    const prisma = lagPrisma();
    const res = await lagCaller(prisma).laanFraSentralarkiv({
      organizationId: ORG,
      bibliotekMalId: BIB,
    });
    expect(res).toEqual({ id: "ot-1", malNavn: "KB4 – Grasdekker" });
    expect(prisma._lagrede).toHaveLength(1);
  });

  it("(2) andre lån av samme mal → CONFLICT, ingen ny skriving", async () => {
    const prisma = lagPrisma();
    const caller = lagCaller(prisma);
    await caller.laanFraSentralarkiv({ organizationId: ORG, bibliotekMalId: BIB });

    await expect(
      caller.laanFraSentralarkiv({ organizationId: ORG, bibliotekMalId: BIB }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Fortsatt kun ÉN firmamal — det andre kallet skrev ingenting.
    expect(prisma._lagrede).toHaveLength(1);
    // Andre kall stanser før bibliotekmalen i det hele tatt hentes.
    expect(prisma.bibliotekMal.findUniqueOrThrow).toHaveBeenCalledTimes(1);
  });

  it("(3) samme mal til ET ANNET firma er lov", async () => {
    const prisma = lagPrisma();
    const caller = lagCaller(prisma);
    await caller.laanFraSentralarkiv({ organizationId: ORG, bibliotekMalId: BIB });
    const annetFirma = "33333333-3333-3333-3333-333333333333";
    const res = await caller.laanFraSentralarkiv({
      organizationId: annetFirma,
      bibliotekMalId: BIB,
    });
    expect(res.malNavn).toBe("KB4 – Grasdekker");
    expect(prisma._lagrede).toHaveLength(2);
  });
});
