import { z } from "zod";
import { Prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { hentTilgjengeligeMappeIder } from "../services/folder-tilgang";

export interface SokTreff {
  id: string;
  documentId: string;
  chunkText: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  nsCode: string | null;
  filename: string;
  fileUrl: string | null;
  docType: string | null;
  folderId: string | null;
  rank: number;
}

export const ftdSokRouter = router({
  sokDokumenter: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        query: z.string().min(1),
        limit: z.number().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const mappeIder = await hentTilgjengeligeMappeIder(
        ctx.userId,
        input.projectId,
      );

      // Fulltekstsøk med tsvector (norsk stemming + ranking)
      const mappeKlausul =
        mappeIder === null
          ? Prisma.empty
          : Prisma.sql`AND (d.folder_id IS NULL OR d.folder_id IN (${Prisma.join(mappeIder)}))`;

      let treff = await ctx.prisma.$queryRaw<SokTreff[]>`
        SELECT
          c.id,
          c.document_id AS "documentId",
          c.chunk_text AS "chunkText",
          c.page_number AS "pageNumber",
          c.section_title AS "sectionTitle",
          c.ns_code AS "nsCode",
          d.filename,
          d.file_url AS "fileUrl",
          d.doc_type AS "docType",
          d.folder_id AS "folderId",
          ts_rank(c.search_vector, plainto_tsquery('norwegian', ${input.query})) AS rank
        FROM ftd_document_chunks c
        JOIN ftd_documents d ON d.id = c.document_id
        WHERE d.project_id = ${input.projectId}
          AND d.is_active = true
          AND c.search_vector @@ plainto_tsquery('norwegian', ${input.query})
          ${mappeKlausul}
        ORDER BY rank DESC
        LIMIT ${input.limit}
      `;

      // Fallback til ILIKE hvis tsvector gir 0 treff (delord, forkortelser)
      if (treff.length === 0) {
        treff = await ctx.prisma.$queryRaw<SokTreff[]>`
          SELECT
            c.id,
            c.document_id AS "documentId",
            c.chunk_text AS "chunkText",
            c.page_number AS "pageNumber",
            c.section_title AS "sectionTitle",
            c.ns_code AS "nsCode",
            d.filename,
            d.file_url AS "fileUrl",
            d.doc_type AS "docType",
            d.folder_id AS "folderId",
            1.0 AS rank
          FROM ftd_document_chunks c
          JOIN ftd_documents d ON d.id = c.document_id
          WHERE d.project_id = ${input.projectId}
            AND d.is_active = true
            AND c.chunk_text ILIKE ${"%" + input.query + "%"}
            ${mappeKlausul}
          LIMIT ${input.limit}
        `;
      }

      return treff;
    }),

  hentDokumentChunks: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.ftdDocumentChunk.findMany({
        where: { documentId: input.documentId },
        orderBy: { chunkIndex: "asc" },
      });
    }),

  nsKoder: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        prefix: z.string().default(""),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const chunks = await ctx.prisma.ftdDocumentChunk.findMany({
        where: {
          document: { projectId: input.projectId },
          nsCode: { startsWith: input.prefix, not: null },
        },
        select: { nsCode: true },
        distinct: ["nsCode"],
        orderBy: { nsCode: "asc" },
      });
      return chunks.map((c) => c.nsCode!);
    }),

  nsChunks: protectedProcedure
    .input(z.object({ nsCode: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.ftdDocumentChunk.findMany({
        where: { nsCode: input.nsCode },
        include: {
          document: { select: { filename: true } },
        },
        orderBy: { chunkIndex: "asc" },
      });
    }),
});
