import { z } from "zod";
import type { Prisma } from "@siteflow/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { documentStatusSchema } from "@siteflow/shared";
import { isValidStatusTransition } from "@siteflow/shared";
import { TRPCError } from "@trpc/server";
import {
  byggTilgangsFilter,
  verifiserEntrepriseTilhorighet,
  verifiserDokumentTilgang,
} from "../trpc/tilgangskontroll";

export const sjekklisteRouter = router({
  // Hent alle sjekklister for et prosjekt (via mal)
  hentForProsjekt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: documentStatusSchema.optional(),
        buildingId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tilgangsFilter = await byggTilgangsFilter(ctx.userId, input.projectId);

      return ctx.prisma.checklist.findMany({
        where: {
          template: { projectId: input.projectId },
          ...(input.status ? { status: input.status } : {}),
          ...(input.buildingId ? { buildingId: input.buildingId } : {}),
          ...(tilgangsFilter ?? {}),
        },
        include: {
          template: true,
          creatorEnterprise: true,
          responderEnterprise: true,
          creator: true,
          building: { select: { id: true, name: true, number: true } },
          _count: { select: { images: true, transfers: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  // Hent én sjekkliste med alle detaljer
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: { include: { objects: { orderBy: { sortOrder: "asc" } } } },
          creatorEnterprise: true,
          responderEnterprise: true,
          creator: true,
          building: { select: { id: true, name: true } },
          drawing: { select: { id: true, name: true, drawingNumber: true } },
          images: true,
          transfers: {
            include: { sender: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      // Tilgangssjekk — hent projectId og domain fra malen
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.creatorEnterpriseId,
        sjekkliste.responderEnterpriseId,
        sjekkliste.template.domain,
      );

      return sjekkliste;
    }),

  // Opprett ny sjekkliste
  opprett: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        creatorEnterpriseId: z.string().uuid(),
        responderEnterpriseId: z.string().uuid(),
        title: z.string().max(255).optional(),
        workflowId: z.string().uuid().optional(),
        subject: z.string().max(500).optional(),
        buildingId: z.string().uuid().optional(),
        drawingId: z.string().uuid().optional(),
        dueDate: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verifiser at bruker tilhører oppretter-entreprisen
      await verifiserEntrepriseTilhorighet(ctx.userId, input.creatorEnterpriseId);

      return ctx.prisma.$transaction(async (tx) => {
        // Finn malens prefix, navn og prosjekt for autonummerering
        const mal = await tx.reportTemplate.findUniqueOrThrow({
          where: { id: input.templateId },
          select: { prefix: true, name: true, projectId: true },
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

        // Auto-generer tittel: "001BHO Byggelerers dagbok/kontroll"
        const tittel = input.title?.trim() || (() => {
          const nummerStr = nummer ? String(nummer).padStart(3, "0") : "";
          const prefiks = mal.prefix ?? "";
          return `${nummerStr}${prefiks} ${mal.name}`.trim();
        })();

        return tx.checklist.create({
          data: {
            templateId: input.templateId,
            creatorEnterpriseId: input.creatorEnterpriseId,
            responderEnterpriseId: input.responderEnterpriseId,
            title: tittel,
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
  oppdaterData: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tilgangssjekk
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: { template: { select: { projectId: true, domain: true } } },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.creatorEnterpriseId,
        sjekkliste.responderEnterpriseId,
        sjekkliste.template.domain,
      );

      return ctx.prisma.checklist.update({
        where: { id: input.id },
        data: { data: input.data as Prisma.InputJsonValue },
      });
    }),

  // Endre status (med overgangslogging)
  endreStatus: protectedProcedure
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
        include: { template: { select: { projectId: true, domain: true } } },
      });

      // Tilgangssjekk
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.creatorEnterpriseId,
        sjekkliste.responderEnterpriseId,
        sjekkliste.template.domain,
      );

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

  // Slett sjekkliste (blokkeres hvis tilknyttede oppgaver finnes)
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: { select: { projectId: true, domain: true } },
          _count: { select: { tasks: true } },
        },
      });

      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.creatorEnterpriseId,
        sjekkliste.responderEnterpriseId,
        sjekkliste.template.domain,
      );

      if (sjekkliste._count.tasks > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Kan ikke slette sjekklisten fordi den har ${sjekkliste._count.tasks} tilknyttede oppgaver`,
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.documentTransfer.deleteMany({ where: { checklistId: input.id } });
        await tx.image.deleteMany({ where: { checklistId: input.id } });
        await tx.checklist.delete({ where: { id: input.id } });
        return { success: true };
      });
    }),
});
