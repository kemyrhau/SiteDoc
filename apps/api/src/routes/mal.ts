import { z } from "zod";
import type { Prisma } from "@siteflow/db";
import { router, publicProcedure } from "../trpc/trpc";
import { reportObjectTypeSchema, templateZoneSchema } from "@siteflow/shared";

// Config-schema: aksepterer vilkårlig JSON for rapportobjekt-konfigurasjon
const configSchema = z.preprocess(
  (val) => val,
  z.record(z.string(), z.unknown()),
) as z.ZodType<Record<string, unknown>>;

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
        config: configSchema.default({}),
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

  // Oppdater et enkelt rapportobjekt
  oppdaterObjekt: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).optional(),
        required: z.boolean().optional(),
        config: configSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, config, ...rest } = input;
      return ctx.prisma.reportObject.update({
        where: { id },
        data: {
          ...rest,
          ...(config !== undefined
            ? { config: config as Prisma.InputJsonValue }
            : {}),
        },
      });
    }),

  // Oppdater rekkefølge og sone på objekter
  oppdaterRekkefølge: publicProcedure
    .input(
      z.object({
        objekter: z.array(
          z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int().min(0),
            zone: templateZoneSchema.optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(
        async (tx) => {
          const resultater = [];
          for (const obj of input.objekter) {
            if (obj.zone) {
              const eksisterende = await tx.reportObject.findUniqueOrThrow({
                where: { id: obj.id },
              });
              const eksisterendeConfig =
                typeof eksisterende.config === "object" && eksisterende.config !== null
                  ? (eksisterende.config as Record<string, unknown>)
                  : {};
              resultater.push(
                await tx.reportObject.update({
                  where: { id: obj.id },
                  data: {
                    sortOrder: obj.sortOrder,
                    config: { ...eksisterendeConfig, zone: obj.zone } as Prisma.InputJsonValue,
                  },
                }),
              );
            } else {
              resultater.push(
                await tx.reportObject.update({
                  where: { id: obj.id },
                  data: { sortOrder: obj.sortOrder },
                }),
              );
            }
          }
          return resultater;
        },
      );
    }),

  // Slett rapportobjekt
  slettObjekt: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.reportObject.delete({ where: { id: input.id } });
    }),
});
