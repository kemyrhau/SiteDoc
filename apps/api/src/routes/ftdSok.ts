import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem, erSiteDocAdmin } from "../trpc/tilgangskontroll";
import { hentTilgjengeligeMappeIder } from "../services/folder-tilgang";
import { mappeKlausulSql, byggMappeTilgangsFilter } from "../services/mappe-filter";
import { HEADLINE_OPTS, maksPrDokFor } from "../services/ai-sok-service";

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
  /** SØK-2: antall treff-chunks i dokumentet totalt (før taket pr. dokument). */
  antallIDok?: number;
}

// Sentinel-markørene og headline-oppsettet deles med AI-søket (samme utsnitt i begge moduser, S2).
export { HL_START, HL_STOP } from "../services/ai-sok-service";

export const ftdSokRouter = router({
  sokDokumenter: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        query: z.string().min(1),
        limit: z.number().default(40),
        // S4: samme dokumentfilter som aiSok.sok (S-M8). Står innenfor d.project_id-filteret.
        dokumentIder: z.array(z.string()).optional(),
        ekskluderMappeIder: z.array(z.string()).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const mappeIder = await hentTilgjengeligeMappeIder(
        ctx.userId,
        input.projectId,
      );

      // Fulltekstsøk med tsvector (norsk stemming + ranking)
      const mappeKlausul = mappeKlausulSql(mappeIder);
      const dokKlausul = input.dokumentIder?.length
        ? Prisma.sql`AND d.id IN (${Prisma.join(input.dokumentIder)})`
        : Prisma.empty;
      const ekskluderKlausul = input.ekskluderMappeIder?.length
        ? Prisma.sql`AND (d.folder_id IS NULL OR d.folder_id NOT IN (${Prisma.join(input.ekskluderMappeIder)}))`
        : Prisma.empty;

      // Flere treff pr. dokument (opptil MAKS_PR_DOK), så UI kan gruppere dem under
      // dokumentet. ts_headline gir et utdrag med søkeord uthevet via sentinel-markører.
      // SØK-2: `antallIDok` = alle treff-chunks i dokumentet (COUNT OVER, før rn-taket) så UI kan vise
      // «Vis N flere». Ett dokument i filteret = «vis flere i dette dokumentet» → ingen tak pr. dok.
      const maksPrDok = maksPrDokFor(input.dokumentIder);
      const rnKlausul = Number.isFinite(maksPrDok)
        ? Prisma.sql`WHERE t.rn <= ${maksPrDok}`
        : Prisma.empty;
      type RåTreff = Omit<SokTreff, "metode">;
      let rader = await ctx.prisma.$queryRaw<RåTreff[]>`
        SELECT t.id, t."documentId", t."chunkText", t."chunkIndex", t."pageNumber",
               t."sectionTitle", t."nsCode", t.filename, t."fileUrl", t."docType",
               t."folderId", t.rank, t.utdrag, t."antallIDok"
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
            ) AS rn,
            COUNT(*) OVER (PARTITION BY c.document_id)::int AS "antallIDok"
          FROM ftd_document_chunks c
          JOIN ftd_documents d ON d.id = c.document_id
          WHERE d.project_id = ${input.projectId}
            AND d.is_active = true
            AND c.search_vector @@ plainto_tsquery('norwegian', ${input.query})
            ${mappeKlausul}
            ${dokKlausul}
            ${ekskluderKlausul}
        ) t
        ${rnKlausul}
        ORDER BY t.rank DESC
        LIMIT ${input.limit}
      `;

      // Fallback til ILIKE hvis tsvector gir 0 treff (delord, forkortelser).
      // Ingen ts_headline her (tsquery matcher ikke) — klienten highlighter utdraget.
      // S4/D4: rangert på antall forekomster av søkestrengen i chunken (ikke-overlappende,
      // store/små bokstaver likt), ikke på filnavn. Likhet → filnavn, avsnitt, id (deterministisk).
      if (rader.length === 0) {
        const qLower = input.query.toLowerCase();
        rader = await ctx.prisma.$queryRaw<RåTreff[]>`
          SELECT t.id, t."documentId", t."chunkText", t."chunkIndex", t."pageNumber",
                 t."sectionTitle", t."nsCode", t.filename, t."fileUrl", t."docType",
                 t."folderId", t.rank, t.utdrag, t."antallIDok"
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
              ((length(lower(c.chunk_text)) - length(replace(lower(c.chunk_text), ${qLower}, '')))
                / length(${qLower}))::float AS rank,
              NULL::text AS utdrag,
              ROW_NUMBER() OVER (
                PARTITION BY c.document_id
                ORDER BY (length(lower(c.chunk_text)) - length(replace(lower(c.chunk_text), ${qLower}, ''))) DESC,
                         c.chunk_index ASC
              ) AS rn,
              COUNT(*) OVER (PARTITION BY c.document_id)::int AS "antallIDok"
            FROM ftd_document_chunks c
            JOIN ftd_documents d ON d.id = c.document_id
            WHERE d.project_id = ${input.projectId}
              AND d.is_active = true
              AND c.chunk_text ILIKE ${"%" + input.query + "%"}
              ${mappeKlausul}
              ${dokKlausul}
              ${ekskluderKlausul}
          ) t
          ${rnKlausul}
          ORDER BY t.rank DESC, t.filename ASC, t."chunkIndex" ASC, t.id ASC
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

  /**
   * Hele dokumentteksten til høyre rute i søket. S6a (sikkerhet.md § 8d): krever medlemskap
   * i prosjektet, at dokumentet tilhører DET prosjektet (ellers kunne et medlem i A lese en
   * documentId fra B), og mappetilgang som i `sokDokumenter`.
   */
  hentDokumentChunks: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const dokument = await ctx.prisma.ftdDocument.findFirst({
        where: { id: input.documentId, projectId: input.projectId, isActive: true },
        select: { id: true, folderId: true },
      });
      if (!dokument) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dokumentet finnes ikke i prosjektet" });
      }
      if (dokument.folderId) {
        const mappeIder = await hentTilgjengeligeMappeIder(ctx.userId, input.projectId);
        if (mappeIder !== null && !mappeIder.includes(dokument.folderId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Ingen tilgang til mappen" });
        }
      }
      return ctx.prisma.ftdDocumentChunk.findMany({
        where: { documentId: dokument.id },
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

  /**
   * S6a (sikkerhet.md § 8d nr. 2): nsCode-oppslag var tidligere på tvers av prosjekter. Samme
   * mappetilgang og `isActive` som søket — ellers leser et medlem tekst fra en lukket mappe.
   */
  nsChunks: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), nsCode: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const mappeIder = await hentTilgjengeligeMappeIder(ctx.userId, input.projectId);
      return ctx.prisma.ftdDocumentChunk.findMany({
        where: {
          nsCode: input.nsCode,
          document: {
            projectId: input.projectId,
            isActive: true,
            ...byggMappeTilgangsFilter(mappeIder),
          },
        },
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
      // S6a: samme mappetilgang som sokDokumenter (lukket mappe → ikke i svaret).
      const mappeIder = await hentTilgjengeligeMappeIder(ctx.userId, input.projectId);
      const mappeKlausul = mappeKlausulSql(mappeIder);
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
          ${mappeKlausul}
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
