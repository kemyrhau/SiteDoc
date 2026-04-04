import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

export const kontraktRouter = router({
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.ftdKontrakt.findMany({
        where: { projectId: input.projectId },
        include: {
          building: { select: { id: true, name: true, number: true } },
          _count: { select: { entrepriser: true, dokumenter: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  opprett: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        navn: z.string().min(1),
        kontraktType: z.enum(["8405", "8406", "8407"]).optional(),
        byggherre: z.string().optional(),
        entreprenor: z.string().optional(),
        buildingId: z.string().uuid().optional(),
        hmsSamordningsgruppe: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.ftdKontrakt.create({
        data: {
          projectId: input.projectId,
          navn: input.navn,
          kontraktType: input.kontraktType ?? null,
          byggherre: input.byggherre ?? null,
          entreprenor: input.entreprenor ?? null,
          buildingId: input.buildingId ?? null,
          hmsSamordningsgruppe: input.hmsSamordningsgruppe ?? null,
        },
      });
    }),

  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        navn: z.string().min(1).optional(),
        kontraktType: z.enum(["8405", "8406", "8407"]).nullable().optional(),
        byggherre: z.string().nullable().optional(),
        entreprenor: z.string().nullable().optional(),
        buildingId: z.string().uuid().nullable().optional(),
        hmsSamordningsgruppe: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.ftdKontrakt.update({
        where: { id },
        data,
      });
    }),

  slett: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fjern kontrakt-kobling fra entrepriser og dokumenter først
      await ctx.prisma.enterprise.updateMany({
        where: { kontraktId: input.id },
        data: { kontraktId: null },
      });
      await ctx.prisma.ftdDocument.updateMany({
        where: { kontraktId: input.id },
        data: { kontraktId: null },
      });
      return ctx.prisma.ftdKontrakt.delete({ where: { id: input.id } });
    }),
});
