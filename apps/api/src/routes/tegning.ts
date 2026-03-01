import { z } from "zod";
import { router, publicProcedure } from "../trpc/trpc";

export const tegningRouter = router({
  // Hent alle tegninger for et prosjekt
  hentForProsjekt: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.drawing.findMany({
        where: { projectId: input.projectId },
        include: { building: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
      });
    }),

  // Hent tegninger for en bygning
  hentForBygning: publicProcedure
    .input(z.object({ buildingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.drawing.findMany({
        where: { buildingId: input.buildingId },
        orderBy: { name: "asc" },
      });
    }),

  // Tilknytt eller fjern tegning fra bygning
  tilknyttBygning: publicProcedure
    .input(
      z.object({
        drawingId: z.string().uuid(),
        buildingId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.drawing.update({
        where: { id: input.drawingId },
        data: { buildingId: input.buildingId },
      });
    }),
});
