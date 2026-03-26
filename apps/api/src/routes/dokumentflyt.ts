import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  createDokumentflytSchema,
  updateDokumentflytSchema,
  addDokumentflytMedlemSchema,
  removeDokumentflytMedlemSchema,
} from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

const dokumentflytInclude = {
  medlemmer: {
    include: {
      enterprise: { select: { id: true, name: true, color: true } },
      projectMember: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      group: { select: { id: true, name: true } },
    },
    orderBy: { steg: "asc" as const },
  },
  maler: {
    include: { template: { select: { id: true, name: true, category: true } } },
  },
} as const;

export const dokumentflytRouter = router({
  // Hent alle dokumentflyter for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.dokumentflyt.findMany({
        where: { projectId: input.projectId },
        include: dokumentflytInclude,
        orderBy: { name: "asc" },
      });
    }),

  // Opprett ny dokumentflyt
  opprett: protectedProcedure
    .input(createDokumentflytSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { templateIds, medlemmer, ...data } = input;
      return ctx.prisma.dokumentflyt.create({
        data: {
          ...data,
          maler: {
            create: templateIds.map((templateId) => ({ templateId })),
          },
          medlemmer: {
            create: medlemmer.map((m) => ({
              enterpriseId: m.enterpriseId,
              projectMemberId: m.projectMemberId,
              groupId: m.groupId,
              rolle: m.rolle,
              steg: m.steg,
            })),
          },
        },
        include: dokumentflytInclude,
      });
    }),

  // Oppdater dokumentflyt — navn og/eller maltilknytninger
  oppdater: protectedProcedure
    .input(updateDokumentflytSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { id, projectId: _projectId, templateIds, ...data } = input;

      if (Object.keys(data).length > 0) {
        await ctx.prisma.dokumentflyt.update({ where: { id }, data });
      }

      // Erstatt maltilknytninger hvis gitt
      if (templateIds !== undefined) {
        await ctx.prisma.dokumentflytMal.deleteMany({ where: { dokumentflytId: id } });
        if (templateIds.length > 0) {
          await ctx.prisma.dokumentflytMal.createMany({
            data: templateIds.map((templateId) => ({ dokumentflytId: id, templateId })),
          });
        }
      }

      return ctx.prisma.dokumentflyt.findUniqueOrThrow({
        where: { id },
        include: dokumentflytInclude,
      });
    }),

  // Slett dokumentflyt
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.dokumentflyt.delete({ where: { id: input.id } });
    }),

  // Legg til medlem (entreprise eller person) i dokumentflyt
  leggTilMedlem: protectedProcedure
    .input(addDokumentflytMedlemSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { projectId: _projectId, ...data } = input;
      return ctx.prisma.dokumentflytMedlem.create({
        data,
        include: {
          enterprise: { select: { id: true, name: true, color: true } },
          projectMember: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          group: { select: { id: true, name: true } },
        },
      });
    }),

  // Fjern medlem fra dokumentflyt
  fjernMedlem: protectedProcedure
    .input(removeDokumentflytMedlemSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.dokumentflytMedlem.delete({ where: { id: input.id } });
    }),
});
