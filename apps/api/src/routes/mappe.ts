import { z } from "zod";
import { Prisma } from "@sitedoc/db";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { router, protectedProcedure } from "../trpc/trpc";
import { settMappeTilgangSchema } from "@sitedoc/shared/validation";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { splittMalebrevPdf } from "../services/pdf-splitting";
import { resolverSpråk, resolverAlleSpråk } from "../services/folder-spraak";

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
      const mapper = await ctx.prisma.folder.findMany({
        where: { projectId: input.projectId },
        include: {
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
      // Tell kun aktive dokumenter per mappe
      const tellinger = await ctx.prisma.$queryRaw<Array<{ folder_id: string; antall: bigint }>>`
        SELECT folder_id, count(*) as antall FROM ftd_documents
        WHERE project_id = ${input.projectId} AND is_active = true AND folder_id IS NOT NULL
        GROUP BY folder_id
      `;
      const tellMap = new Map(tellinger.map((t) => [t.folder_id, Number(t.antall)]));

      // Beregn effektive språk for alle mapper (arv)
      const språkMap = resolverAlleSpråk(mapper.map((m) => ({
        id: m.id,
        parentId: m.parentId,
        languageMode: m.languageMode,
        languages: m.languages as string[],
        sourceLanguage: m.sourceLanguage,
      })));

      return mapper.map((m) => {
        const effektiv = språkMap.get(m.id);
        return {
          ...m,
          _count: { ftdDocuments: tellMap.get(m.id) ?? 0 },
          effektiveSpraak: effektiv?.languages ?? ["nb"],
          effektivKildesprak: effektiv?.sourceLanguage ?? "nb",
          spraakArvet: effektiv?.arvet ?? true,
        };
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

  // Hent dokumenter med oversettelsesinfo for dokumentleser
  hentDokumenterMedSpraak: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true, languageMode: true, languages: true, sourceLanguage: true, parentId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      // Resolve effektive språk via arv
      const alleMapper = await ctx.prisma.folder.findMany({
        where: { projectId: mappe.projectId },
        select: { id: true, parentId: true, languageMode: true, languages: true, sourceLanguage: true },
      });
      const effektiv = resolverSpråk(input.folderId, alleMapper.map((m) => ({
        id: m.id, parentId: m.parentId, languageMode: m.languageMode,
        languages: m.languages as string[], sourceLanguage: m.sourceLanguage,
      })));

      const dokumenter = await ctx.prisma.ftdDocument.findMany({
        where: { folderId: input.folderId, isActive: true },
        select: { id: true, filename: true, uploadedAt: true },
        orderBy: { uploadedAt: "desc" },
      });

      // Hent tilgjengelige språk og første overskrift per dokument
      const result = await Promise.all(
        dokumenter.map(async (dok) => {
          const språkRader = await ctx.prisma.ftdDocumentBlock.findMany({
            where: { documentId: dok.id },
            select: { language: true },
            distinct: ["language"],
          });

          // Hent første heading per språk for tittel
          const titler: Record<string, string> = {};
          for (const { language } of språkRader) {
            const heading = await ctx.prisma.ftdDocumentBlock.findFirst({
              where: { documentId: dok.id, language, blockType: "heading" },
              orderBy: { sortOrder: "asc" },
              select: { content: true },
            });
            if (heading) titler[language] = heading.content;
          }

          return {
            id: dok.id,
            filename: dok.filename,
            uploadedAt: dok.uploadedAt,
            tilgjengeligeSprak: språkRader.map((r) => r.language),
            titler,
          };
        }),
      );

      return { dokumenter: result, mappeSprak: effektiv.languages };
    }),

  // Hent dokumentblokker for lesevisning
  hentDokumentBlokker: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        language: z.string().min(2).max(5).default("nb"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const dok = await ctx.prisma.ftdDocument.findUniqueOrThrow({
        where: { id: input.documentId },
        select: { projectId: true, filename: true, fileUrl: true },
      });
      await verifiserProsjektmedlem(ctx.userId, dok.projectId);

      const blokker = await ctx.prisma.ftdDocumentBlock.findMany({
        where: { documentId: input.documentId, language: input.language },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          sortOrder: true,
          pageNumber: true,
          blockType: true,
          content: true,
          headingLevel: true,
          imageUrl: true,
        },
      });

      // Finn tilgjengelige språk for dette dokumentet
      const språkRader = await ctx.prisma.ftdDocumentBlock.findMany({
        where: { documentId: input.documentId },
        select: { language: true },
        distinct: ["language"],
      });

      return {
        blokker,
        tilgjengeligeSprak: språkRader.map((r) => r.language),
        filename: dok.filename,
        fileUrl: dok.fileUrl,
      };
    }),

  // Oppdater dokumentspråk for mappen
  // Estimer oversettelseskostnad for en mappe
  estimerOversettelse: protectedProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.folderId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      // Tell ord i alle aktive dokumenter i mappen
      const stats = await ctx.prisma.$queryRaw<Array<{ antall_dok: bigint; totalt_ord: bigint }>>`
        SELECT
          COUNT(DISTINCT d.id) as antall_dok,
          COALESCE(SUM(d.word_count), 0) as totalt_ord
        FROM ftd_documents d
        WHERE d.folder_id = ${input.folderId} AND d.is_active = true
      `;
      const antallDok = Number(stats[0]?.antall_dok ?? 0);
      let totaltOrd = Number(stats[0]?.totalt_ord ?? 0);

      // Hvis word_count er 0, estimer fra blokker
      if (totaltOrd === 0 && antallDok > 0) {
        const blokkStats = await ctx.prisma.$queryRaw<Array<{ totalt_tegn: bigint }>>`
          SELECT COALESCE(SUM(LENGTH(content)), 0) as totalt_tegn
          FROM ftd_document_blocks b
          JOIN ftd_documents d ON d.id = b.document_id
          WHERE d.folder_id = ${input.folderId} AND d.is_active = true
            AND b.language = d.source_language
            AND b.block_type IN ('heading', 'text', 'caption')
        `;
        const tegn = Number(blokkStats[0]?.totalt_tegn ?? 0);
        totaltOrd = Math.round(tegn / 5); // Gjennomsnitt 5 tegn per ord
      }

      const totaltTegn = totaltOrd * 5; // Estimat tilbake til tegn

      return {
        antallDokumenter: antallDok,
        totaltOrd,
        totaltTegn,
        // Prisestimater per motor per ekstra språk
        perSpraak: {
          "opus-mt": { pris: 0, valuta: "NOK", label: "Gratis" },
          "google": { pris: 0, valuta: "NOK", label: "Gratis" },
          "deepl": {
            // DeepL Free: 500k tegn/mnd gratis, deretter €25/mln tegn
            pris: totaltTegn > 500000 ? Math.round((totaltTegn - 500000) * 0.00025) : 0,
            valuta: "NOK",
            label: totaltTegn > 500000 ? `~${Math.round((totaltTegn - 500000) * 0.00025)} NOK` : "Gratis (under 500k tegn)",
          },
        },
      };
    }),

  oppdaterSpraak: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        languages: z.array(z.string().min(2).max(5)).min(1),
        sourceLanguage: z.string().min(2).max(5).optional(),
        languageMode: z.enum(["inherit", "custom"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true, sourceLanguage: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      const srcLang = input.sourceLanguage ?? mappe.sourceLanguage ?? "nb";
      // Sørg for at kildespråk alltid er inkludert i målspråk
      const languages = Array.from(new Set([srcLang, ...input.languages]));
      return ctx.prisma.folder.update({
        where: { id: input.id },
        data: {
          languages,
          sourceLanguage: srcLang,
          languageMode: input.languageMode ?? "custom", // Å sette språk eksplisitt → custom
        },
      });
    }),

  // Sett språkmodus til "inherit" (arv fra forelder)
  settSpraakArv: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const mappe = await ctx.prisma.folder.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);
      return ctx.prisma.folder.update({
        where: { id: input.id },
        data: { languageMode: "inherit" },
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
        select: { projectId: true, languageMode: true, languages: true, sourceLanguage: true, parentId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, mappe.projectId);

      // Resolve effektive språk via arv
      const alleMapper = await ctx.prisma.folder.findMany({
        where: { projectId: mappe.projectId },
        select: { id: true, parentId: true, languageMode: true, languages: true, sourceLanguage: true },
      });
      const effektiv = resolverSpråk(input.folderId, alleMapper.map((m) => ({
        id: m.id, parentId: m.parentId, languageMode: m.languageMode,
        languages: m.languages as string[], sourceLanguage: m.sourceLanguage,
      })));

      const docs = await ctx.prisma.ftdDocument.findMany({
        where: { folderId: input.folderId, isActive: true },
        orderBy: { uploadedAt: "desc" },
      });

      // Hent embedding-status per dokument
      if (docs.length === 0) return { dokumenter: [], mappeSprak: effektiv.languages };
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

      // Hent oversettelsestatus per dokument (kun for mapper med flere språk)
      const mappeSprak = effektiv.languages;
      const harOversettelse = mappeSprak.length > 1;
      let oversettStatusMap = new Map<string, { tilgjengelig: string[]; pågår: boolean }>();

      if (harOversettelse) {
        // Tilgjengelige språk per dokument
        const blokkSprak = await ctx.prisma.$queryRaw<
          Array<{ document_id: string; language: string }>
        >`
          SELECT DISTINCT document_id, language FROM ftd_document_blocks
          WHERE document_id IN (${Prisma.join(docIds)})
        `;
        // Pågående oversettelser
        const pågående = await ctx.prisma.ftdTranslationJob.findMany({
          where: { documentId: { in: docIds }, status: { in: ["pending", "processing"] } },
          select: { documentId: true },
        });
        const pågåendeSet = new Set(pågående.map((p) => p.documentId));

        const språkPerDok = new Map<string, Set<string>>();
        for (const r of blokkSprak) {
          if (!språkPerDok.has(r.document_id)) språkPerDok.set(r.document_id, new Set());
          språkPerDok.get(r.document_id)!.add(r.language);
        }

        oversettStatusMap = new Map(
          docIds.map((id) => [id, {
            tilgjengelig: [...(språkPerDok.get(id) ?? [])],
            pågår: pågåendeSet.has(id),
          }]),
        );
      }

      return {
        dokumenter: docs.map((d) => ({
          ...d,
          chunksTotalt: statsMap.get(d.id)?.totalt ?? 0,
          chunksEmbedded: statsMap.get(d.id)?.embedded ?? 0,
          oversettelse: oversettStatusMap.get(d.id) ?? null,
        })),
        mappeSprak,
      };
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
      await ctx.prisma.ftdDocumentBlock.deleteMany({ where: { documentId: input.documentId } });
      await ctx.prisma.ftdTranslationJob.deleteMany({ where: { documentId: input.documentId } });
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
