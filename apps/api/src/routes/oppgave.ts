import { z } from "zod";
import type { Prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { documentStatusSchema } from "@sitedoc/shared";
import { isValidStatusTransition } from "@sitedoc/shared";
import { TRPCError } from "@trpc/server";
import {
  byggTilgangsFilter,
  verifiserEntrepriseTilhorighet,
  verifiserDokumentTilgang,
  verifiserProsjektmedlem,
} from "../trpc/tilgangskontroll";

export const oppgaveRouter = router({
  // Hent alle oppgaver for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: documentStatusSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tilgangsFilter = await byggTilgangsFilter(ctx.userId, input.projectId);

      return ctx.prisma.task.findMany({
        where: {
          creatorEnterprise: { projectId: input.projectId },
          ...(input.status ? { status: input.status } : {}),
          ...(tilgangsFilter ?? {}),
        },
        include: {
          template: true,
          creator: true,
          creatorEnterprise: true,
          responderEnterprise: true,
          _count: { select: { images: true, transfers: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  // Hent oppgavemarkører for en tegning
  hentForTegning: protectedProcedure
    .input(z.object({ drawingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const drawing = await ctx.prisma.drawing.findUniqueOrThrow({
        where: { id: input.drawingId },
        select: { building: { select: { projectId: true } } },
      });
      if (!drawing.building) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tegningen er ikke tilknyttet en lokasjon" });
      }
      await verifiserProsjektmedlem(ctx.userId, drawing.building.projectId);

      return ctx.prisma.task.findMany({
        where: {
          drawingId: input.drawingId,
          positionX: { not: null },
          positionY: { not: null },
        },
        select: {
          id: true,
          title: true,
          number: true,
          status: true,
          positionX: true,
          positionY: true,
          template: { select: { prefix: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Hent én oppgave med alle detaljer
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: {
            include: {
              objects: { orderBy: { sortOrder: "asc" } },
            },
          },
          creator: true,
          creatorEnterprise: true,
          responderEnterprise: true,
          drawing: true,
          checklist: {
            include: {
              template: { select: { prefix: true, name: true } },
            },
          },
          images: true,
          transfers: {
            include: { sender: true },
            orderBy: { createdAt: "desc" },
          },
          comments: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      // Tilgangssjekk via oppretter-entreprisens prosjekt
      await verifiserDokumentTilgang(
        ctx.userId,
        oppgave.creatorEnterprise.projectId,
        oppgave.creatorEnterpriseId,
        oppgave.responderEnterpriseId,
        oppgave.template?.domain,
      );

      return oppgave;
    }),

  // Hent kommentarer for en oppgave
  hentKommentarer: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: {
          creatorEnterprise: { select: { projectId: true } },
          template: { select: { domain: true } },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        oppgave.creatorEnterprise.projectId,
        oppgave.creatorEnterpriseId,
        oppgave.responderEnterpriseId,
        oppgave.template?.domain,
      );

      return ctx.prisma.taskComment.findMany({
        where: { taskId: input.taskId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Legg til kommentar på en oppgave
  leggTilKommentar: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        content: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: {
          creatorEnterprise: { select: { projectId: true } },
          template: { select: { domain: true } },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        oppgave.creatorEnterprise.projectId,
        oppgave.creatorEnterpriseId,
        oppgave.responderEnterpriseId,
        oppgave.template?.domain,
      );

      return ctx.prisma.taskComment.create({
        data: {
          taskId: input.taskId,
          userId: ctx.userId,
          content: input.content,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    }),

  // Hent oppgaver knyttet til en sjekkliste
  hentForSjekkliste: protectedProcedure
    .input(z.object({ checklistId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verifiser tilgang til sjekklisten
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.checklistId },
        include: { template: { select: { projectId: true } } },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.creatorEnterpriseId,
        sjekkliste.responderEnterpriseId,
      );

      return ctx.prisma.task.findMany({
        where: { checklistId: input.checklistId },
        select: {
          id: true,
          number: true,
          checklistFieldId: true,
          title: true,
          status: true,
          template: { select: { prefix: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Opprett ny oppgave
  opprett: protectedProcedure
    .input(
      z.object({
        creatorEnterpriseId: z.string().uuid(),
        responderEnterpriseId: z.string().uuid(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        dueDate: z.string().datetime().optional(),
        templateId: z.string().uuid(),
        drawingId: z.string().uuid().optional(),
        positionX: z.number().min(0).max(100).optional(),
        positionY: z.number().min(0).max(100).optional(),
        workflowId: z.string().uuid().optional(),
        checklistId: z.string().uuid().optional(),
        checklistFieldId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verifiser at bruker tilhører oppretter-entreprisen
      await verifiserEntrepriseTilhorighet(ctx.userId, input.creatorEnterpriseId);

      // Sjekk grense for gratisbrukere (10 oppgaver per prosjekt)
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { role: true },
      });
      if (bruker.role !== "sitedoc_admin") {
        const entreprise = await ctx.prisma.enterprise.findUniqueOrThrow({
          where: { id: input.creatorEnterpriseId },
          select: { projectId: true },
        });
        const antall = await ctx.prisma.task.count({
          where: { creatorEnterprise: { projectId: entreprise.projectId } },
        });
        if (antall >= 10) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Grensen på 10 oppgaver per prosjekt er nådd. Kontakt SiteDoc for å oppgradere.",
          });
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        let nummer: number | undefined;

        // Finn malens prefix for autonummerering
        const mal = await tx.reportTemplate.findUniqueOrThrow({
          where: { id: input.templateId },
          select: { prefix: true },
        });

        if (mal.prefix) {
          const maks = await tx.task.aggregate({
            where: {
              templateId: input.templateId,
              number: { not: null },
            },
            _max: { number: true },
          });
          nummer = (maks._max.number ?? 0) + 1;
        }

        // Utled svarer-entreprise fra arbeidsforløp hvis oppgitt
        let svarerEntrepriseId = input.responderEnterpriseId;
        if (input.workflowId) {
          const arbeidsforlop = await tx.workflow.findUnique({
            where: { id: input.workflowId },
            select: { responderEnterpriseId: true, enterpriseId: true },
          });
          if (arbeidsforlop) {
            svarerEntrepriseId = arbeidsforlop.responderEnterpriseId ?? arbeidsforlop.enterpriseId;
          }
        }

        return tx.task.create({
          data: {
            templateId: input.templateId,
            creatorUserId: ctx.userId,
            creatorEnterpriseId: input.creatorEnterpriseId,
            responderEnterpriseId: svarerEntrepriseId,
            title: input.title,
            description: input.description,
            priority: input.priority,
            number: nummer,
            dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
            drawingId: input.drawingId,
            positionX: input.positionX,
            positionY: input.positionY,
            workflowId: input.workflowId,
            checklistId: input.checklistId,
            checklistFieldId: input.checklistFieldId,
            status: "draft",
          },
        });
      });
    }),

  // Oppdater oppgave
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        dueDate: z.string().datetime().optional(),
        creatorEnterpriseId: z.string().uuid().optional(),
        responderEnterpriseId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tilgangssjekk
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          creatorEnterprise: { select: { projectId: true } },
          template: { select: { domain: true } },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        oppgave.creatorEnterprise.projectId,
        oppgave.creatorEnterpriseId,
        oppgave.responderEnterpriseId,
        oppgave.template?.domain,
      );

      // Entreprise-endring kun tillatt i utkast-status
      if ((input.creatorEnterpriseId || input.responderEnterpriseId) && oppgave.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Entrepriser kan kun endres i utkast-status",
        });
      }

      const { id, ...data } = input;
      return ctx.prisma.task.update({
        where: { id },
        data: {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        },
      });
    }),

  // Oppdater oppgavedata (fylling av felter)
  oppdaterData: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tilgangssjekk
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          creatorEnterprise: { select: { projectId: true } },
          template: { select: { domain: true } },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        oppgave.creatorEnterprise.projectId,
        oppgave.creatorEnterpriseId,
        oppgave.responderEnterpriseId,
        oppgave.template?.domain,
      );

      return ctx.prisma.task.update({
        where: { id: input.id },
        data: { data: input.data as Prisma.InputJsonValue },
      });
    }),

  // Endre status
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
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          creatorEnterprise: { select: { projectId: true } },
          template: { select: { domain: true } },
        },
      });

      // Tilgangssjekk
      await verifiserDokumentTilgang(
        ctx.userId,
        oppgave.creatorEnterprise.projectId,
        oppgave.creatorEnterpriseId,
        oppgave.responderEnterpriseId,
        oppgave.template?.domain,
      );

      if (!isValidStatusTransition(oppgave.status, input.nyStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ugyldig statusovergang fra "${oppgave.status}" til "${input.nyStatus}"`,
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const oppdatert = await tx.task.update({
          where: { id: input.id },
          data: { status: input.nyStatus },
        });

        await tx.documentTransfer.create({
          data: {
            taskId: input.id,
            senderId: ctx.userId,
            fromStatus: oppgave.status,
            toStatus: input.nyStatus,
            comment: input.kommentar,
          },
        });

        return oppdatert;
      });
    }),

  // Slett oppgave (kun i utkast-status)
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const oppgave = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          creatorEnterprise: { select: { projectId: true } },
          template: { select: { domain: true } },
        },
      });

      await verifiserDokumentTilgang(
        ctx.userId,
        oppgave.creatorEnterprise.projectId,
        oppgave.creatorEnterpriseId,
        oppgave.responderEnterpriseId,
        oppgave.template?.domain,
      );

      if (oppgave.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kun oppgaver i utkast-status kan slettes",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        await tx.documentTransfer.deleteMany({ where: { taskId: input.id } });
        await tx.image.deleteMany({ where: { taskId: input.id } });
        await tx.task.delete({ where: { id: input.id } });
        return { success: true };
      });
    }),
});
