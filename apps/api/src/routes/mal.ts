import { z } from "zod";
import type { Prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { reportObjectTypeSchema, templateZoneSchema, createTemplateSchema } from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

// Config-schema: aksepterer vilkårlig JSON for rapportobjekt-konfigurasjon
const configSchema = z.preprocess(
  (val) => val,
  z.record(z.string(), z.unknown()),
) as z.ZodType<Record<string, unknown>>;

export const malRouter = router({
  // Hent alle maler for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.reportTemplate.findMany({
        where: { projectId: input.projectId },
        include: {
          _count: { select: { objects: true, checklists: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  // Hent én mal med alle objekter
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mal = await ctx.prisma.reportTemplate.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          objects: { orderBy: { sortOrder: "asc" } },
          project: true,
        },
      });
      await verifiserProsjektmedlem(ctx.userId, mal.projectId);
      return mal;
    }),

  // Opprett ny mal (med valgfri entreprisetilknytning via arbeidsforløp)
  opprett: protectedProcedure
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { workflowIds, ...malData } = input;

      return ctx.prisma.$transaction(async (tx) => {
        const mal = await tx.reportTemplate.create({ data: malData });

        if (workflowIds.length > 0) {
          await tx.workflowTemplate.createMany({
            data: workflowIds.map((workflowId) => ({
              workflowId,
              templateId: mal.id,
            })),
          });
        }

        return mal;
      });
    }),

  // Oppdater mal (navn, beskrivelse, prefiks, fagområde)
  oppdaterMal: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        prefix: z.string().max(20).optional(),
        domain: z.enum(["bygg", "hms", "kvalitet"]).optional(),
        subjects: z.array(z.string().max(255)).optional(),
        showSubject: z.boolean().optional(),
        showEnterprise: z.boolean().optional(),
        showLocation: z.boolean().optional(),
        enableChangeLog: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const mal = await ctx.prisma.reportTemplate.findUniqueOrThrow({ where: { id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, mal.projectId);
      return ctx.prisma.reportTemplate.update({ where: { id }, data });
    }),

  // Slett mal
  slettMal: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const mal = await ctx.prisma.reportTemplate.findUniqueOrThrow({ where: { id: input.id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, mal.projectId);
      return ctx.prisma.reportTemplate.delete({ where: { id: input.id } });
    }),

  // Legg til rapportobjekt i mal
  leggTilObjekt: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        type: reportObjectTypeSchema,
        label: z.string().min(1),
        config: configSchema.default({}),
        sortOrder: z.number().int().min(0),
        required: z.boolean().default(false),
        parentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mal = await ctx.prisma.reportTemplate.findUniqueOrThrow({ where: { id: input.templateId }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, mal.projectId);
      const { parentId, ...rest } = input;
      return ctx.prisma.reportObject.create({
        data: {
          ...rest,
          config: rest.config as Prisma.InputJsonValue,
          ...(parentId !== undefined ? { parentId } : {}),
        },
      });
    }),

  // Oppdater et enkelt rapportobjekt
  oppdaterObjekt: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).optional(),
        required: z.boolean().optional(),
        config: configSchema.optional(),
        parentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const objekt = await ctx.prisma.reportObject.findUniqueOrThrow({ where: { id: input.id }, include: { template: { select: { projectId: true } } } });
      await verifiserProsjektmedlem(ctx.userId, objekt.template.projectId);
      const { id, config, parentId, ...rest } = input;
      return ctx.prisma.reportObject.update({
        where: { id },
        data: {
          ...rest,
          ...(config !== undefined
            ? { config: config as Prisma.InputJsonValue }
            : {}),
          ...(parentId !== undefined ? { parentId } : {}),
        },
      });
    }),

  // Oppdater rekkefølge, sone og parentId på objekter
  oppdaterRekkefølge: protectedProcedure
    .input(
      z.object({
        objekter: z.array(
          z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int().min(0),
            zone: templateZoneSchema.optional(),
            parentId: z.string().uuid().nullable().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const forsteObjekt = input.objekter[0];
      if (forsteObjekt) {
        const objekt = await ctx.prisma.reportObject.findUniqueOrThrow({ where: { id: forsteObjekt.id }, include: { template: { select: { projectId: true } } } });
        await verifiserProsjektmedlem(ctx.userId, objekt.template.projectId);
      }
      return ctx.prisma.$transaction(
        async (tx) => {
          const resultater = [];
          for (const obj of input.objekter) {
            const oppdatering: Record<string, unknown> = {
              sortOrder: obj.sortOrder,
            };

            // Oppdater parentId hvis angitt (inkludert null for å fjerne)
            if (obj.parentId !== undefined) {
              oppdatering.parentId = obj.parentId;
            }

            if (obj.zone) {
              const eksisterende = await tx.reportObject.findUniqueOrThrow({
                where: { id: obj.id },
              });
              const eksisterendeConfig =
                typeof eksisterende.config === "object" && eksisterende.config !== null
                  ? (eksisterende.config as Record<string, unknown>)
                  : {};
              oppdatering.config = { ...eksisterendeConfig, zone: obj.zone } as Prisma.InputJsonValue;
            }

            resultater.push(
              await tx.reportObject.update({
                where: { id: obj.id },
                data: oppdatering,
              }),
            );
          }
          return resultater;
        },
      );
    }),

  // Sjekk om et rapportobjekt (og evt. barn) har data i sjekklister/oppgaver
  sjekkObjektBruk: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const objekt = await ctx.prisma.reportObject.findUnique({
        where: { id: input.id },
        include: { template: { select: { projectId: true } } },
      });
      if (!objekt) return { sjekklister: [], oppgaver: [] };
      await verifiserProsjektmedlem(ctx.userId, objekt.template.projectId);

      // Hent alle objekter i malen for å finne etterkommere
      const alleObjekter = await ctx.prisma.reportObject.findMany({
        where: { templateId: objekt.templateId },
        select: { id: true, parentId: true },
      });

      // Samle alle IDer som vil bli slettet (objektet + alle etterkommere)
      const sletteIder = [input.id];
      function finnEtterkommere(parentId: string) {
        for (const o of alleObjekter) {
          if (o.parentId === parentId) {
            sletteIder.push(o.id);
            finnEtterkommere(o.id);
          }
        }
      }
      finnEtterkommere(input.id);

      // Hent sjekklister med data for noen av disse IDene (JSONB ?| operator)
      const sjekklisteIder = await ctx.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM checklists
        WHERE template_id = ${objekt.templateId}
        AND data IS NOT NULL
        AND data ?| ${sletteIder}
      `;

      // Hent oppgave-IDer med data for noen av disse IDene
      const oppgaveIder = await ctx.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM tasks
        WHERE template_id = ${objekt.templateId}
        AND data IS NOT NULL
        AND data ?| ${sletteIder}
      `;

      // Hent detaljer for berørte sjekklister
      const sjekklister = sjekklisteIder.length > 0
        ? await ctx.prisma.checklist.findMany({
            where: { id: { in: sjekklisteIder.map((r) => r.id) } },
            select: {
              id: true,
              title: true,
              number: true,
              status: true,
              template: { select: { prefix: true, projectId: true } },
            },
          })
        : [];

      // Hent detaljer for berørte oppgaver
      const oppgaver = oppgaveIder.length > 0
        ? await ctx.prisma.task.findMany({
            where: { id: { in: oppgaveIder.map((r) => r.id) } },
            select: {
              id: true,
              title: true,
              number: true,
              status: true,
              template: { select: { prefix: true, projectId: true } },
            },
          })
        : [];

      return { sjekklister, oppgaver };
    }),

  // Slett rapportobjekt
  slettObjekt: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const objekt = await ctx.prisma.reportObject.findUniqueOrThrow({ where: { id: input.id }, include: { template: { select: { projectId: true } } } });
      await verifiserProsjektmedlem(ctx.userId, objekt.template.projectId);
      return ctx.prisma.reportObject.delete({ where: { id: input.id } });
    }),
});
