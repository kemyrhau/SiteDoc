import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Firmagrense ordre (3) (2026-11-03, Kenneth: «Ja, samme branch»).
 *
 * `modul.reOversettDokument` sjekket medlemskap i `input.projectId`, men slettet og køet
 * oversatte blokker for vilkårlig `documentId`. Et medlem i prosjekt A kunne dermed slette
 * oversettelsene til et dokument i prosjekt B (eller i en mappe medlemmet ikke har tilgang til).
 * Samme mønster som `sammenlignOversettelse` (sikkerhet.md § 8i).
 *
 * Rød før fiksen: kallet sletter blokker i stedet for NOT_FOUND/FORBIDDEN.
 */

const { verifiserProsjektmedlem, hentTilgjengeligeMappeIder } = vi.hoisted(() => ({
  verifiserProsjektmedlem: vi.fn(),
  hentTilgjengeligeMappeIder: vi.fn(),
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

import { modulRouter } from "./modul";

const PROSJEKT_A = "11111111-1111-4111-8111-111111111111";
const PROSJEKT_B = "22222222-2222-4222-8222-222222222222";
const DOK = "dok-1";

function lagCaller(dok: { projectId: string; folderId: string | null } | null) {
  const blokkSlett = vi.fn(async () => ({ count: 3 }));
  const prisma = {
    ftdDocument: {
      findUnique: vi.fn(async () => (dok ? { id: DOK, ...dok } : null)),
    },
    ftdDocumentBlock: {
      deleteMany: blokkSlett,
      findMany: vi.fn(async () => []),
    },
    translationCache: { deleteMany: vi.fn() },
    ftdTranslationJob: { upsert: vi.fn() },
    projectModule: { findUnique: vi.fn(async () => null), update: vi.fn() },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caller = modulRouter.createCaller({ userId: "medlem-a", prisma } as any);
  return { caller, blokkSlett };
}

const INPUT = { projectId: PROSJEKT_A, documentId: DOK, targetLang: "en", motor: "google" as const };

beforeEach(() => {
  verifiserProsjektmedlem.mockReset().mockResolvedValue(undefined);
  hentTilgjengeligeMappeIder.mockReset().mockResolvedValue(null);
});

describe("modul.reOversettDokument — dokumentet må tilhøre prosjektet og en tilgjengelig mappe", () => {
  it("🔴 dokument i et annet prosjekt → NOT_FOUND, ingenting slettet", async () => {
    const { caller, blokkSlett } = lagCaller({ projectId: PROSJEKT_B, folderId: null });
    await expect(caller.reOversettDokument(INPUT)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(blokkSlett).not.toHaveBeenCalled();
  });

  it("🔴 ukjent dokument → NOT_FOUND, ingenting slettet", async () => {
    const { caller, blokkSlett } = lagCaller(null);
    await expect(caller.reOversettDokument(INPUT)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(blokkSlett).not.toHaveBeenCalled();
  });

  it("🔴 dokument i en mappe brukeren ikke har tilgang til → FORBIDDEN, ingenting slettet", async () => {
    hentTilgjengeligeMappeIder.mockResolvedValue(["annen-mappe"]);
    const { caller, blokkSlett } = lagCaller({ projectId: PROSJEKT_A, folderId: "lukket-mappe" });
    await expect(caller.reOversettDokument(INPUT)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(blokkSlett).not.toHaveBeenCalled();
  });

  it("negativkontroll: dokument i egen, tilgjengelig mappe → køes", async () => {
    hentTilgjengeligeMappeIder.mockResolvedValue(["apen-mappe"]);
    const { caller, blokkSlett } = lagCaller({ projectId: PROSJEKT_A, folderId: "apen-mappe" });
    await expect(caller.reOversettDokument(INPUT)).resolves.toMatchObject({ status: "queued" });
    expect(blokkSlett).toHaveBeenCalled();
    expect(hentTilgjengeligeMappeIder).toHaveBeenCalledWith("medlem-a", PROSJEKT_A);
  });
});
