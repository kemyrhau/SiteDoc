import { describe, it, expect, vi } from "vitest";

/**
 * `bibliotek.importerMal` mot RAD-veien (ordre bibliotekmal-objekttabell, Krav 3).
 * Importen leser nå BibliotekMalObjekt-rader og KOPIERER dem verbatim til ReportObject —
 * ingen generering fra malInnhold. Testen låser at radene (inkl. heading, med config
 * verbatim) havner på prosjektmalen i samme rekkefølge.
 *
 * Negativ kontroll: bytter man `bibliotekMalObjekt.findMany` til å returnere [] blir
 * reportObject.create aldri kalt — testen (2) fanger det.
 */

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./mal", () => ({
  finnLedigeMalVerdier: vi.fn().mockResolvedValue({ name: "KB4 – Grasdekker", prefix: "KB4" }),
}));

import { bibliotekRouter } from "./bibliotek";

const PROSJEKT = "11111111-1111-1111-1111-111111111111";
const BIB = "bib-mal-1";

const RADER = [
  { id: "r1", parentId: null, type: "heading", label: "Kontroll FØR utførelse", config: {}, translations: {}, sortOrder: 1, required: false },
  { id: "r2", parentId: null, type: "list_single", label: "Type", config: { zone: "datafelter", options: ["A"] }, translations: {}, sortOrder: 2, required: false },
  { id: "r3", parentId: null, type: "traffic_light", label: "Resultat", config: { zone: "datafelter" }, translations: {}, sortOrder: 3, required: false },
];

function lagPrisma(rader = RADER) {
  const reportObjektCreate = vi.fn().mockResolvedValue({ id: "ro" });
  return {
    _objektCreate: reportObjektCreate,
    prosjektBibliotekValg: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "valg" }),
    },
    bibliotekMal: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: BIB,
        navn: "KB4 – Grasdekker",
        referanse: "KB4",
        beskrivelse: "Kontroll av grasdekker",
        kategori: "sjekkliste",
        domene: "kvalitet",
        kapittel: { standard: { kode: "NS 3420" } },
      }),
    },
    bibliotekMalObjekt: { findMany: vi.fn().mockResolvedValue(rader) },
    reportTemplate: { create: vi.fn().mockResolvedValue({ id: "mal-1" }) },
    reportObject: {
      create: reportObjektCreate,
      update: vi.fn().mockResolvedValue({ id: "ro" }),
    },
  };
}

function lagCaller(prisma: unknown) {
  const ctx = {
    userId: "user-1",
    prisma,
    req: { log: { info: vi.fn(), warn: vi.fn() } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return bibliotekRouter.createCaller(ctx);
}

describe("bibliotek.importerMal — rad-veien", () => {
  it("(1) kopierer radene verbatim til ReportObject i rekkefølge (heading med tom config)", async () => {
    const prisma = lagPrisma();
    const res = await lagCaller(prisma).importerMal({ projectId: PROSJEKT, bibliotekMalId: BIB });

    expect(res).toEqual({ sjekklisteMalId: "mal-1", malNavn: "KB4 – Grasdekker" });
    expect(prisma._objektCreate).toHaveBeenCalledTimes(3);

    const opprettet = prisma._objektCreate.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { type: string; label: string; config: unknown } }).data,
    );
    expect(opprettet.map((d: { type: string }) => d.type)).toEqual([
      "heading",
      "list_single",
      "traffic_light",
    ]);
    // Heading verbatim: tom config. Feltrad verbatim: beholder options + zone.
    expect(opprettet[0]!.config).toEqual({});
    expect(opprettet[1]!.config).toEqual({ zone: "datafelter", options: ["A"] });
  });

  it("(2) tomt objekt-tre → ingen ReportObject opprettes (negativ kontroll)", async () => {
    const prisma = lagPrisma([]);
    await lagCaller(prisma).importerMal({ projectId: PROSJEKT, bibliotekMalId: BIB });
    expect(prisma._objektCreate).not.toHaveBeenCalled();
  });
});
