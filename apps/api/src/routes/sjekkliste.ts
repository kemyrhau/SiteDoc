import { z } from "zod";
import type { Prisma } from "@siteflow/db";
import { router, publicProcedure, protectedProcedure } from "../trpc/trpc";
import { documentStatusSchema } from "@siteflow/shared";
import { isValidStatusTransition } from "@siteflow/shared";
import { TRPCError } from "@trpc/server";

export const sjekklisteRouter = router({
  // Hent alle sjekklister for et prosjekt (via mal)
  hentForProsjekt: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: documentStatusSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.checklist.findMany({
        where: {
          template: { projectId: input.projectId },
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          template: true,
          creatorEnterprise: true,
          responderEnterprise: true,
          creator: true,
          _count: { select: { images: true, transfers: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  // Hent én sjekkliste med alle detaljer
  hentMedId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: { include: { objects: { orderBy: { sortOrder: "asc" } } } },
          creatorEnterprise: true,
          responderEnterprise: true,
          creator: true,
          images: true,
          transfers: {
            include: { sender: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }),

  // Opprett ny sjekkliste
  opprett: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        creatorEnterpriseId: z.string().uuid(),
        responderEnterpriseId: z.string().uuid(),
        title: z.string().min(1).max(255),
        workflowId: z.string().uuid().optional(),
        subject: z.string().max(500).optional(),
        buildingId: z.string().uuid().optional(),
        drawingId: z.string().uuid().optional(),
        dueDate: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        // Finn malens prefix og prosjekt for autonummerering
        const mal = await tx.reportTemplate.findUniqueOrThrow({
          where: { id: input.templateId },
          select: { prefix: true, projectId: true },
        });

        let nummer: number | undefined;
        if (mal.prefix) {
          // Finn høyeste nummer for denne malen i prosjektet
          const maks = await tx.checklist.aggregate({
            where: {
              templateId: input.templateId,
              number: { not: null },
            },
            _max: { number: true },
          });
          nummer = (maks._max.number ?? 0) + 1;
        }

        return tx.checklist.create({
          data: {
            templateId: input.templateId,
            creatorEnterpriseId: input.creatorEnterpriseId,
            responderEnterpriseId: input.responderEnterpriseId,
            title: input.title,
            creatorUserId: ctx.userId,
            number: nummer,
            workflowId: input.workflowId,
            subject: input.subject,
            buildingId: input.buildingId,
            drawingId: input.drawingId,
            dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
            status: "draft",
          },
        });
      });
    }),

  // Oppdater sjekklistedata (fylling av felter)
  oppdaterData: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.checklist.update({
        where: { id: input.id },
        data: { data: input.data as Prisma.InputJsonValue },
      });
    }),

  // Endre status (med overgangslogging)
  endreStatus: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nyStatus: documentStatusSchema,
        senderId: z.string().uuid(),
        kommentar: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (!isValidStatusTransition(sjekkliste.status, input.nyStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ugyldig statusovergang fra "${sjekkliste.status}" til "${input.nyStatus}"`,
        });
      }

      // Oppdater status og logg overgangen i en transaksjon
      return ctx.prisma.$transaction(async (tx) => {
        const oppdatert = await tx.checklist.update({
          where: { id: input.id },
          data: { status: input.nyStatus },
        });

        await tx.documentTransfer.create({
          data: {
            checklistId: input.id,
            senderId: input.senderId,
            fromStatus: sjekkliste.status,
            toStatus: input.nyStatus,
            comment: input.kommentar,
          },
        });

        return oppdatert;
      });
    }),
});
