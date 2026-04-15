/**
 * MIDLERTIDIG DEBUG-RUTE — fjernes etter testing
 * Simulerer tilgangssjekk for en gitt bruker uten innlogging
 */
import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { byggTilgangsFilter } from "../trpc/tilgangskontroll";

export const debugTilgangRouter = router({
  simulerTilgang: protectedProcedure
    .input(
      z.object({
        targetUserId: z.string().uuid(),
        projectId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Kun sitedoc_admin eller prosjektadmin kan bruke dette
      const bruker = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      });
      if (bruker?.role !== "sitedoc_admin") {
        const medlem = await ctx.prisma.projectMember.findUnique({
          where: { userId_projectId: { userId: ctx.userId, projectId: input.projectId } },
        });
        if (medlem?.role !== "admin") {
          return { error: "Kun admin kan bruke debug-tilgang" };
        }
      }

      // Hent target-bruker info
      const targetUser = await ctx.prisma.user.findUnique({
        where: { id: input.targetUserId },
        include: { organization: { select: { id: true, name: true } } },
      });

      const targetMedlem = await ctx.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: input.targetUserId, projectId: input.projectId } },
        include: {
          dokumentflytKoblinger: {
            include: { dokumentflytPart: { select: { id: true, name: true } } },
          },
          groupMemberships: {
            include: {
              group: {
                select: {
                  id: true,
                  name: true,
                  domains: true,
                  groupDokumentflytParts: { include: { dokumentflytPart: { select: { id: true, name: true } } } },
                },
              },
            },
          },
        },
      });

      if (!targetMedlem) return { error: "Bruker er ikke medlem av prosjektet" };

      // Simuler byggTilgangsFilter for target-bruker
      const tilgangsFilter = await byggTilgangsFilter(input.targetUserId, input.projectId);

      // Finn firmamedlemmer og deres entrepriser (for firmaansvarlig)
      let firmaEntrepriser: string[] = [];
      let firmamedlemmerNavn: string[] = [];
      if (targetMedlem.erFirmaansvarlig && targetUser?.organization) {
        const firmamedlemmer = await ctx.prisma.projectMember.findMany({
          where: {
            projectId: input.projectId,
            user: { organizationId: targetUser.organization.id },
          },
          include: {
            user: { select: { name: true } },
            dokumentflytKoblinger: { include: { dokumentflytPart: { select: { id: true, name: true } } } },
            groupMemberships: { select: { groupId: true } },
          },
        });

        firmamedlemmerNavn = firmamedlemmer.map((m) => m.user.name ?? "?");

        // Entrepriser via MemberEnterprise
        const entreIder = new Set<string>();
        const entreNavn = new Map<string, string>();
        for (const fm of firmamedlemmer) {
          for (const e of fm.dokumentflytKoblinger) {
            entreIder.add(e.dokumentflytPart.id);
            entreNavn.set(e.dokumentflytPart.id, e.dokumentflytPart.name);
          }
        }

        // Entrepriser via DokumentflytMedlem (person eller gruppe)
        const firmaPmIder = firmamedlemmer.map((m) => m.id);
        const firmaGruppeIder = [...new Set(
          firmamedlemmer.flatMap((m) => m.groupMemberships.map((gm) => gm.groupId)),
        )];

        const dfMedlemmer = await ctx.prisma.dokumentflytMedlem.findMany({
          where: {
            dokumentflyt: { projectId: input.projectId },
            OR: [
              { projectMemberId: { in: firmaPmIder } },
              ...(firmaGruppeIder.length > 0 ? [{ groupId: { in: firmaGruppeIder } }] : []),
            ],
          },
          include: {
            dokumentflyt: {
              include: { dokumentflytPart: { select: { id: true, name: true } } },
            },
          },
        });
        for (const dm of dfMedlemmer) {
          if (dm.dokumentflyt.dokumentflytPart) {
            entreIder.add(dm.dokumentflyt.dokumentflytPart.id);
            entreNavn.set(dm.dokumentflyt.dokumentflytPart.id, dm.dokumentflyt.dokumentflytPart.name);
          }
        }

        firmaEntrepriser = [...entreIder].map((id) => `${entreNavn.get(id)} (${id.slice(0, 8)})`);
      }

      return {
        bruker: {
          navn: targetUser?.name,
          email: targetUser?.email,
          firma: targetUser?.organization?.name ?? null,
          rolle: targetMedlem.role,
          erFirmaansvarlig: targetMedlem.erFirmaansvarlig,
        },
        direkteEntrepriser: targetMedlem.dokumentflytKoblinger.map((e: { dokumentflytPart: { name: string } }) => e.dokumentflytPart.name),
        grupper: targetMedlem.groupMemberships.map((gm: { group: { name: string; domains: unknown; groupDokumentflytParts: { dokumentflytPart: { name: string } }[] } }) => ({
          navn: gm.group.name,
          domener: gm.group.domains,
          entrepriser: gm.group.groupDokumentflytParts.map((ge: { dokumentflytPart: { name: string } }) => ge.dokumentflytPart.name),
        })),
        firmaansvarlig: targetMedlem.erFirmaansvarlig ? {
          firmaNavn: targetUser?.organization?.name,
          firmamedlemmer: firmamedlemmerNavn,
          firmaEntrepriser,
        } : null,
        tilgang: {
          erAdmin: tilgangsFilter === null,
          filter: tilgangsFilter === null ? "INGEN (ser alt)" : JSON.stringify(tilgangsFilter, null, 2),
        },
      };
    }),
});
