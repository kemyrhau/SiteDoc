import { z } from "zod";
import { router, publicProcedure } from "../trpc/trpc";
import { createBuildingSchema } from "@siteflow/shared";

export const bygningRouter = router({
  // Hent alle bygninger for et prosjekt
  hentForProsjekt: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.building.findMany({
        where: { projectId: input.projectId },
        include: {
          drawings: { select: { id: true, name: true } },
          _count: { select: { drawings: true } },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Hent én bygning med ID
  hentMedId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.building.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          project: true,
          drawings: true,
        },
      });
    }),

  // Opprett ny bygning
  opprett: publicProcedure
    .input(createBuildingSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.building.create({ data: input });
    }),

  // Oppdater bygning
  oppdater: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        address: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.building.update({ where: { id }, data });
    }),

  // Publiser bygning
  publiser: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.building.update({
        where: { id: input.id },
        data: { status: "published" },
      });
    }),

  // Slett bygning
  slett: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.building.delete({ where: { id: input.id } });
    }),
});
