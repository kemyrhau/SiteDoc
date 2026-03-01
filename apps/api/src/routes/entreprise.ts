import { z } from "zod";
import { router, publicProcedure } from "../trpc/trpc";
import { createEnterpriseSchema } from "@siteflow/shared";

export const entrepriseRouter = router({
  // Hent alle entrepriser for et prosjekt
  hentForProsjekt: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.enterprise.findMany({
        where: { projectId: input.projectId },
        include: {
          members: { include: { user: true } },
          _count: {
            select: {
              createdChecklists: true,
              respondChecklists: true,
              createdTasks: true,
              respondTasks: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Hent én entreprise med ID
  hentMedId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.enterprise.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          project: true,
          members: { include: { user: true } },
        },
      });
    }),

  // Opprett ny entreprise
  opprett: publicProcedure
    .input(createEnterpriseSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.enterprise.create({ data: input });
    }),

  // Oppdater entreprise
  oppdater: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        organizationNumber: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.enterprise.update({ where: { id }, data });
    }),

  // Slett entreprise
  slett: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.enterprise.delete({ where: { id: input.id } });
    }),
});
