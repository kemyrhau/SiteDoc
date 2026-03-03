import { z } from "zod";
import { router, publicProcedure } from "../trpc/trpc";

export const mappeRouter = router({
  // Hent alle mapper for et prosjekt (flat liste med parentId)
  hentForProsjekt: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.folder.findMany({
        where: { projectId: input.projectId },
        include: {
          _count: { select: { documents: true } },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Opprett ny mappe
  opprett: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(255),
        parentId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.folder.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          parentId: input.parentId ?? null,
        },
      });
    }),

  // Oppdater mappe (gi nytt navn)
  oppdater: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.folder.update({
        where: { id: input.id },
        data: { name: input.name },
      });
    }),

  // Slett mappe (kaskaderer til undermapper og dokumenter)
  slett: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.folder.delete({ where: { id: input.id } });
    }),

  // Hent dokumenter for en mappe
  hentDokumenter: publicProcedure
    .input(z.object({ folderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.document.findMany({
        where: { folderId: input.folderId },
        orderBy: { name: "asc" },
      });
    }),
});
