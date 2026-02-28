import { z } from "zod";
import type { Prisma } from "@siteflow/db";
import { router, publicProcedure } from "../trpc/trpc";
import { reportObjectTypeSchema } from "@siteflow/shared";

export const malRouter = router({
  // Hent alle maler for et prosjekt
  hentForProsjekt: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.reportTemplate.findMany({
        where: { projectId: input.projectId },
        include: {
          _count: { select: { objects: true, checklists: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  // Hent én mal med alle objekter
  hentMedId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.reportTemplate.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          objects: { orderBy: { sortOrder: "asc" } },
          project: true,
        },
      });
    }),

  // Opprett ny mal
  opprett: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.reportTemplate.create({ data: input });
    }),

  // Legg til rapportobjekt i mal
  leggTilObjekt: publicProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        type: reportObjectTypeSchema,
        label: z.string().min(1),
        config: z.record(z.string(), z.unknown()).default({}),
        sortOrder: z.number().int().min(0),
        required: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.reportObject.create({
        data: {
          ...input,
          config: input.config as Prisma.InputJsonValue,
        },
      });
    }),

  // Oppdater rekkefølge på objekter
  oppdaterRekkefølge: publicProcedure
    .input(
      z.object({
        objekter: z.array(
          z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int().min(0),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(
        input.objekter.map((obj) =>
          ctx.prisma.reportObject.update({
            where: { id: obj.id },
            data: { sortOrder: obj.sortOrder },
          }),
        ),
      );
    }),

  // Slett rapportobjekt
  slettObjekt: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.reportObject.delete({ where: { id: input.id } });
    }),
});
