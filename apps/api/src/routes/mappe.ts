import { z } from "zod";
import { Prisma } from "@sitedoc/db";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { router, protectedProcedure } from "../trpc/trpc";
import { settMappeTilgangSchema } from "@sitedoc/shared/validation";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { splittMalebrevPdf } from "../services/pdf-splitting";

const UPLOADS_DIR = join(process.cwd(), "uploads");
// Prosessering kjøres på API-serveren (ren Node) — ikke i Next.js
const API_INTERN_URL = `http://localhost:${process.env.API_PORT ?? process.env.PORT ?? "3001"}`;

function triggerProsessering(documentId: string) {
  fetch(`${API_INTERN_URL}/prosesser/${documentId}`, { method: "POST" }).catch(
    (err) => console.error(`Kunne ikke trigge prosessering for ${documentId}:`, err),
  );
}

export const mappeRouter = router({
  // Hent alle mapper for et prosjekt (flat liste med parentId + tilgangsoppføringer)
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.folder.findMany({
        where: { projectId: input.projectId },
        include: {
          _count: { select: { ftdDocuments: true } },
          kontrakt: { select: { id: true, navn: true } },
          accessEntries: {
            include: {
              enterprise: { select: { id: true, name: true, color: true } },
              group: { select: { id: true, name: true } },
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Opprett ny mappe
  opprett: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(255),
        parentId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.folder.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          parentId: input.parentId ?? null,
        },
      });
    }),

  // Oppdater mappe (gi nytt navn)
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.folder.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  // Oppdater dokumentspråk for mappen
  oppdaterSpraak: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        languages: z.array(z.string().min(2).max(5)).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      // Sørg for at "nb" alltid er inkludert
      const languages = Array.from(new Set(["nb", ...input.languages]));
      return ctx.prisma.folder.update({
        where: { id: input.id },
        data: { languages },
      });
    }),

  // Slett mappe (kaskaderer til undermapper)
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.folder.delete({ where: { id: input.id } });
    }),

  // Hent dokumenter for en mappe (bruker FtdDocument)
  hentDokumenter: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      const docs = await ctx.prisma.ftdDocument.findMany({
        where: { folderId: input.folderId, isActive: true },
        orderBy: { uploadedAt: "desc" },
      });

      // Hent embedding-status per dokument
      if (docs.length === 0) return [];
      const docIds = docs.map((d) => d.id);
      const embeddingStats = await ctx.prisma.$queryRaw<
        Array<{ documentId: string; totalt: bigint; embedded: bigint }>
      >`
        SELECT
          document_id AS "documentId",
          COUNT(*) AS totalt,
          COUNT(*) FILTER (WHERE embedding_state = 'done') AS embedded
        FROM ftd_document_chunks
        WHERE document_id IN (${Prisma.join(docIds)})
        GROUP BY document_id
      `;

      const statsMap = new Map(
        embeddingStats.map((s) => [
          s.documentId,
          { totalt: Number(s.totalt), embedded: Number(s.embedded) },
        ]),
      );

      return docs.map((d) => ({
        ...d,
        chunksTotalt: statsMap.get(d.id)?.totalt ?? 0,
        chunksEmbedded: statsMap.get(d.id)?.embedded ?? 0,
      }));
    }),

  // Hent tilgangskonfigurasjon for én mappe
  hentTilgang: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mappeForTilgang = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappeForTilgang.projectId);
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: {
          id: true,
          accessMode: true,
          accessEntries: {
            include: {
              enterprise: { select: { id: true, name: true, color: true } },
              group: { select: { id: true, name: true } },
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
      return mappe;
    }),

  // Sett tilgang for en mappe (erstatter alle oppføringer)
  settTilgang: protectedProcedure
    .input(settMappeTilgangSchema)
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.$transaction(async (tx) => {
        await tx.folder.update({
          where: { id: input.folderId },
          data: { accessMode: input.accessMode },
        });

        await tx.folderAccess.deleteMany({
          where: { folderId: input.folderId },
        });

        if (input.accessMode === "custom" && input.entries.length > 0) {
          await tx.folderAccess.createMany({
            data: input.entries.map((entry) => ({
              folderId: input.folderId,
              accessType: entry.accessType,
              enterpriseId: entry.enterpriseId ?? null,
              groupId: entry.groupId ?? null,
              userId: entry.userId ?? null,
            })),
          });
        }

        return tx.folder.findUniqueOrThrow({
          where: { id: input.folderId },
          include: {
            accessEntries: {
              include: {
                enterprise: { select: { id: true, name: true, color: true } },
                group: { select: { id: true, name: true } },
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        });
      });
    }),

  // Slett dokument fra mappe (soft-delete + fjern chunks/spec-poster)
  slettDokument: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.ftdDocument.findUniqueOrThrow({
        where: { id: input.documentId },
      });
      await verifiserProsjektmedlem(ctx.userId, doc.projectId);
      await ctx.prisma.ftdDocumentChunk.deleteMany({ where: { documentId: input.documentId } });
      await ctx.prisma.ftdSpecPost.deleteMany({ where: { documentId: input.documentId } });
      return ctx.prisma.ftdDocument.update({
        where: { id: input.documentId },
        data: { isActive: false },
      });
    }),

  // Last opp dokument til mappe — oppretter FtdDocument + trigger prosessering
  lastOppDokument: protectedProcedure
    .input(
      z.object({
        folderId: z.string().uuid(),
        name: z.string().min(1),
        fileUrl: z.string(),
        fileType: z.string(),
        fileSize: z.number().int().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      // Sjekk om dokument med samme filnavn finnes (soft-slettet)
      const eksisterende = await ctx.prisma.ftdDocument.findUnique({
        where: {
          projectId_filename: {
            projectId: mappe.projectId,
            filename: input.name,
          },
        },
      });

      let doc;
      if (eksisterende) {
        doc = await ctx.prisma.ftdDocument.update({
          where: { id: eksisterende.id },
          data: {
            isActive: true,
            folderId: input.folderId,
            fileUrl: input.fileUrl,
            filetype: input.fileType,
            fileSize: input.fileSize,
            processingState: "pending",
            processingError: null,
          },
        });
        await ctx.prisma.ftdDocumentChunk.deleteMany({ where: { documentId: doc.id } });
      } else {
        doc = await ctx.prisma.ftdDocument.create({
          data: {
            projectId: mappe.projectId,
            folderId: input.folderId,
            filename: input.name,
            fileUrl: input.fileUrl,
            filetype: input.fileType,
            fileSize: input.fileSize,
          },
        });
      }

      // Trigger prosessering på API-serveren (ren Node-kontekst)
      triggerProsessering(doc.id);

      return doc;
    }),

  settKontrakt: protectedProcedure
    .input(
      z.object({
        folderId: z.string().uuid(),
        kontraktId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.folder.update({
        where: { id: input.folderId },
        data: { kontraktId: input.kontraktId },
      });
    }),

  /** Splitt alle PDFer i en mappe per NS-kode/postnr. Bruker OCR-data fra chunks. */
  splittDokumenter: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { id: true, projectId: true, kontraktId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      // Finn alle PDFer i mappen
      const dokumenter = await ctx.prisma.ftdDocument.findMany({
        where: { folderId: input.folderId, isActive: true, filetype: "application/pdf" },
        include: { chunks: { select: { chunkText: true, pageNumber: true }, orderBy: { chunkIndex: "asc" } } },
      });

      let totaltFiler = 0;

      for (const dok of dokumenter) {
        if (!dok.fileUrl || dok.chunks.length === 0) continue;

        // Bygg sideData fra eksisterende chunks (OCR allerede kjørt)
        const sideData: Array<{ side: number; tekst: string }> = [];
        for (const chunk of dok.chunks) {
          sideData.push({ side: chunk.pageNumber ?? sideData.length + 1, tekst: chunk.chunkText });
        }

        try {
          const filsti = join(UPLOADS_DIR, dok.fileUrl.replace(/^\/uploads\//, ""));
          const buffer = await readFile(filsti);
          const antall = await splittMalebrevPdf(
            ctx.prisma, mappe.projectId, input.folderId, buffer, sideData, dok.filename ?? "ukjent.pdf", dok.id,
          );
          totaltFiler += antall;
        } catch (err) {
          console.error(`Splitting feilet for ${dok.filename}:`, err);
        }
      }

      return { splitted: totaltFiler, dokumenter: dokumenter.length };
    }),
});
