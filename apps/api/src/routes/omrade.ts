import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

const polygonPunktSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export const omradeRouter = router({
  // Hent alle områder for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.omrade.findMany({
        where: {
          projectId: input.projectId,
          ...(input.type ? { type: input.type } : {}),
        },
        include: {
          byggeplass: { select: { id: true, name: true } },
          tegning: { select: { id: true, name: true, drawingNumber: true } },
        },
        orderBy: [{ byggeplass: { number: "asc" } }, { sortering: "asc" }, { navn: "asc" }],
      });
    }),

  // Hent områder for en bestemt byggeplass
  hentForByggeplass: protectedProcedure
    .input(z.object({
      byggeplassId: z.string(),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.byggeplassId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return ctx.prisma.omrade.findMany({
        where: {
          byggeplassId: input.byggeplassId,
          ...(input.type ? { type: input.type } : {}),
        },
        include: {
          tegning: { select: { id: true, name: true, drawingNumber: true } },
        },
        orderBy: [{ sortering: "asc" }, { navn: "asc" }],
      });
    }),

  // Hent områder for en bestemt tegning
  hentForTegning: protectedProcedure
    .input(z.object({ tegningId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({
        where: { id: input.tegningId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return ctx.prisma.omrade.findMany({
        where: { tegningId: input.tegningId },
        orderBy: [{ sortering: "asc" }, { navn: "asc" }],
      });
    }),

  // Opprett nytt område
  opprett: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      byggeplassId: z.string(),
      tegningId: z.string().uuid().optional(),
      navn: z.string().min(1).max(255),
      type: z.enum(["sone", "rom", "etasje"]).default("sone"),
      polygon: z.array(polygonPunktSchema).default([]),
      farge: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const maks = await ctx.prisma.omrade.aggregate({
        where: { byggeplassId: input.byggeplassId },
        _max: { sortering: true },
      });
      return ctx.prisma.omrade.create({
        data: {
          ...input,
          polygon: input.polygon,
          sortering: (maks._max.sortering ?? 0) + 1,
        },
      });
    }),

  // Oppdater område
  oppdater: protectedProcedure
    .input(z.object({
      id: z.string(),
      navn: z.string().min(1).max(255).optional(),
      type: z.enum(["sone", "rom", "etasje"]).optional(),
      polygon: z.array(polygonPunktSchema).optional(),
      farge: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      tegningId: z.string().uuid().nullable().optional(),
      sortering: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, polygon, ...data } = input;
      const omrade = await ctx.prisma.omrade.findUniqueOrThrow({ where: { id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, omrade.projectId);
      return ctx.prisma.omrade.update({
        where: { id },
        data: {
          ...data,
          ...(polygon !== undefined ? { polygon } : {}),
        },
      });
    }),

  // Slett område (kun hvis ingen kontrollplanpunkter er koblet)
  slett: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const omrade = await ctx.prisma.omrade.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, omrade.projectId);
      return ctx.prisma.omrade.delete({ where: { id: input.id } });
    }),
});
