import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { hentBrukerProsjektTilgang } from "../trpc/tilgangskontroll";
import { KUN_SLETTET, dagerIgjen } from "../utils/softDelete";

// Papirkurv — F0 soft-delete / 90-dagers papirkurv.
//
// Lister soft-slettede sjekklister + oppgaver i et prosjekt med «dager igjen».
// Tilgang (Kenneth 2026-07-25):
//   - liste:        prosjektadmin (prosjekt-bredt) + oppretteren (egne slettede)
//   - gjenopprett:  registrator (oppretter) + prosjektadmin (spec § 3–4)
//   - slettEndelig: kun prosjektadmin (+ sitedoc-bypass) (gate-JA #3)

/** Prosjekt-scope for oppgaver (speiler oppgave.hentForProsjekt). */
function oppgaveProsjektFilter(projectId: string) {
  return {
    OR: [
      { bestillerFaggruppe: { projectId } },
      { template: { projectId }, bestillerFaggruppeId: null },
    ],
  };
}

export const papirkurvRouter = router({
  // Liste over soft-slettede dokumenter i prosjektet.
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tilgang = await hentBrukerProsjektTilgang(ctx.userId, input.projectId);
      const serAlt = tilgang.erProsjektAdmin || tilgang.erSitedocAdmin;
      // Prosjektadmin ser alle slettede; ellers kun egne (oppretter).
      const eierFilter = serAlt ? {} : { bestillerUserId: ctx.userId };

      const [sjekklister, oppgaver] = await Promise.all([
        ctx.prisma.checklist.findMany({
          where: {
            ...KUN_SLETTET,
            ...eierFilter,
            template: { projectId: input.projectId },
          },
          select: {
            id: true,
            title: true,
            number: true,
            status: true,
            deletedAt: true,
            deletedById: true,
            bestillerUserId: true,
            template: { select: { prefix: true, name: true } },
          },
          orderBy: { deletedAt: "desc" },
        }),
        ctx.prisma.task.findMany({
          where: {
            ...KUN_SLETTET,
            ...eierFilter,
            ...oppgaveProsjektFilter(input.projectId),
          },
          select: {
            id: true,
            title: true,
            number: true,
            status: true,
            deletedAt: true,
            deletedById: true,
            bestillerUserId: true,
            template: { select: { prefix: true, name: true } },
          },
          orderBy: { deletedAt: "desc" },
        }),
      ]);

      // Slå opp navn på den som slettet (deletedById er svakt felt uten relasjon).
      const slettetAvIder = [
        ...new Set(
          [...sjekklister, ...oppgaver]
            .map((d) => d.deletedById)
            .filter((id): id is string => !!id),
        ),
      ];
      const brukere = slettetAvIder.length
        ? await ctx.prisma.user.findMany({
            where: { id: { in: slettetAvIder } },
            select: { id: true, name: true },
          })
        : [];
      const navnKart = new Map(brukere.map((b) => [b.id, b.name]));

      const naa = new Date();
      const map = (
        d: {
          id: string;
          title: string;
          number: number | null;
          status: string;
          deletedAt: Date | null;
          deletedById: string | null;
          bestillerUserId: string;
          template: { prefix: string | null; name: string } | null;
        },
        type: "checklist" | "task",
      ) => ({
        id: d.id,
        type,
        title: d.title,
        number: d.number,
        status: d.status,
        prefix: d.template?.prefix ?? null,
        malNavn: d.template?.name ?? null,
        deletedAt: d.deletedAt,
        dagerIgjen: d.deletedAt ? dagerIgjen(d.deletedAt, naa) : 0,
        slettetAvNavn: d.deletedById ? navnKart.get(d.deletedById) ?? null : null,
        erOppretter: d.bestillerUserId === ctx.userId,
      });

      const dokumenter = [
        ...sjekklister.map((d) => map(d, "checklist")),
        ...oppgaver.map((d) => map(d, "task")),
      ].sort((a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0));

      // erProsjektadmin styrer om «Slett endelig» vises i UI (server håndhever uansett).
      return { erProsjektadmin: serAlt, dokumenter };
    }),

  // Gjenopprett et soft-slettet dokument — nuller deletedAt/deletedById. Status urørt.
  // Rett: registrator (oppretter) + prosjektadmin (+ sitedoc).
  gjenopprett: protectedProcedure
    .input(z.object({ id: z.string().uuid(), type: z.enum(["checklist", "task"]) }))
    .mutation(async ({ ctx, input }) => {
      const { projectId, bestillerUserId } = await hentSlettetDokument(ctx.prisma, input);
      const tilgang = await hentBrukerProsjektTilgang(ctx.userId, projectId);
      const kanGjenopprette =
        tilgang.erSitedocAdmin ||
        tilgang.erProsjektAdmin ||
        bestillerUserId === ctx.userId;
      if (!kanGjenopprette) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kun oppretteren eller prosjektadmin kan gjenopprette dokumentet",
        });
      }

      if (input.type === "checklist") {
        await ctx.prisma.checklist.update({
          where: { id: input.id },
          data: { deletedAt: null, deletedById: null },
        });
      } else {
        await ctx.prisma.task.update({
          where: { id: input.id },
          data: { deletedAt: null, deletedById: null },
        });
      }
      return { success: true };
    }),

  // Slett endelig — ekte delete() før 90-dagersfristen. Rett: kun prosjektadmin (+ sitedoc).
  slettEndelig: protectedProcedure
    .input(z.object({ id: z.string().uuid(), type: z.enum(["checklist", "task"]) }))
    .mutation(async ({ ctx, input }) => {
      const { projectId } = await hentSlettetDokument(ctx.prisma, input);
      const tilgang = await hentBrukerProsjektTilgang(ctx.userId, projectId);
      if (!tilgang.erSitedocAdmin && !tilgang.erProsjektAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kun prosjektadmin kan slette et dokument endelig",
        });
      }

      // Ekte hard-slett (dagens delete-oppførsel): rydd transfers/bilder først.
      await ctx.prisma.$transaction(async (tx) => {
        if (input.type === "checklist") {
          await tx.documentTransfer.deleteMany({ where: { checklistId: input.id } });
          await tx.image.deleteMany({ where: { checklistId: input.id } });
          await tx.checklist.delete({ where: { id: input.id } });
        } else {
          await tx.documentTransfer.deleteMany({ where: { taskId: input.id } });
          await tx.image.deleteMany({ where: { taskId: input.id } });
          await tx.task.delete({ where: { id: input.id } });
        }
      });
      return { success: true };
    }),
});

/**
 * Last et soft-slettet dokument (må ligge i papirkurv) og returner projectId + oppretter.
 * Kaster NOT_FOUND hvis dokumentet ikke finnes eller ikke er slettet.
 */
async function hentSlettetDokument(
  prisma: PrismaClient,
  input: { id: string; type: "checklist" | "task" },
): Promise<{ projectId: string; bestillerUserId: string }> {
  if (input.type === "checklist") {
    const dok = await prisma.checklist.findUnique({
      where: { id: input.id },
      select: {
        deletedAt: true,
        bestillerUserId: true,
        template: { select: { projectId: true } },
      },
    });
    if (!dok || !dok.deletedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke slettet sjekkliste" });
    }
    return { projectId: dok.template.projectId, bestillerUserId: dok.bestillerUserId };
  }
  const dok = await prisma.task.findUnique({
    where: { id: input.id },
    select: {
      deletedAt: true,
      bestillerUserId: true,
      bestillerFaggruppe: { select: { projectId: true } },
      template: { select: { projectId: true } },
    },
  });
  if (!dok || !dok.deletedAt) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Fant ikke slettet oppgave" });
  }
  const projectId = dok.bestillerFaggruppe?.projectId ?? dok.template?.projectId;
  if (!projectId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Oppgaven mangler prosjekttilknytning" });
  }
  return { projectId, bestillerUserId: dok.bestillerUserId };
}
