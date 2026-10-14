import { z } from "zod";
import { Prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem, erSiteDocAdmin } from "../trpc/tilgangskontroll";
import { hentTilgjengeligeMappeIder } from "../services/folder-tilgang";

export interface SokTreff {
  id: string;
  documentId: string;
  chunkText: string;
  chunkIndex: number | null;
  pageNumber: number | null;
  sectionTitle: string | null;
  nsCode: string | null;
  filename: string;
  fileUrl: string | null;
  docType: string | null;
  folderId: string | null;
  rank: number;
  /** Server-generert utdrag med søkeord uthevet via sentinel-markører (ts_headline). Null i ILIKE-fallback. */
  utdrag: string | null;
  /** Søkemetode — fulltekst gir alltid "tekst". */
  metode: "tekst";
}

// Sentinel-markører rundt treff fra ts_headline. Svært usannsynlige i dokumenttekst;
// klienten splitter på disse og rendrer <mark>. Se treff-liste.tsx.
export const HL_START = "❰HL❱"; // ❰HL❱
export const HL_STOP = "❰/HL❱"; // ❰/HL❱
const HEADLINE_OPTS = `StartSel=${HL_START}, StopSel=${HL_STOP}, MaxWords=32, MinWords=12, ShortWord=2, HighlightAll=FALSE`;

export const ftdSokRouter = router({
  sokDokumenter: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        query: z.string().min(1),
        limit: z.number().default(40),
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

      // Flere treff pr. dokument (opptil MAKS_PR_DOK), så UI kan gruppere dem under
      // dokumentet. ts_headline gir et utdrag med søkeord uthevet via sentinel-markører.
      type RåTreff = Omit<SokTreff, "metode">;
      let rader = await ctx.prisma.$queryRaw<RåTreff[]>`
        SELECT t.id, t."documentId", t."chunkText", t."chunkIndex", t."pageNumber",
               t."sectionTitle", t."nsCode", t.filename, t."fileUrl", t."docType",
               t."folderId", t.rank, t.utdrag
        FROM (
          SELECT
            c.id,
            c.document_id AS "documentId",
            c.chunk_text AS "chunkText",
            c.chunk_index AS "chunkIndex",
            c.page_number AS "pageNumber",
            c.section_title AS "sectionTitle",
            c.ns_code AS "nsCode",
            d.filename,
            d.file_url AS "fileUrl",
            d.doc_type AS "docType",
            d.folder_id AS "folderId",
            ts_rank(c.search_vector, plainto_tsquery('norwegian', ${input.query})) AS rank,
            ts_headline('norwegian', c.chunk_text, plainto_tsquery('norwegian', ${input.query}), ${HEADLINE_OPTS}) AS utdrag,
            ROW_NUMBER() OVER (
              PARTITION BY c.document_id
              ORDER BY ts_rank(c.search_vector, plainto_tsquery('norwegian', ${input.query})) DESC
            ) AS rn
          FROM ftd_document_chunks c
          JOIN ftd_documents d ON d.id = c.document_id
          WHERE d.project_id = ${input.projectId}
            AND d.is_active = true
            AND c.search_vector @@ plainto_tsquery('norwegian', ${input.query})
            ${mappeKlausul}
        ) t
        WHERE t.rn <= 5
        ORDER BY t.rank DESC
        LIMIT ${input.limit}
      `;

      // Fallback til ILIKE hvis tsvector gir 0 treff (delord, forkortelser).
      // Ingen ts_headline her (tsquery matcher ikke) — klienten highlighter utdraget.
      if (rader.length === 0) {
        rader = await ctx.prisma.$queryRaw<RåTreff[]>`
          SELECT t.id, t."documentId", t."chunkText", t."chunkIndex", t."pageNumber",
                 t."sectionTitle", t."nsCode", t.filename, t."fileUrl", t."docType",
                 t."folderId", t.rank, t.utdrag
          FROM (
            SELECT
              c.id,
              c.document_id AS "documentId",
              c.chunk_text AS "chunkText",
              c.chunk_index AS "chunkIndex",
              c.page_number AS "pageNumber",
              c.section_title AS "sectionTitle",
              c.ns_code AS "nsCode",
              d.filename,
              d.file_url AS "fileUrl",
              d.doc_type AS "docType",
              d.folder_id AS "folderId",
              1.0 AS rank,
              NULL::text AS utdrag,
              ROW_NUMBER() OVER (PARTITION BY c.document_id ORDER BY c.chunk_index ASC) AS rn
            FROM ftd_document_chunks c
            JOIN ftd_documents d ON d.id = c.document_id
            WHERE d.project_id = ${input.projectId}
              AND d.is_active = true
              AND c.chunk_text ILIKE ${"%" + input.query + "%"}
              ${mappeKlausul}
          ) t
          WHERE t.rn <= 5
          ORDER BY t.filename ASC, t.rank DESC
          LIMIT ${input.limit}
        `;
      }

      // RETUR 1 R1: `rank` (ts_rank-score) er dev-diagnostikk → gates server-side til
      // sitedoc_admin/dev, ikke bare skjult i klienten. Utdrag/metode beholdes (bruker-innhold).
      const visScore =
        process.env.NODE_ENV === "development" || (await erSiteDocAdmin(ctx.userId));
      return rader.map(({ rank: _rank, ...r }) =>
        visScore ? { ...r, rank: _rank, metode: "tekst" as const } : { ...r, metode: "tekst" as const },
      );
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
