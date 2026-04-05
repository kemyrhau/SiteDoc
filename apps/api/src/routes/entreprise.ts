import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { createEnterpriseSchema, copyEnterpriseSchema } from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

export const entrepriseRouter = router({
  // Hent alle entrepriser for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.enterprise.findMany({
        where: { projectId: input.projectId },
        include: {
          ansvarlig: { select: { id: true, name: true, email: true } },
          memberEnterprises: {
            include: {
              projectMember: {
                include: { user: true },
              },
            },
          },
          _count: {
            select: {
              bestillerChecklists: true,
              utforerChecklists: true,
              bestillerTasks: true,
              utforerTasks: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Hent én entreprise med ID
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const entreprise = await ctx.prisma.enterprise.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, entreprise.projectId);
      return ctx.prisma.enterprise.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          project: true,
          memberEnterprises: {
            include: {
              projectMember: {
                include: { user: true },
              },
            },
          },
        },
      });
    }),

  // Opprett ny entreprise
  opprett: protectedProcedure
    .input(createEnterpriseSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { memberIds, ...data } = input;
      return ctx.prisma.$transaction(async (tx) => {
        const entreprise = await tx.enterprise.create({ data });
        if (memberIds.length > 0) {
          await tx.memberEnterprise.createMany({
            data: memberIds.map((memberId) => ({
              projectMemberId: memberId,
              enterpriseId: entreprise.id,
            })),
            skipDuplicates: true,
          });
        }
        return entreprise;
      });
    }),

  // Oppdater entreprise
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        enterpriseNumber: z.string().max(20).optional(),
        organizationNumber: z.string().optional(),
        color: z.string().max(50).optional(),
        industry: z.string().max(100).optional(),
        companyName: z.string().max(255).optional(),
        ansvarligId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const entreprise = await ctx.prisma.enterprise.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, entreprise.projectId);
      const { id, ...data } = input;
      return ctx.prisma.enterprise.update({ where: { id }, data });
    }),

  // Kopier entreprise fra et prosjekt til et annet (eller samme)
  kopier: protectedProcedure
    .input(copyEnterpriseSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.targetProjectId);
      const kilde = await ctx.prisma.enterprise.findUniqueOrThrow({
        where: { id: input.sourceEnterpriseId },
      });

      return ctx.prisma.$transaction(async (tx) => {
        const nyEntreprise = await tx.enterprise.create({
          data: {
            projectId: input.targetProjectId,
            name: input.name ?? kilde.name,
            enterpriseNumber: kilde.enterpriseNumber,
            organizationNumber: kilde.organizationNumber,
            color: input.color ?? kilde.color,
            industry: kilde.industry,
            companyName: kilde.companyName,
          },
        });

        if (input.memberIds.length > 0) {
          await tx.memberEnterprise.createMany({
            data: input.memberIds.map((memberId) => ({
              projectMemberId: memberId,
              enterpriseId: nyEntreprise.id,
            })),
            skipDuplicates: true,
          });
        }

        return nyEntreprise;
      });
    }),

  // Sett ansvarlig for entreprise
  settAnsvarlig: protectedProcedure
    .input(
      z.object({
        enterpriseId: z.string().uuid(),
        userId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const entreprise = await ctx.prisma.enterprise.findUniqueOrThrow({
        where: { id: input.enterpriseId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, entreprise.projectId);
      return ctx.prisma.enterprise.update({
        where: { id: input.enterpriseId },
        data: { ansvarligId: input.userId },
      });
    }),

  // Slett entreprise
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const entreprise = await ctx.prisma.enterprise.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true, name: true },
      });
      await verifiserProsjektmedlem(ctx.userId, entreprise.projectId);

      // Sjekk om entreprisen har tilknyttede sjekklister eller oppgaver
      const [sjekklisteAntall, oppgaveAntall] = await Promise.all([
        ctx.prisma.checklist.count({
          where: {
            OR: [
              { bestillerEnterpriseId: input.id },
              { utforerEnterpriseId: input.id },
            ],
          },
        }),
        ctx.prisma.task.count({
          where: {
            OR: [
              { bestillerEnterpriseId: input.id },
              { utforerEnterpriseId: input.id },
            ],
          },
        }),
      ]);

      if (sjekklisteAntall > 0 || oppgaveAntall > 0) {
        const detaljer: string[] = [];
        if (sjekklisteAntall > 0) detaljer.push(`${sjekklisteAntall} sjekkliste${sjekklisteAntall !== 1 ? "r" : ""}`);
        if (oppgaveAntall > 0) detaljer.push(`${oppgaveAntall} oppgave${oppgaveAntall !== 1 ? "r" : ""}`);
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kan ikke slette «${entreprise.name}» fordi den har ${detaljer.join(" og ")} tilknyttet. Flytt eller slett disse først.`,
        });
      }

      return ctx.prisma.enterprise.delete({ where: { id: input.id } });
    }),
});
