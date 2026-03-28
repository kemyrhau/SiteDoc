import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import {
  hentTilgjengeligeMappeIder,
  byggMappeTilgangsFilter,
} from "../services/folder-tilgang";

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
      const mappeFilter = byggMappeTilgangsFilter(mappeIder);

      return ctx.prisma.ftdDocumentChunk.findMany({
        where: {
          document: {
            projectId: input.projectId,
            ...mappeFilter,
          },
          chunkText: { contains: input.query, mode: "insensitive" },
        },
        include: {
          document: {
            select: {
              filename: true,
              fileUrl: true,
              docType: true,
              folderId: true,
            },
          },
        },
        take: input.limit,
      });
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
