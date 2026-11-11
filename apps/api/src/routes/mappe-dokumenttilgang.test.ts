import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

/**
 * Firmagrense punkt 3 (ordre 2026-11-03, Kenneth: «Mappetilgang i dokumentvisningen: Fiks»).
 *
 * `mappe.hentDokumenter`, `hentDokumenterMedSpraak` og `hentDokumentBlokker` sjekket bare
 * `verifiserProsjektmedlem`. Et prosjektmedlem kunne dermed lese dokumentliste (med `fileUrl`,
 * som signeres ved emisjon), overskrifter og hele blokkteksten fra en mappe hen ikke har tilgang
 * til. Nå krysses det mot `hentTilgjengeligeMappeIder` som i `ftdSok.hentDokumentChunks`.
 *
 * Rød før fiksen: medlem uten mappetilgang får innhold i stedet for FORBIDDEN.
 */

const { verifiserProsjektmedlem, hentTilgjengeligeMappeIder } = vi.hoisted(() => ({
  verifiserProsjektmedlem: vi.fn(),
  hentTilgjengeligeMappeIder: vi.fn(),
}));

vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));
vi.mock("../trpc/tilgangskontroll", () => ({ verifiserProsjektmedlem }));
vi.mock("../services/folder-tilgang", () => ({ hentTilgjengeligeMappeIder }));
vi.mock("../services/ftd-prosessering", () => ({ prosesserDokument: vi.fn() }));
vi.mock("../services/embedding-service", () => ({ embeddDokumentChunks: vi.fn() }));
vi.mock("../services/pdf-splitting", () => ({ splittMalebrevPdf: vi.fn() }));

import { mappeRouter } from "./mappe";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";
const LUKKET = "aaaaaaaa-0000-4000-8000-00000000000a";
const AAPEN = "bbbbbbbb-0000-4000-8000-00000000000b";
const DOK_LUKKET = "dok-lukket";
const DOK_AAPEN = "dok-aapen";
const DOK_UTEN_MAPPE = "dok-uten-mappe";

const DOKUMENTER: Record<string, { folderId: string | null }> = {
  [DOK_LUKKET]: { folderId: LUKKET },
  [DOK_AAPEN]: { folderId: AAPEN },
  [DOK_UTEN_MAPPE]: { folderId: null },
};

function lagCaller() {
  const dokFindMany = vi.fn().mockResolvedValue([]);
  const blokkFindMany = vi.fn().mockResolvedValue([]);
  const finnDok = async ({ where }: { where: { id: string } }) => {
    const d = DOKUMENTER[where.id];
    return d
      ? { projectId: PROSJEKT, folderId: d.folderId, filename: "x.pdf", fileUrl: "/uploads/x.pdf", sourceLanguage: "nb", _count: { chunks: 0 } }
      : null;
  };
  const prisma = {
    folder: {
      findUniqueOrThrow: vi.fn(async () => ({ projectId: PROSJEKT })),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ftdDocument: {
      findMany: dokFindMany,
      findUnique: vi.fn(finnDok),
      findUniqueOrThrow: vi.fn(async (a: { where: { id: string } }) => {
        const d = await finnDok(a);
        if (!d) throw new Error("No FtdDocument found");
        return d;
      }),
    },
    ftdDocumentBlock: { findMany: blokkFindMany, findFirst: vi.fn() },
    ftdTranslationJob: { findMany: vi.fn().mockResolvedValue([]) },
    project: { findUnique: vi.fn().mockResolvedValue({ sourceLanguage: "nb" }) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const caller = mappeRouter.createCaller({ userId: "medlem-1", prisma } as any);
  return { caller, dokFindMany, blokkFindMany };
}

beforeEach(() => {
  verifiserProsjektmedlem.mockReset().mockResolvedValue(undefined);
  // Medlemmet har bare tilgang til den åpne mappen.
  hentTilgjengeligeMappeIder.mockReset().mockResolvedValue([AAPEN]);
});

describe("mappe.hentDokumenter — mappetilgang", () => {
  it("🔴 medlem uten tilgang til mappen → FORBIDDEN, ingen dokumenter lest", async () => {
    const { caller, dokFindMany } = lagCaller();
    await expect(caller.hentDokumenter({ folderId: LUKKET })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dokFindMany).not.toHaveBeenCalled();
  });

  it("negativkontroll: mappe med tilgang → leser dokumenter", async () => {
    const { caller, dokFindMany } = lagCaller();
    await caller.hentDokumenter({ folderId: AAPEN });
    expect(dokFindMany).toHaveBeenCalled();
  });

  it("negativkontroll: tilgang til alt (null) → leser dokumenter", async () => {
    hentTilgjengeligeMappeIder.mockResolvedValue(null);
    const { caller, dokFindMany } = lagCaller();
    await caller.hentDokumenter({ folderId: LUKKET });
    expect(dokFindMany).toHaveBeenCalled();
  });

  it("negativkontroll: ikke medlem → FORBIDDEN fra prosjektporten, mappetilgang ikke spurt", async () => {
    verifiserProsjektmedlem.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    const { caller } = lagCaller();
    await expect(caller.hentDokumenter({ folderId: AAPEN })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(hentTilgjengeligeMappeIder).not.toHaveBeenCalled();
  });
});

describe("mappe.hentDokumenterMedSpraak — mappetilgang", () => {
  it("🔴 medlem uten tilgang til mappen → FORBIDDEN, ingen dokumenter lest", async () => {
    const { caller, dokFindMany } = lagCaller();
    await expect(caller.hentDokumenterMedSpraak({ folderId: LUKKET })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dokFindMany).not.toHaveBeenCalled();
  });

  it("negativkontroll: mappe med tilgang → leser dokumenter", async () => {
    const { caller, dokFindMany } = lagCaller();
    await caller.hentDokumenterMedSpraak({ folderId: AAPEN });
    expect(dokFindMany).toHaveBeenCalled();
  });
});

describe("mappe.hentDokumentBlokker — mappetilgang", () => {
  it("🔴 dokument i mappe uten tilgang → FORBIDDEN, ingen blokker lest", async () => {
    const { caller, blokkFindMany } = lagCaller();
    await expect(caller.hentDokumentBlokker({ documentId: DOK_LUKKET })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(blokkFindMany).not.toHaveBeenCalled();
  });

  it("ukjent dokument → NOT_FOUND", async () => {
    const { caller, blokkFindMany } = lagCaller();
    await expect(caller.hentDokumentBlokker({ documentId: "finnes-ikke" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(blokkFindMany).not.toHaveBeenCalled();
  });

  it("negativkontroll: dokument i mappe med tilgang → blokker og fileUrl", async () => {
    const { caller, blokkFindMany } = lagCaller();
    const res = await caller.hentDokumentBlokker({ documentId: DOK_AAPEN });
    expect(blokkFindMany).toHaveBeenCalled();
    // Signeres ved emisjon (signerUploadsOutput) — bare den med tilgang får en gyldig URL.
    expect(res.fileUrl).toMatch(/^\/uploads\/x\.pdf\?exp=\d+&sig=/);
  });

  it("negativkontroll: dokument uten mappe → bare prosjektporten (som hentDokumentChunks)", async () => {
    const { caller, blokkFindMany } = lagCaller();
    await caller.hentDokumentBlokker({ documentId: DOK_UTEN_MAPPE });
    expect(blokkFindMany).toHaveBeenCalled();
    expect(hentTilgjengeligeMappeIder).not.toHaveBeenCalled();
  });
});
