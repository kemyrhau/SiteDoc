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

      // Dedup: DISTINCT ON tekst-prefix (200 tegn) — behold best-ranked per unik tekst
      let treff = await ctx.prisma.$queryRaw<SokTreff[]>`
        SELECT DISTINCT ON (LEFT(c.chunk_text, 200))
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
        ORDER BY LEFT(c.chunk_text, 200), rank DESC
      `;
      // Re-sorter på rank etter dedup
      treff.sort((a, b) => b.rank - a.rank);
      if (treff.length > input.limit) treff = treff.slice(0, input.limit);

      // Fallback til ILIKE hvis tsvector gir 0 treff (delord, forkortelser)
      if (treff.length === 0) {
        treff = await ctx.prisma.$queryRaw<SokTreff[]>`
          SELECT DISTINCT ON (LEFT(c.chunk_text, 200))
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
          ORDER BY LEFT(c.chunk_text, 200), rank DESC
        `;
        if (treff.length > input.limit) treff = treff.slice(0, input.limit);
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

  /** Søk NS-kode i NS 3420-dokumenter (tekst-søk, ikke nsCode-felt) */
  nsStandardSok: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        nsKode: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      // Søk i chunks fra dokumenter med "3420" i filnavnet
      return ctx.prisma.$queryRaw<Array<{
        id: string;
        chunkText: string;
        pageNumber: number | null;
        filename: string;
      }>>`
        SELECT c.id, c.chunk_text AS "chunkText", c.page_number AS "pageNumber", d.filename
        FROM ftd_document_chunks c
        JOIN ftd_documents d ON d.id = c.document_id
        WHERE d.project_id = ${input.projectId}
          AND d.is_active = true
          AND d.filename LIKE '%3420%'
          AND c.chunk_text ILIKE ${"%" + input.nsKode + "%"}
        ORDER BY d.filename, c.chunk_index
        LIMIT 20
      `;
    }),

  /** Batch-sjekk: hvilke NS-koder har split-dokumentasjon (undermapper) */
  nsKoderMedDok: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        nsKoder: z.array(z.string()),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      if (input.nsKoder.length === 0) return [];
      // Sjekk hvilke undermapper "Post {kode}" som finnes — mye raskere enn ILIKE-søk
      const mappeNavn = input.nsKoder.map((k) => `Post ${k}`);
      const mapper = await ctx.prisma.folder.findMany({
        where: { projectId: input.projectId, name: { in: mappeNavn } },
        select: { name: true },
      });
      return mapper.map((m) => m.name.replace("Post ", ""));
    }),
});
