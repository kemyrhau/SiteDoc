import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Firmagrense ordre (4) (2026-11-03, Kenneth: «Ja, senere branch»).
 *
 * Modulstyringen krevde bare prosjektmedlemskap: et vanlig medlem kunne aktivere og
 * deaktivere prosjektmoduler, bytte oversettelsesmotor og legge inn API-nøkkel, og bytte
 * motor via `reOversettDokument`. Nå kreves `verifiserAdmin` (prosjektadmin, firma-admin i
 * eierfirmaet eller sitedoc_admin). Re-oversettelse med lagret motor er fortsatt åpen for
 * medlemmer med mappetilgang.
 *
 * Rød før fiksen: medlemmet slipper gjennom og skriver `ProjectModule`.
 */

const { verifiserProsjektmedlem, verifiserAdmin, hentTilgjengeligeMappeIder } = vi.hoisted(() => ({
  verifiserProsjektmedlem: vi.fn(),
  verifiserAdmin: vi.fn(),
  hentTilgjengeligeMappeIder: vi.fn(),
}));

vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem,
  verifiserAdmin,
  verifiserOrganisasjonTilgang: vi.fn(),
}));
vi.mock("../services/folder-tilgang", () => ({ hentTilgjengeligeMappeIder }));

import { modulRouter } from "./modul";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";
const DOK = "dok-1";

function lagCaller(lagretMotor?: string) {
  const skriv = vi.fn(async () => ({}));
  const blokkSlett = vi.fn(async () => ({ count: 0 }));
  const prisma = {
    projectModule: {
      findUnique: vi.fn(async () =>
        lagretMotor ? { status: "aktiv", config: { motor: lagretMotor } } : null,
      ),
      findMany: vi.fn(async () => []),
      update: skriv,
      upsert: skriv,
      create: skriv,
    },
    ftdDocument: { findUnique: vi.fn(async () => ({ id: DOK, projectId: PROSJEKT, folderId: null })) },
    ftdDocumentBlock: { deleteMany: blokkSlett, findMany: vi.fn(async () => []) },
    translationCache: { deleteMany: vi.fn() },
    ftdTranslationJob: { upsert: vi.fn() },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caller = modulRouter.createCaller({ userId: "bruker-1", prisma } as any);
  return { caller, skriv, blokkSlett };
}

beforeEach(() => {
  verifiserProsjektmedlem.mockReset().mockResolvedValue(undefined);
  verifiserAdmin.mockReset().mockRejectedValue(new TRPCError({ code: "FORBIDDEN", message: "Krever admin" }));
  hentTilgjengeligeMappeIder.mockReset().mockResolvedValue(null);
});

describe("modulstyring krever prosjektadmin", () => {
  it("🔴 medlem kan ikke deaktivere en modul", async () => {
    const { caller, skriv } = lagCaller();
    await expect(caller.deaktiver({ projectId: PROSJEKT, moduleSlug: "oversettelse" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(skriv).not.toHaveBeenCalled();
  });

  it("🔴 medlem kan ikke aktivere en modul", async () => {
    const { caller, skriv } = lagCaller();
    await expect(caller.aktiver({ projectId: PROSJEKT, moduleSlug: "oversettelse" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(skriv).not.toHaveBeenCalled();
  });

  it("🔴 medlem kan ikke endre oversettelsesinnstillinger", async () => {
    const { caller, skriv } = lagCaller("opus-mt");
    await expect(
      caller.oppdaterOversettelsesInnstillinger({ projectId: PROSJEKT, motor: "deepl", apiKey: "nokkel" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(skriv).not.toHaveBeenCalled();
  });

  it("🔴 medlem kan ikke bytte motor via reOversettDokument — ingenting slettet eller skrevet", async () => {
    const { caller, skriv, blokkSlett } = lagCaller("opus-mt");
    await expect(
      caller.reOversettDokument({ projectId: PROSJEKT, documentId: DOK, targetLang: "en", motor: "google" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(blokkSlett).not.toHaveBeenCalled();
    expect(skriv).not.toHaveBeenCalled();
  });

  it("🔴 medlem som re-oversetter med lagret motor skriver ikke config", async () => {
    const { caller, skriv, blokkSlett } = lagCaller("google");
    await expect(
      caller.reOversettDokument({ projectId: PROSJEKT, documentId: DOK, targetLang: "en", motor: "google" }),
    ).resolves.toMatchObject({ status: "queued" });
    expect(blokkSlett).toHaveBeenCalled();
    expect(skriv).not.toHaveBeenCalled();
  });

  it("negativkontroll: medlem kan re-oversette med standardmotor når ingen er lagret", async () => {
    const { caller } = lagCaller();
    await expect(
      caller.reOversettDokument({ projectId: PROSJEKT, documentId: DOK, targetLang: "en", motor: "opus-mt" }),
    ).resolves.toMatchObject({ status: "queued" });
  });

  // verifiserAdmin slipper inn prosjektadmin og firma-admin i eierfirmaet (dekket i tilgangskontroll-testene).
  it("negativkontroll: admin (prosjektadmin / eierfirma-admin) kan deaktivere, endre innstillinger og bytte motor", async () => {
    verifiserAdmin.mockResolvedValue(undefined);
    const { caller, skriv } = lagCaller("opus-mt");
    await expect(caller.deaktiver({ projectId: PROSJEKT, moduleSlug: "oversettelse" })).resolves.toBeDefined();
    await expect(
      caller.oppdaterOversettelsesInnstillinger({ projectId: PROSJEKT, motor: "opus-mt" }),
    ).resolves.toBeDefined();
    await expect(
      caller.reOversettDokument({ projectId: PROSJEKT, documentId: DOK, targetLang: "en", motor: "deepl" }),
    ).resolves.toMatchObject({ status: "queued" });
    expect(skriv).toHaveBeenCalledTimes(3);
    expect(verifiserAdmin).toHaveBeenCalledWith("bruker-1", PROSJEKT);
  });
});
