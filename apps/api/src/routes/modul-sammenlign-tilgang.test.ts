import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Firmagrense funn 2 (ordre 2026-11-03 (2), Kenneth: «Ja, alle»).
 *
 * `modul.sammenlignOversettelse` sjekket medlemskap i `input.projectId`, men slo opp blokken
 * på `blokkId` alene. Et medlem i prosjekt A kunne dermed lese kildeteksten til en blokk i
 * prosjekt B (eller i en mappe medlemmet ikke har tilgang til). Nå må blokkens dokument
 * tilhøre `input.projectId`, og brukeren må ha tilgang til dokumentets mappe.
 *
 * Rød før fiksen: kallet returnerer kildeteksten i stedet for NOT_FOUND/FORBIDDEN.
 */

const { verifiserProsjektmedlem, hentTilgjengeligeMappeIder, sammenlignMotorer } = vi.hoisted(() => ({
  verifiserProsjektmedlem: vi.fn(),
  hentTilgjengeligeMappeIder: vi.fn(),
  sammenlignMotorer: vi.fn(),
}));

vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem,
  verifiserOrganisasjonTilgang: vi.fn(),
}));
vi.mock("../services/folder-tilgang", () => ({ hentTilgjengeligeMappeIder }));
vi.mock("../services/oversettelse-service", () => ({ sammenlignMotorer }));

import { modulRouter } from "./modul";

const PROSJEKT_A = "11111111-1111-4111-8111-111111111111";
const PROSJEKT_B = "22222222-2222-4222-8222-222222222222";
const BLOKK = "blokk-1";
const HEMMELIG = "Kontraktssum 12 MNOK";

function lagCaller(dok: { projectId: string; folderId: string | null }) {
  const prisma = {
    ftdDocumentBlock: {
      findUnique: vi.fn(async () => ({
        content: HEMMELIG,
        language: "nb",
        sourceBlockId: null,
        documentId: "dok-1",
      })),
    },
    ftdDocument: {
      findUnique: vi.fn(async () => ({ sourceLanguage: "nb", ...dok })),
    },
    projectModule: { findUnique: vi.fn(async () => null) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return modulRouter.createCaller({ userId: "medlem-a", prisma } as any);
}

const INPUT = { projectId: PROSJEKT_A, blokkId: BLOKK, targetLang: "en" };

beforeEach(() => {
  verifiserProsjektmedlem.mockReset().mockResolvedValue(undefined);
  hentTilgjengeligeMappeIder.mockReset().mockResolvedValue(null);
  sammenlignMotorer.mockReset().mockResolvedValue([]);
});

describe("modul.sammenlignOversettelse — blokken må tilhøre prosjektet og en tilgjengelig mappe", () => {
  it("🔴 blokk i et annet prosjekt → NOT_FOUND, ingen kildetekst", async () => {
    const caller = lagCaller({ projectId: PROSJEKT_B, folderId: null });
    await expect(caller.sammenlignOversettelse(INPUT)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(sammenlignMotorer).not.toHaveBeenCalled();
  });

  it("🔴 blokk i en mappe brukeren ikke har tilgang til → FORBIDDEN", async () => {
    hentTilgjengeligeMappeIder.mockResolvedValue(["annen-mappe"]);
    const caller = lagCaller({ projectId: PROSJEKT_A, folderId: "lukket-mappe" });
    await expect(caller.sammenlignOversettelse(INPUT)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(sammenlignMotorer).not.toHaveBeenCalled();
  });

  it("negativkontroll: blokk i egen, tilgjengelig mappe → kildeteksten returneres", async () => {
    hentTilgjengeligeMappeIder.mockResolvedValue(["apen-mappe"]);
    const caller = lagCaller({ projectId: PROSJEKT_A, folderId: "apen-mappe" });
    const res = await caller.sammenlignOversettelse(INPUT);
    expect(res.norskOriginal).toBe(HEMMELIG);
    expect(hentTilgjengeligeMappeIder).toHaveBeenCalledWith("medlem-a", PROSJEKT_A);
  });

  it("negativkontroll: dokument uten mappe i eget prosjekt → slipper gjennom", async () => {
    const caller = lagCaller({ projectId: PROSJEKT_A, folderId: null });
    const res = await caller.sammenlignOversettelse(INPUT);
    expect(res.norskOriginal).toBe(HEMMELIG);
  });
});
