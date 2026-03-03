import { z } from "zod";
import { router, publicProcedure } from "../trpc/trpc";
import { createBuildingSchema } from "@siteflow/shared";

export const bygningRouter = router({
  // Hent alle bygninger for et prosjekt
  hentForProsjekt: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.building.findMany({
        where: {
          projectId: input.projectId,
          ...(input.type ? { type: input.type } : {}),
        },
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

  // Slett bygning (kun hvis tom — ingen tegninger eller sjekklister)
  slett: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const bygning = await ctx.prisma.building.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          _count: {
            select: {
              drawings: true,
              checklists: true,
            },
          },
        },
      });

      const blokkerende: string[] = [];
      if (bygning._count.drawings > 0) {
        blokkerende.push(`${bygning._count.drawings} tegning${bygning._count.drawings !== 1 ? "er" : ""}`);
      }
      if (bygning._count.checklists > 0) {
        blokkerende.push(`${bygning._count.checklists} sjekkliste${bygning._count.checklists !== 1 ? "r" : ""}`);
      }

      if (blokkerende.length > 0) {
        throw new Error(
          `Kan ikke slette «${bygning.name}» fordi den inneholder ${blokkerende.join(" og ")}. Fjern eller flytt disse først.`,
        );
      }

      return ctx.prisma.building.delete({ where: { id: input.id } });
    }),
});
