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

  // Gjenopprett flere i én operasjon (Kenneth-vedtak 2026-08-18 del 2). Samme rett
  // som gjenopprett: oppretter (egne) + prosjektadmin (+ sitedoc). Ikke-admin ser
  // uansett bare egne i lista, men serveren håndhever eierskap per rad likevel.
  gjenopprettFlere: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        items: z
          .array(z.object({ id: z.string().uuid(), type: z.enum(["checklist", "task"]) }))
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tilgang = await hentBrukerProsjektTilgang(ctx.userId, input.projectId);
      const serAlt = tilgang.erProsjektAdmin || tilgang.erSitedocAdmin;
      const { sjekklister, oppgaver } = await lastOgValiderKurvItems(
        ctx.prisma,
        input.projectId,
        input.items,
      );
      // Ikke-admin: kun egne. Avvis hele bunken hvis noe ikke er ditt (aldri stille skip).
      if (!serAlt) {
        const fremmed = [...sjekklister, ...oppgaver].some((d) => d.bestillerUserId !== ctx.userId);
        if (fremmed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Kun oppretteren eller prosjektadmin kan gjenopprette dokumentet",
          });
        }
      }
      await ctx.prisma.$transaction(async (tx) => {
        if (sjekklister.length) {
          await tx.checklist.updateMany({
            where: { id: { in: sjekklister.map((d) => d.id) } },
            data: { deletedAt: null, deletedById: null },
          });
        }
        if (oppgaver.length) {
          await tx.task.updateMany({
            where: { id: { in: oppgaver.map((d) => d.id) } },
            data: { deletedAt: null, deletedById: null },
          });
        }
      });
      return { sjekklister: sjekklister.length, oppgaver: oppgaver.length };
    }),

  // Slett flere endelig i én operasjon (Kenneth-vedtak 2026-08-18 del 2). Kun
  // prosjektadmin (+ sitedoc), som slettEndelig. Rydder transfers/bilder først.
  slettEndeligFlere: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        items: z
          .array(z.object({ id: z.string().uuid(), type: z.enum(["checklist", "task"]) }))
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tilgang = await hentBrukerProsjektTilgang(ctx.userId, input.projectId);
      if (!tilgang.erSitedocAdmin && !tilgang.erProsjektAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kun prosjektadmin kan slette et dokument endelig",
        });
      }
      const { sjekklister, oppgaver } = await lastOgValiderKurvItems(
        ctx.prisma,
        input.projectId,
        input.items,
      );
      await slettKurvDokumenter(
        ctx.prisma,
        sjekklister.map((d) => d.id),
        oppgaver.map((d) => d.id),
      );
      return { sjekklister: sjekklister.length, oppgaver: oppgaver.length };
    }),

  // Tøm papirkurv (Kenneth-vedtak 2026-08-18 del 1: «uten den er alt annet lapping»).
  // Sletter ALT som ligger i prosjektets papirkurv endelig. Kun prosjektadmin (+ sitedoc),
  // samme rett og samme opprydding (transfers + bilder) som slettEndelig.
  tomPapirkurv: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tilgang = await hentBrukerProsjektTilgang(ctx.userId, input.projectId);
      if (!tilgang.erSitedocAdmin && !tilgang.erProsjektAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kun prosjektadmin kan tømme papirkurven",
        });
      }
      const [sjekklister, oppgaver] = await Promise.all([
        ctx.prisma.checklist.findMany({
          where: { ...KUN_SLETTET, template: { projectId: input.projectId } },
          select: { id: true },
        }),
        ctx.prisma.task.findMany({
          where: { ...KUN_SLETTET, ...oppgaveProsjektFilter(input.projectId) },
          select: { id: true },
        }),
      ]);
      await slettKurvDokumenter(
        ctx.prisma,
        sjekklister.map((d) => d.id),
        oppgaver.map((d) => d.id),
      );
      return { sjekklister: sjekklister.length, oppgaver: oppgaver.length };
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

/**
 * Last de valgte kurv-radene og verifiser at hver enkelt er soft-slettet OG hører til
 * prosjektet. Skiller i sjekklister/oppgaver med bestillerUserId (til eierskap-sjekk).
 * Kaster NOT_FOUND hvis en id ikke finnes / ikke er i papirkurven / hører til et annet
 * prosjekt — bunkeoperasjoner skal aldri stille droppe rader (CLAUDE.md § stille tomhet).
 */
async function lastOgValiderKurvItems(
  prisma: PrismaClient,
  projectId: string,
  items: { id: string; type: "checklist" | "task" }[],
): Promise<{
  sjekklister: { id: string; bestillerUserId: string }[];
  oppgaver: { id: string; bestillerUserId: string }[];
}> {
  const sjekklisteIder = items.filter((i) => i.type === "checklist").map((i) => i.id);
  const oppgaveIder = items.filter((i) => i.type === "task").map((i) => i.id);

  const [sjekklister, oppgaver] = await Promise.all([
    sjekklisteIder.length
      ? prisma.checklist.findMany({
          where: { id: { in: sjekklisteIder }, ...KUN_SLETTET, template: { projectId } },
          select: { id: true, bestillerUserId: true },
        })
      : Promise.resolve([]),
    oppgaveIder.length
      ? prisma.task.findMany({
          where: { id: { in: oppgaveIder }, ...KUN_SLETTET, ...oppgaveProsjektFilter(projectId) },
          select: { id: true, bestillerUserId: true },
        })
      : Promise.resolve([]),
  ]);

  if (sjekklister.length !== sjekklisteIder.length || oppgaver.length !== oppgaveIder.length) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Ett eller flere dokumenter finnes ikke i papirkurven i dette prosjektet",
    });
  }
  return { sjekklister, oppgaver };
}

/**
 * Ekte hard-slett av kurv-dokumenter i bulk: rydd transfers + bilder FØR selve raden
 * (samme rekkefølge som slettEndelig), alt i én transaksjon.
 */
async function slettKurvDokumenter(
  prisma: PrismaClient,
  sjekklisteIder: string[],
  oppgaveIder: string[],
): Promise<void> {
  if (!sjekklisteIder.length && !oppgaveIder.length) return;
  await prisma.$transaction(async (tx) => {
    if (sjekklisteIder.length) {
      await tx.documentTransfer.deleteMany({ where: { checklistId: { in: sjekklisteIder } } });
      await tx.image.deleteMany({ where: { checklistId: { in: sjekklisteIder } } });
      await tx.checklist.deleteMany({ where: { id: { in: sjekklisteIder } } });
    }
    if (oppgaveIder.length) {
      await tx.documentTransfer.deleteMany({ where: { taskId: { in: oppgaveIder } } });
      await tx.image.deleteMany({ where: { taskId: { in: oppgaveIder } } });
      await tx.task.deleteMany({ where: { id: { in: oppgaveIder } } });
    }
  });
}
