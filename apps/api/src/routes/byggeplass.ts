import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { createByggeplassSchema } from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

export const byggeplassRouter = router({
  // Hent alle byggeplasser for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.byggeplass.findMany({
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
              fileType: true,
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

  // Hent én byggeplass med ID
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          project: true,
          drawings: true,
        },
      });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return byggeplass;
    }),

  // Opprett ny byggeplass
  opprett: protectedProcedure
    .input(createByggeplassSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      // Auto-generer nummer per prosjekt
      const maks = await ctx.prisma.byggeplass.aggregate({
        where: { projectId: input.projectId },
        _max: { number: true },
      });
      const nesteNummer = (maks._max.number ?? 0) + 1;

      return ctx.prisma.byggeplass.create({
        data: { ...input, number: nesteNummer },
      });
    }),

  // Oppdater byggeplass
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
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({ where: { id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return ctx.prisma.byggeplass.update({ where: { id }, data });
    }),

  // Publiser byggeplass
  publiser: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({ where: { id: input.id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return ctx.prisma.byggeplass.update({
        where: { id: input.id },
        data: { status: "published" },
      });
    }),

  // Slett byggeplass (kun hvis tom — ingen tegninger eller sjekklister)
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
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
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);

      const blokkerende: string[] = [];
      if (byggeplass._count.drawings > 0) {
        blokkerende.push(`${byggeplass._count.drawings} tegning${byggeplass._count.drawings !== 1 ? "er" : ""}`);
      }
      if (byggeplass._count.checklists > 0) {
        blokkerende.push(`${byggeplass._count.checklists} sjekkliste${byggeplass._count.checklists !== 1 ? "r" : ""}`);
      }

      if (blokkerende.length > 0) {
        throw new Error(
          `Kan ikke slette «${byggeplass.name}» fordi den inneholder ${blokkerende.join(" og ")}. Fjern eller flytt disse først.`,
        );
      }

      return ctx.prisma.byggeplass.delete({ where: { id: input.id } });
    }),
});
