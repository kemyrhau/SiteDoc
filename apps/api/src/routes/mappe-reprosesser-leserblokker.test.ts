import { describe, it, expect, vi, beforeEach } from "vitest";
import { INGEN_LESERBLOKKER } from "@sitedoc/shared";

/**
 * DL-2 RETUR (Kontrollør 2026-11-11):
 *
 * 1. `reprosesseringStatus` talte markøren `INGEN_LESERBLOKKER` i `processing_error` som
 *    feilet, så «Ferdig: X ok, Y feilet» regnet tekstløse PDF-er som feilet (regresjon).
 *    Telleren skal skille markøren ut — konstanten sendes som parameter, aldri som literal.
 * 2. `reprosesserDokument` uten tvang: ferdig PDF med chunks og 0 blokker skal gå til
 *    blokkgrenen (`modus: "blokker"`) og lage blokker fra lagret fil.
 */

const { verifiserProsjektmedlem, genererBlokkerFraLagretFil, embeddDokumentChunks, prosesserDokument } =
  vi.hoisted(() => ({
    verifiserProsjektmedlem: vi.fn(),
    genererBlokkerFraLagretFil: vi.fn(),
    embeddDokumentChunks: vi.fn(),
    prosesserDokument: vi.fn(),
  }));

vi.mock("@sitedoc/db", async () => ({
  prisma: {},
  Prisma: (await vi.importActual<typeof import("@sitedoc/db")>("@sitedoc/db")).Prisma,
}));
vi.mock("../trpc/tilgangskontroll", () => ({ verifiserProsjektmedlem }));
vi.mock("../services/folder-tilgang", () => ({ hentTilgjengeligeMappeIder: vi.fn() }));
// Ekte `utenLeserblokker` (filtype + blokk-oppslag); bare sideeffektene mockes.
vi.mock("../services/ftd-prosessering", async () => ({
  ...(await vi.importActual<typeof import("../services/ftd-prosessering")>("../services/ftd-prosessering")),
  prosesserDokument,
  genererBlokkerFraLagretFil,
}));
vi.mock("../services/embedding-service", () => ({ embeddDokumentChunks }));
vi.mock("../services/pdf-splitting", () => ({ splittMalebrevPdf: vi.fn() }));

import { mappeRouter } from "./mappe";

const PROSJEKT = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  verifiserProsjektmedlem.mockReset().mockResolvedValue(undefined);
  genererBlokkerFraLagretFil.mockReset().mockResolvedValue(0);
  embeddDokumentChunks.mockReset().mockResolvedValue(undefined);
  prosesserDokument.mockReset().mockResolvedValue(undefined);
});

function lagCaller(prisma: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mappeRouter.createCaller({ userId: "medlem-1", prisma } as any);
}

describe("mappe.reprosesseringStatus — markøren er ikke feilet", () => {
  it("🔴 feilet-telleren unntar INGEN_LESERBLOKKER, sendt som parameter", async () => {
    let sql = "";
    let verdier: unknown[] = [];
    const $queryRaw = vi.fn(async (strenger: TemplateStringsArray, ...v: unknown[]) => {
      sql = strenger.join("?");
      verdier = v;
      return [{ totalt: 3n, pagar: 0n, feilet: 1n, ustottet: 0n }];
    });
    const res = await lagCaller({ $queryRaw }).reprosesseringStatus({ projectId: PROSJEKT });

    expect(sql).toMatch(/processing_error IS NOT NULL\s+AND d\.processing_error IS DISTINCT FROM \?/);
    expect(verdier).toContain(INGEN_LESERBLOKKER);
    // Ingen literal i SQL-teksten — konstanten er eneste kilde.
    expect(sql).not.toContain(INGEN_LESERBLOKKER);
    expect(res).toMatchObject({ totalt: 3, feilet: 1, ferdig: 3 });
  });
});

describe("mappe.reprosesserDokument — blokkgren uten tvang", () => {
  function lagPrisma(filename: string, blokker: Array<{ documentId: string }>) {
    return {
      ftdDocument: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: "dok-1",
          projectId: PROSJEKT,
          processingState: "completed",
          filename,
        })),
        update: vi.fn(),
      },
      ftdDocumentChunk: { count: vi.fn(async () => 62) },
      ftdDocumentBlock: { findMany: vi.fn(async () => blokker) },
    };
  }

  it("🔴 ferdig PDF med chunks og 0 blokker → modus «blokker», blokker lages fra lagret fil", async () => {
    const prisma = lagPrisma("NS 3420 D.pdf", []);
    const res = await lagCaller(prisma).reprosesserDokument({ documentId: "dok-1" });

    expect(res).toEqual({ ok: true, modus: "blokker" });
    expect(genererBlokkerFraLagretFil).toHaveBeenCalledWith(prisma, "dok-1");
    expect(embeddDokumentChunks).toHaveBeenCalled();
    expect(prosesserDokument).not.toHaveBeenCalled();
    expect(prisma.ftdDocument.update).not.toHaveBeenCalled();
  });

  it("negativkontroll: PDF som alt har blokker → kun embedding", async () => {
    const res = await lagCaller(lagPrisma("NS 3420 D.pdf", [{ documentId: "dok-1" }])).reprosesserDokument({
      documentId: "dok-1",
    });
    expect(res).toEqual({ ok: true, modus: "embedding" });
    expect(genererBlokkerFraLagretFil).not.toHaveBeenCalled();
  });

  it("negativkontroll: XLSX uten blokker → kun embedding (ingen lesevisning for filtypen)", async () => {
    const res = await lagCaller(lagPrisma("mengder.xlsx", [])).reprosesserDokument({ documentId: "dok-1" });
    expect(res).toEqual({ ok: true, modus: "embedding" });
    expect(genererBlokkerFraLagretFil).not.toHaveBeenCalled();
  });
});
