import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { byggTilgangsFilter } from "../trpc/tilgangskontroll";

export const bildeRouter = router({
  hentForProsjekt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        byggeplassId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const tilgangsFilter = await byggTilgangsFilter(ctx.userId, input.projectId);

      // Hent bilder via sjekklister
      const sjekklisteBilder = await ctx.prisma.image.findMany({
        where: {
          checklistId: { not: null },
          checklist: {
            template: { projectId: input.projectId },
            ...(input.byggeplassId ? { byggeplassId: input.byggeplassId } : {}),
            ...(tilgangsFilter ?? {}),
          },
        },
        include: {
          checklist: {
            select: {
              id: true,
              status: true,
              number: true,
              drawingId: true,
              byggeplassId: true,
              byggeplass: { select: { id: true, name: true } },
              drawing: {
                select: {
                  id: true,
                  name: true,
                  floor: true,
                  geoReference: true,
                  fileUrl: true,
                  fileType: true,
                  byggeplassId: true,
                },
              },
              template: {
                select: {
                  id: true,
                  prefix: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Hent bilder via oppgaver
      const oppgaveBilder = await ctx.prisma.image.findMany({
        where: {
          taskId: { not: null },
          task: {
            template: { projectId: input.projectId },
            ...(input.byggeplassId ? { OR: [{ drawing: { byggeplassId: input.byggeplassId } }, { drawingId: null }] } : {}),
            ...(tilgangsFilter ?? {}),
          },
        },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              number: true,
              drawingId: true,
              positionX: true,
              positionY: true,
              drawing: {
                select: {
                  id: true,
                  name: true,
                  floor: true,
                  geoReference: true,
                  fileUrl: true,
                  fileType: true,
                  byggeplassId: true,
                },
              },
              template: {
                select: {
                  id: true,
                  prefix: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return { sjekklisteBilder, oppgaveBilder };
    }),

  opprettForSjekkliste: protectedProcedure
    .input(
      z.object({
        checklistId: z.string().uuid(),
        fileUrl: z.string(),
        fileName: z.string(),
        fileSize: z.number().int(),
        gpsLat: z.number().optional(),
        gpsLng: z.number().optional(),
        gpsEnabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.checklistId },
        include: { template: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, sjekkliste.template.projectId);

      return ctx.prisma.image.create({
        data: {
          checklistId: input.checklistId,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          fileSize: input.fileSize,
          gpsLat: input.gpsLat ?? null,
          gpsLng: input.gpsLng ?? null,
          gpsEnabled: input.gpsEnabled,
        },
      });
    }),

  opprettForOppgave: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        fileUrl: z.string(),
        fileName: z.string(),
        fileSize: z.number().int(),
        gpsLat: z.number().optional(),
        gpsLng: z.number().optional(),
        gpsEnabled: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: { template: { select: { projectId: true } } },
      });
      if (!oppgave.template) {
        throw new Error("Oppgaven mangler mal-tilknytning");
      }
      await verifiserProsjektmedlem(ctx.userId, oppgave.template.projectId);

      return ctx.prisma.image.create({
        data: {
          taskId: input.taskId,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          fileSize: input.fileSize,
          gpsLat: input.gpsLat ?? null,
          gpsLng: input.gpsLng ?? null,
          gpsEnabled: input.gpsEnabled,
        },
      });
    }),

  // Slett bilde(r) basert på fil-URL
  slettMedUrl: protectedProcedure
    .input(z.object({ fileUrl: z.string(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const resultat = await ctx.prisma.image.deleteMany({
        where: { fileUrl: input.fileUrl },
      });
      return { slettet: resultat.count };
    }),
});
