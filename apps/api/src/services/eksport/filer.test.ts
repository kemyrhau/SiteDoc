import { describe, it, expect, vi } from "vitest";
import { samleProsjektFiler } from "./filer";

/**
 * Mapping-kontrakt: hver kilde-modell → riktig kategori/mappe + binding til
 * domeneobjektet. Mocker begge prisma-klientene med ett representativt treff hver.
 */

describe("samleProsjektFiler", () => {
  it("tegning med original + revisjon, bilde på sjekkliste, utleggsvedlegg", async () => {
    const prisma = {
      reportTemplate: { findMany: vi.fn().mockResolvedValue([{ id: "mal1" }]) },
      checklist: { findMany: vi.fn().mockResolvedValue([{ id: "c1", title: "SJA Grøft" }]) },
      task: { findMany: vi.fn().mockResolvedValue([]) },
      image: {
        findMany: vi.fn().mockResolvedValue([
          {
            fileUrl: "/uploads/img.jpg",
            fileName: "grft.jpg",
            fileSize: 300,
            createdAt: new Date("2026-01-02T00:00:00Z"),
            checklistId: "c1",
            taskId: null,
          },
        ]),
      },
      drawing: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "d1",
            name: "Plantegning",
            drawingNumber: "ARK-101",
            revision: "B",
            fileUrl: "/uploads/d.pdf",
            fileSize: 5000,
            originalFileUrl: "/uploads/d.dwg",
            createdAt: new Date("2026-01-01T00:00:00Z"),
          },
        ]),
      },
      drawingRevision: {
        findMany: vi.fn().mockResolvedValue([
          {
            drawingId: "d1",
            fileUrl: "/uploads/d-revA.pdf",
            fileSize: 4000,
            revision: "A",
            createdAt: new Date("2025-12-01T00:00:00Z"),
          },
        ]),
      },
      ftdDocument: { findMany: vi.fn().mockResolvedValue([]) },
    } as never;

    const prismaTimer = {
      sheetUtlegg: { findMany: vi.fn().mockResolvedValue([{ id: "u1" }]) },
      sheetTillegg: { findMany: vi.fn().mockResolvedValue([]) },
      sheetUtleggVedlegg: {
        findMany: vi.fn().mockResolvedValue([
          {
            sheetUtleggId: "u1",
            fileUrl: "/uploads/privat/kvit.jpg",
            fileName: "kvittering.jpg",
            fileSize: 200,
            createdAt: new Date("2026-01-04T00:00:00Z"),
          },
        ]),
      },
    } as never;

    const filer = await samleProsjektFiler(prisma, prismaTimer, "p1");
    const byKat = Object.fromEntries(filer.map((f) => [f.kategori, f]));

    expect(byKat["bilde"]).toMatchObject({
      mappe: "filer/bilder",
      tilknyttet: { type: "sjekkliste", id: "c1", navn: "SJA Grøft" },
    });
    // Funn 2026-09-06: visningsnavnet må bære filas EKTE endelse fra fileUrl
    // (Drawing.name har ingen) — ellers skrives fila uten suffiks og macOS kan
    // ikke åpne den. Endelsen tas fra STIEN, ikke fileType-etiketten.
    expect(byKat["tegning"]).toMatchObject({ mappe: "tegninger", visningsnavn: "Plantegning.pdf", tilknyttet: { type: "tegning", id: "d1" } });
    expect(byKat["tegning-original"]).toMatchObject({ mappe: "tegninger/originaler", visningsnavn: "Plantegning.dwg", storrelse: null });
    expect(byKat["tegning-revisjon"]).toMatchObject({ mappe: "tegninger/revisjoner", visningsnavn: "Plantegning (rev A).pdf" });
    expect(byKat["kvittering-utlegg"]).toMatchObject({
      mappe: "filer/kvitteringer",
      tilknyttet: { type: "utlegg", id: "u1", navn: null },
    });
    expect(filer).toHaveLength(5);
  });

  it("tegningsnavn med punktum i seg får riktig endelse (ikke bogus-ext)", async () => {
    // «Plan 1. etasje» → unikArkivSti ville ellers lest « etasje» som endelse.
    // Med fileUrl-endelsen blir siste punktum .pdf, og fila blir åpnbar.
    const prisma = {
      reportTemplate: { findMany: vi.fn().mockResolvedValue([]) },
      image: { findMany: vi.fn() },
      drawing: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "d9",
            name: "Plan 1. etasje",
            drawingNumber: "ARK-201",
            revision: "A",
            fileUrl: "/uploads/plan.pdf",
            fileSize: 1000,
            originalFileUrl: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
          },
        ]),
      },
      drawingRevision: { findMany: vi.fn().mockResolvedValue([]) },
      ftdDocument: { findMany: vi.fn().mockResolvedValue([]) },
    } as never;
    const prismaTimer = {
      sheetUtlegg: { findMany: vi.fn().mockResolvedValue([]) },
      sheetTillegg: { findMany: vi.fn().mockResolvedValue([]) },
    } as never;

    const filer = await samleProsjektFiler(prisma, prismaTimer, "p1");
    expect(filer[0]!.visningsnavn).toBe("Plan 1. etasje.pdf");
  });

  it("ingen maler → ingen bilde-spørring", async () => {
    const prisma = {
      reportTemplate: { findMany: vi.fn().mockResolvedValue([]) },
      image: { findMany: vi.fn() },
      drawing: { findMany: vi.fn().mockResolvedValue([]) },
      ftdDocument: { findMany: vi.fn().mockResolvedValue([]) },
    } as never;
    const prismaTimer = {
      sheetUtlegg: { findMany: vi.fn().mockResolvedValue([]) },
      sheetTillegg: { findMany: vi.fn().mockResolvedValue([]) },
    } as never;

    const filer = await samleProsjektFiler(prisma, prismaTimer, "p1");
    expect(filer).toEqual([]);
    expect((prisma as unknown as { image: { findMany: ReturnType<typeof vi.fn> } }).image.findMany).not.toHaveBeenCalled();
  });
});
