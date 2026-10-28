import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * SØK-1 S6a / T9 (dokumentsok-visning-spec § 6, F1/F2; sikkerhet.md § 8d).
 *
 * `ftdSok.hentDokumentChunks` returnerte hele dokumentteksten for en hvilken som helst
 * documentId uten medlemskapssjekk, og `ftdSok.nsChunks` returnerte chunks for en nsCode på
 * tvers av alle prosjekter. Begge krever nå `projectId` + medlemskap, og dokumentet må
 * tilhøre det prosjektet.
 *
 * Rød før fiksen: kallet uten medlemskap returnerer chunks i stedet for FORBIDDEN.
 */

const { verifiserProsjektmedlem, hentTilgjengeligeMappeIder } = vi.hoisted(() => ({
  verifiserProsjektmedlem: vi.fn(),
  hentTilgjengeligeMappeIder: vi.fn(),
}));

vi.mock("@sitedoc/db", () => ({ prisma: {}, Prisma: {} }));
vi.mock("../trpc/tilgangskontroll", () => ({
  verifiserProsjektmedlem,
  erSiteDocAdmin: vi.fn().mockResolvedValue(false),
}));
vi.mock("../services/folder-tilgang", () => ({ hentTilgjengeligeMappeIder }));

import { ftdSokRouter } from "./ftdSok";

const PROSJEKT_A = "11111111-1111-4111-8111-111111111111";
const PROSJEKT_B = "22222222-2222-4222-8222-222222222222";
const DOK_A = "dok-a";
const CHUNKS = [{ id: "c1", documentId: DOK_A, chunkIndex: 0, chunkText: "Ved forsinkelse påløper dagmulkt." }];

interface FakeDok {
  id: string;
  projectId: string;
  folderId: string | null;
}

function lagCaller(dokumenter: FakeDok[] = [{ id: DOK_A, projectId: PROSJEKT_A, folderId: null }]) {
  const chunkFindMany = vi.fn().mockResolvedValue(CHUNKS);
  const prisma = {
    ftdDocument: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; projectId: string } }) => {
        const d = dokumenter.find((x) => x.id === where.id && x.projectId === where.projectId);
        return d ? { id: d.id, folderId: d.folderId } : null;
      }),
    },
    ftdDocumentChunk: { findMany: chunkFindMany },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caller = ftdSokRouter.createCaller({ userId: "bruker-1", prisma } as any);
  return { caller, chunkFindMany };
}

const forbidden = () => new TRPCError({ code: "FORBIDDEN", message: "Du er ikke medlem av dette prosjektet" });

beforeEach(() => {
  verifiserProsjektmedlem.mockReset();
  hentTilgjengeligeMappeIder.mockReset().mockResolvedValue(null);
});

describe("ftdSok.hentDokumentChunks — S6a prosjektisolering", () => {
  it("F1: bruker uten medlemskap → FORBIDDEN, ingen chunks lest", async () => {
    verifiserProsjektmedlem.mockRejectedValue(forbidden());
    const { caller, chunkFindMany } = lagCaller();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      caller.hentDokumentChunks({ projectId: PROSJEKT_A, documentId: DOK_A } as any),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(chunkFindMany).not.toHaveBeenCalled();
  });

  it("F2: medlem → chunks som før", async () => {
    verifiserProsjektmedlem.mockResolvedValue(undefined);
    const { caller } = lagCaller();
    const res = await caller.hentDokumentChunks({ projectId: PROSJEKT_A, documentId: DOK_A });
    expect(res).toEqual(CHUNKS);
    expect(verifiserProsjektmedlem).toHaveBeenCalledWith("bruker-1", PROSJEKT_A);
  });

  it("medlem i B kan ikke lese et dokument fra A ved å sende B som projectId → NOT_FOUND", async () => {
    verifiserProsjektmedlem.mockResolvedValue(undefined);
    const { caller, chunkFindMany } = lagCaller();
    await expect(
      caller.hentDokumentChunks({ projectId: PROSJEKT_B, documentId: DOK_A }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(chunkFindMany).not.toHaveBeenCalled();
  });

  it("dokument i mappe brukeren ikke har tilgang til → FORBIDDEN (samme regel som sokDokumenter)", async () => {
    verifiserProsjektmedlem.mockResolvedValue(undefined);
    hentTilgjengeligeMappeIder.mockResolvedValue(["annen-mappe"]);
    const { caller, chunkFindMany } = lagCaller([{ id: DOK_A, projectId: PROSJEKT_A, folderId: "lukket-mappe" }]);
    await expect(
      caller.hentDokumentChunks({ projectId: PROSJEKT_A, documentId: DOK_A }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(chunkFindMany).not.toHaveBeenCalled();
  });
});

describe("ftdSok.nsChunks — S6a prosjektisolering", () => {
  it("bruker uten medlemskap → FORBIDDEN", async () => {
    verifiserProsjektmedlem.mockRejectedValue(forbidden());
    const { caller, chunkFindMany } = lagCaller();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      caller.nsChunks({ projectId: PROSJEKT_A, nsCode: "AB1.1" } as any),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(chunkFindMany).not.toHaveBeenCalled();
  });

  it("medlem → spørringen er avgrenset til prosjektet", async () => {
    verifiserProsjektmedlem.mockResolvedValue(undefined);
    const { caller, chunkFindMany } = lagCaller();
    await caller.nsChunks({ projectId: PROSJEKT_A, nsCode: "AB1.1" });
    expect(chunkFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nsCode: "AB1.1", document: { projectId: PROSJEKT_A } },
      }),
    );
  });
});
