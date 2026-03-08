import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { createBuildingSchema } from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

export const bygningRouter = router({
  // Hent alle bygninger for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.building.findMany({
        where: {
          projectId: input.projectId,
          ...(input.type ? { type: input.type } : {}),
        },
        include: {
          drawings: {
            select: {
              id: true,
              name: true,
              drawingNumber: true,
              discipline: true,
              floor: true,
              geoReference: true,
            },
            orderBy: [
              { discipline: "asc" },
              { drawingNumber: "asc" },
              { name: "asc" },
            ],
          },
          _count: { select: { drawings: true } },
        },
        orderBy: { number: "asc" },
      });
    }),

  // Hent én bygning med ID
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bygning = await ctx.prisma.building.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          project: true,
          drawings: true,
        },
      });
      await verifiserProsjektmedlem(ctx.userId, bygning.projectId);
      return bygning;
    }),

  // Opprett ny bygning
  opprett: protectedProcedure
    .input(createBuildingSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      // Auto-generer nummer per prosjekt
      const maks = await ctx.prisma.building.aggregate({
        where: { projectId: input.projectId },
        _max: { number: true },
      });
      const nesteNummer = (maks._max.number ?? 0) + 1;

      return ctx.prisma.building.create({
        data: { ...input, number: nesteNummer },
      });
    }),

  // Oppdater bygning
  oppdater: protectedProcedure
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
      const bygning = await ctx.prisma.building.findUniqueOrThrow({ where: { id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, bygning.projectId);
      return ctx.prisma.building.update({ where: { id }, data });
    }),

  // Publiser bygning
  publiser: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const bygning = await ctx.prisma.building.findUniqueOrThrow({ where: { id: input.id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, bygning.projectId);
      return ctx.prisma.building.update({
        where: { id: input.id },
        data: { status: "published" },
      });
    }),

  // Slett bygning (kun hvis tom — ingen tegninger eller sjekklister)
  slett: protectedProcedure
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
      await verifiserProsjektmedlem(ctx.userId, bygning.projectId);

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
