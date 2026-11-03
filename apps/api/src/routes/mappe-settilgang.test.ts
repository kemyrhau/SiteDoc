import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Firmagrense funn 1 (ordre 2026-11-03 (2), Kenneth: «Ja, alle»).
 *
 * `mappe.settTilgang` krevde bare `verifiserProsjektmedlem`. Ethvert medlem kunne sette
 * `accessMode="inherit"` eller skrive seg selv inn i listen og dermed åpne en lukket mappe —
 * som omgikk mappetilgangen i dokumentvisningen (sikkerhet.md § 8f). Nå kreves `verifiserAdmin`.
 * `settTilgang` er eneste rute som skriver `accessMode`/`FolderAccess` (`oppdater` endrer bare navn).
 *
 * Rød før fiksen: medlem uten adminrolle fikk skrive tilgangen.
 */

const { verifiserProsjektmedlem, verifiserAdmin } = vi.hoisted(() => ({
  verifiserProsjektmedlem: vi.fn(),
  verifiserAdmin: vi.fn(),
}));

vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));
vi.mock("../trpc/tilgangskontroll", () => ({ verifiserProsjektmedlem, verifiserAdmin }));
vi.mock("../services/folder-tilgang", () => ({ hentTilgjengeligeMappeIder: vi.fn() }));
vi.mock("../services/ftd-prosessering", () => ({ prosesserDokument: vi.fn() }));
vi.mock("../services/embedding-service", () => ({ embeddDokumentChunks: vi.fn() }));
vi.mock("../services/pdf-splitting", () => ({ splittMalebrevPdf: vi.fn() }));

import { mappeRouter } from "./mappe";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";
const MAPPE = "aaaaaaaa-0000-4000-8000-00000000000a";
const MEG = "bbbbbbbb-0000-4000-8000-00000000000b";

function lagCaller() {
  const transaksjon = vi.fn(async (fn: (tx: unknown) => unknown) =>
    fn({
      folder: { update: vi.fn(), findUniqueOrThrow: vi.fn(async () => ({ id: MAPPE })) },
      folderAccess: { deleteMany: vi.fn(), createMany: vi.fn() },
    }),
  );
  const prisma = {
    folder: { findUniqueOrThrow: vi.fn(async () => ({ projectId: PROSJEKT })) },
    $transaction: transaksjon,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caller = mappeRouter.createCaller({ userId: "medlem-1", prisma } as any);
  return { caller, transaksjon };
}

const ÅPNE_FOR_MEG = {
  folderId: MAPPE,
  accessMode: "custom" as const,
  entries: [{ accessType: "user" as const, userId: MEG }],
};

beforeEach(() => {
  verifiserProsjektmedlem.mockReset().mockResolvedValue(undefined);
  verifiserAdmin.mockReset().mockResolvedValue(undefined);
});

describe("mappe.settTilgang — krever prosjektadmin", () => {
  it("🔴 medlem uten adminrolle → FORBIDDEN, ingenting skrevet", async () => {
    verifiserAdmin.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    const { caller, transaksjon } = lagCaller();
    await expect(caller.settTilgang(ÅPNE_FOR_MEG)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(transaksjon).not.toHaveBeenCalled();
  });

  it("🔴 medlem uten adminrolle kan ikke sette inherit (åpne mappen) → FORBIDDEN", async () => {
    verifiserAdmin.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    const { caller, transaksjon } = lagCaller();
    await expect(
      caller.settTilgang({ folderId: MAPPE, accessMode: "inherit", entries: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(transaksjon).not.toHaveBeenCalled();
  });

  it("negativkontroll: prosjektadmin → skriver tilgangen", async () => {
    const { caller, transaksjon } = lagCaller();
    await caller.settTilgang(ÅPNE_FOR_MEG);
    expect(verifiserAdmin).toHaveBeenCalledWith("medlem-1", PROSJEKT);
    expect(transaksjon).toHaveBeenCalled();
  });
});
