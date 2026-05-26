import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { byggTilgangsFilter, verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { documentStatusSchema } from "@sitedoc/shared";
import { prisma } from "@sitedoc/db";

/**
 * Bygger Prisma WHERE-fragment for HMS-synlighet (privat/åpen) på Task/Checklist.
 *
 * Regler:
 * - sitedoc_admin og prosjekt-admin: ser alt (returnerer null)
 * - Medlem av HMS-`ProjectGroup` (domains=["hms"]): ser alt HMS
 * - Vanlig bruker: ser kun dokumenter der mal er "apen", ELLER de selv er innsender/mottaker
 *
 * Returneres som AND-fragment som komponeres med byggTilgangsFilter.
 */
async function byggHmsSynlighetsFilter(
  userId: string,
  projectId: string,
): Promise<Record<string, unknown> | null> {
  // Admin-sjekk
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (bruker?.role === "sitedoc_admin") return null;

  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: {
      role: true,
      groupMemberships: {
        select: { group: { select: { domains: true } } },
      },
    },
  });
  if (!medlem) {
    // byggTilgangsFilter kaster allerede FORBIDDEN — defensiv null her hindrer
    // duplikatkast; kalleren har allerede verifisert via tilgangsFilter.
    return null;
  }
  if (medlem.role === "admin") return null;

  // HMS-gruppe-medlem ser alt
  const erHmsAnsvarlig = medlem.groupMemberships.some((gm) => {
    const domains = gm.group.domains;
    if (!Array.isArray(domains)) return false;
    return (domains as unknown[]).includes("hms");
  });
  if (erHmsAnsvarlig) return null;

  // Vanlig bruker: "apen" ELLER innsender/mottaker
  return {
    OR: [
      { template: { is: { hmsSynlighet: "apen" } } },
      { bestillerUserId: userId },
      { recipientUserId: userId },
    ],
  };
}

function komponerWhere(
  base: Record<string, unknown>,
  ...fragmenter: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  const aktive = fragmenter.filter((f): f is Record<string, unknown> => !!f);
  if (aktive.length === 0) return base;
  return { AND: [base, ...aktive] };
}

const HMS_INCLUDES_TASK = {
  template: { include: { objects: { select: { id: true, label: true, type: true, config: true } } } },
  bestiller: true,
  bestillerFaggruppe: true,
  utforerFaggruppe: true,
  drawing: { select: { id: true, name: true, floor: true, byggeplass: { select: { id: true, name: true } } } },
  recipientUser: { select: { id: true, name: true } },
  recipientGroup: { select: { id: true, name: true } },
  dokumentflyt: {
    select: {
      id: true,
      name: true,
      medlemmer: {
        select: {
          id: true,
          rolle: true,
          steg: true,
          faggruppe: { select: { id: true, name: true } },
          projectMember: { include: { user: { select: { id: true, name: true } } } },
          group: { select: { id: true, name: true } },
        },
        orderBy: { steg: "asc" as const },
      },
    },
  },
  _count: { select: { images: true, transfers: true } },
};

const HMS_INCLUDES_CHECKLIST = {
  template: { include: { objects: { select: { id: true, label: true, type: true, config: true } } } },
  bestillerFaggruppe: true,
  utforerFaggruppe: true,
  bestiller: true,
  byggeplass: { select: { id: true, name: true, number: true } },
  drawing: { select: { id: true, name: true, floor: true } },
  recipientUser: { select: { id: true, name: true } },
  recipientGroup: { select: { id: true, name: true } },
  dokumentflyt: {
    select: {
      id: true,
      name: true,
      medlemmer: {
        select: {
          id: true,
          rolle: true,
          steg: true,
          faggruppe: { select: { id: true, name: true } },
          projectMember: { include: { user: { select: { id: true, name: true } } } },
          group: { select: { id: true, name: true } },
        },
        orderBy: { steg: "asc" as const },
      },
    },
  },
  _count: { select: { images: true, transfers: true } },
};

export const hmsRouter = router({
  /**
   * Hent alle HMS-dokumenter på et prosjekt, kategorisert på subdomain.
   * Filtrerer på privat-synlighet (innsender + HMS-ansvarlige + admin ser alt).
   */
  hentDokumenter: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: documentStatusSchema.optional(),
        subdomain: z.enum(["avvik", "sja", "ruh"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const tilgangsFilter = await byggTilgangsFilter(ctx.userId, input.projectId);
      const synlighetsFilter = await byggHmsSynlighetsFilter(ctx.userId, input.projectId);

      const statusFilter = input.status ? { status: input.status } : {};

      const avvikPromise = (input.subdomain === undefined || input.subdomain === "avvik")
        ? ctx.prisma.task.findMany({
            where: komponerWhere(
              {
                ...statusFilter,
                template: { is: { projectId: input.projectId, domain: "hms", subdomain: "avvik" } },
                OR: [
                  { bestillerFaggruppe: { projectId: input.projectId } },
                  { bestillerFaggruppeId: null },
                ],
              },
              tilgangsFilter,
              synlighetsFilter,
            ),
            include: HMS_INCLUDES_TASK,
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]);

      const sjaPromise = (input.subdomain === undefined || input.subdomain === "sja")
        ? ctx.prisma.checklist.findMany({
            where: komponerWhere(
              {
                ...statusFilter,
                template: { is: { projectId: input.projectId, domain: "hms", subdomain: "sja" } },
              },
              tilgangsFilter,
              synlighetsFilter,
            ),
            include: HMS_INCLUDES_CHECKLIST,
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]);

      const ruhPromise = (input.subdomain === undefined || input.subdomain === "ruh")
        ? ctx.prisma.checklist.findMany({
            where: komponerWhere(
              {
                ...statusFilter,
                template: { is: { projectId: input.projectId, domain: "hms", subdomain: "ruh" } },
              },
              tilgangsFilter,
              synlighetsFilter,
            ),
            include: HMS_INCLUDES_CHECKLIST,
            orderBy: { updatedAt: "desc" },
          })
        : Promise.resolve([]);

      const [avvik, sja, ruh] = await Promise.all([avvikPromise, sjaPromise, ruhPromise]);
      return { avvik, sja, ruh };
    }),
});
