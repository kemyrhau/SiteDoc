/**
 * AI-søk router: hybrid vektor+leksikalsk søk, embedding-generering, innstillinger.
 * Portert fra Fil til database-kopi.
 */
import { z } from "zod";
import { Prisma, type PrismaClient } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  verifiserProsjektmedlem,
  verifiserAdmin,
} from "../trpc/tilgangskontroll";
import { hentTilgjengeligeMappeIder } from "../services/folder-tilgang";
import {
  hybridSok,
  DEFAULT_VEKTER,
} from "../services/ai-sok-service";
import {
  startEmbeddingGenerering,
  stoppEmbeddingGenerering,
  hentEmbeddingStatus,
} from "../services/embedding-service";

const vekterSchema = z.object({
  recall: z.number().min(0).max(1).optional(),
  precision: z.number().min(0).max(1).optional(),
  latency: z.number().min(0).max(1).optional(),
  phraseWeight: z.number().min(0).max(1).optional(),
  termWeight: z.number().min(0).max(1).optional(),
  qualityWeight: z.number().min(0).max(1).optional(),
  headingWeight: z.number().min(0).max(1).optional(),
  bm25Weight: z.number().min(0).max(1).optional(),
  pageposWeight: z.number().min(0).max(1).optional(),
});

export const aiSokRouter = router({
  /** Hybrid søk: vektor + leksikalsk + re-ranking */
  sok: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        query: z.string().min(1),
        topK: z.number().default(20),
        dokumentIder: z.array(z.string()).optional(),
        ekskluderMappeIder: z.array(z.string()).optional(),
        vekter: vekterSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const mappeIder = await hentTilgjengeligeMappeIder(
        ctx.userId,
        input.projectId,
      );

      const innstillinger = await hentInnstillingerInternt(
        ctx.prisma,
        input.projectId,
      );

      // NorBERT krever ingen API-nøkkel, OpenAI krever
      if (
        innstillinger.embeddingProvider === "openai" &&
        !innstillinger.embeddingApiKey
      ) {
        throw new Error(
          "OpenAI API-nøkkel mangler. Konfigurer under Oppsett → AI-søk.",
        );
      }

      return hybridSok(ctx.prisma, input.projectId, input.query, mappeIder, {
        provider: innstillinger.embeddingProvider as "local" | "openai",
        apiKey: innstillinger.embeddingApiKey ?? undefined,
        model: innstillinger.embeddingModel,
        vekter: input.vekter,
        topK: input.topK,
        dokumentIder: input.dokumentIder,
        ekskluderMappeIder: input.ekskluderMappeIder,
      });
    }),

  /** Trigger embedding-generering for alle pending chunks */
  genererEmbeddings: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { appendFileSync } = await import("fs");
      const { join } = await import("path");
      const _log = (m: string) => {
        try { appendFileSync(join(process.cwd(), "embedding.log"), `[${new Date().toISOString()}] ${m}\n`); } catch (_e) { /* */ }
      };

      _log(`genererEmbeddings kallt med projectId=${input.projectId}`);
      await verifiserAdmin(ctx.userId, input.projectId);
      _log("verifiserAdmin OK");

      const innstillinger = await hentInnstillingerInternt(
        ctx.prisma,
        input.projectId,
      );

      if (
        innstillinger.embeddingProvider === "openai" &&
        !innstillinger.embeddingApiKey
      ) {
        throw new Error("OpenAI API-nøkkel mangler");
      }

      _log(`Innstillinger: provider=${innstillinger.embeddingProvider}, model=${innstillinger.embeddingModel}`);

      // Fire-and-forget — kjører i bakgrunnen
      startEmbeddingGenerering(ctx.prisma, input.projectId, {
        provider: innstillinger.embeddingProvider as "local" | "openai",
        apiKey: innstillinger.embeddingApiKey ?? undefined,
        model: innstillinger.embeddingModel,
        batchSize: innstillinger.embeddingProvider === "local" ? 8 : 64,
      }).catch((err) => {
        const { appendFileSync } = require("fs");
        const { join } = require("path");
        const msg = `[${new Date().toISOString()}] [AI-SØK] Embedding feilet: ${err?.message ?? err}\n${err?.stack ?? ""}\n`;
        try { appendFileSync(join(process.cwd(), "embedding.log"), msg); } catch (_e) { /* */ }
      });

      return { startet: true };
    }),

  /** Stopp pågående embedding-generering */
  stoppEmbeddings: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      stoppEmbeddingGenerering();
      return { stoppet: true };
    }),

  /** Hent embedding-status (antall chunks, ferdig, ventende) */
  embeddingStatus: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return hentEmbeddingStatus(ctx.prisma, input.projectId);
    }),

  /** Hent referansedokumenter (NS 3420 etc) for filter-dropdown */
  hentReferanseDokumenter: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // Finn mapper som inneholder NS/standard-dokumenter
      const nsDokumenter = await ctx.prisma.ftdDocument.findMany({
        where: {
          projectId: input.projectId,
          isActive: true,
          OR: [
            { filename: { contains: "3420" } },
            { filename: { contains: "8405" } },
            { filename: { contains: "8406" } },
            { filename: { contains: "8407" } },
            { filename: { contains: "ns-" } },
            { filename: { startsWith: "NS " } },
          ],
        },
        select: {
          id: true,
          filename: true,
          folderId: true,
          folder: { select: { id: true, name: true } },
        },
        orderBy: { filename: "asc" },
      });

      // Grupper per mappe
      const mapper = new Map<string, { id: string; navn: string; dokumenter: typeof nsDokumenter }>();
      for (const d of nsDokumenter) {
        const mappeId = d.folderId ?? "__ingen__";
        const mappeNavn = d.folder?.name ?? "Uten mappe";
        if (!mapper.has(mappeId)) {
          mapper.set(mappeId, { id: mappeId, navn: mappeNavn, dokumenter: [] });
        }
        mapper.get(mappeId)!.dokumenter.push(d);
      }

      return {
        dokumenter: nsDokumenter.map((d) => ({
          id: d.id,
          filename: d.filename,
          folderId: d.folderId,
        })),
        mapper: [...mapper.values()],
      };
    }),

  /** Hent AI-søk innstillinger for prosjektet */
  hentInnstillinger: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      const innst = await ctx.prisma.$queryRaw<
        Array<{
          embeddingProvider: string | null;
          embeddingModel: string | null;
          embeddingApiKey: string | null;
          llmProvider: string | null;
          llmModel: string | null;
          llmApiKey: string | null;
          vekter: unknown;
        }>
      >`
        SELECT
          embedding_provider AS "embeddingProvider",
          embedding_model AS "embeddingModel",
          embedding_api_key AS "embeddingApiKey",
          llm_provider AS "llmProvider",
          llm_model AS "llmModel",
          llm_api_key AS "llmApiKey",
          vekter
        FROM ai_sok_innstillinger
        WHERE project_id = ${input.projectId}
        LIMIT 1
      `;

      if (innst.length === 0) {
        return {
          embeddingProvider: "local",
          embeddingModel: "norbert2",
          embeddingApiKey: null,
          llmProvider: null,
          llmModel: "claude-sonnet-4-5",
          llmApiKey: null,
          vekter: DEFAULT_VEKTER,
        };
      }

      const rad = innst[0]!;
      return {
        ...rad,
        // Maskér API-nøkler (vis bare siste 4 tegn)
        embeddingApiKey: rad.embeddingApiKey
          ? `...${rad.embeddingApiKey.slice(-4)}`
          : null,
        llmApiKey: rad.llmApiKey
          ? `...${rad.llmApiKey.slice(-4)}`
          : null,
        vekter: (rad.vekter as Record<string, number>) ?? DEFAULT_VEKTER,
      };
    }),

  /** Oppdater AI-søk innstillinger */
  oppdaterInnstillinger: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        embeddingProvider: z.string().optional(),
        embeddingModel: z.string().optional(),
        embeddingApiKey: z.string().optional(),
        llmProvider: z.string().optional(),
        llmModel: z.string().optional(),
        llmApiKey: z.string().optional(),
        vekter: vekterSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      const vekterJson = input.vekter
        ? JSON.stringify(input.vekter)
        : null;

      await ctx.prisma.$executeRaw`
        INSERT INTO ai_sok_innstillinger (
          project_id,
          embedding_provider,
          embedding_model,
          embedding_api_key,
          llm_provider,
          llm_model,
          llm_api_key,
          vekter
        ) VALUES (
          ${input.projectId},
          ${input.embeddingProvider ?? "openai"},
          ${input.embeddingModel ?? "text-embedding-3-small"},
          ${input.embeddingApiKey ?? null},
          ${input.llmProvider ?? null},
          ${input.llmModel ?? "claude-sonnet-4-5"},
          ${input.llmApiKey ?? null},
          ${vekterJson}::jsonb
        )
        ON CONFLICT (project_id) DO UPDATE SET
          embedding_provider = COALESCE(EXCLUDED.embedding_provider, ai_sok_innstillinger.embedding_provider),
          embedding_model = COALESCE(EXCLUDED.embedding_model, ai_sok_innstillinger.embedding_model),
          embedding_api_key = CASE
            WHEN EXCLUDED.embedding_api_key IS NOT NULL THEN EXCLUDED.embedding_api_key
            ELSE ai_sok_innstillinger.embedding_api_key
          END,
          llm_provider = COALESCE(EXCLUDED.llm_provider, ai_sok_innstillinger.llm_provider),
          llm_model = COALESCE(EXCLUDED.llm_model, ai_sok_innstillinger.llm_model),
          llm_api_key = CASE
            WHEN EXCLUDED.llm_api_key IS NOT NULL THEN EXCLUDED.llm_api_key
            ELSE ai_sok_innstillinger.llm_api_key
          END,
          vekter = COALESCE(EXCLUDED.vekter, ai_sok_innstillinger.vekter),
          updated_at = NOW()
      `;

      return { oppdatert: true };
    }),
});

// ---- Intern hjelpefunksjon ----

async function hentInnstillingerInternt(
  prisma: PrismaClient,
  projectId: string,
): Promise<{
  embeddingProvider: string;
  embeddingApiKey: string | null;
  embeddingModel: string;
}> {
  const rows = await prisma.$queryRaw<
    Array<{
      embeddingProvider: string | null;
      embeddingApiKey: string | null;
      embeddingModel: string | null;
    }>
  >`
    SELECT
      embedding_provider AS "embeddingProvider",
      embedding_api_key AS "embeddingApiKey",
      embedding_model AS "embeddingModel"
    FROM ai_sok_innstillinger
    WHERE project_id = ${projectId}
    LIMIT 1
  `;
  const rad = rows[0];
  return {
    embeddingProvider: rad?.embeddingProvider ?? "local",
    embeddingApiKey: rad?.embeddingApiKey ?? null,
    embeddingModel: rad?.embeddingModel ?? "norbert2",
  };
}
