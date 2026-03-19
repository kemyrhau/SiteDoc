import { z } from "zod";
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
              createdChecklists: true,
              respondChecklists: true,
              createdTasks: true,
              respondTasks: true,
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

  // Opprett ny entreprise med auto-opprettet "Navnløst arbeidsforløp"
  opprett: protectedProcedure
    .input(createEnterpriseSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { memberIds, ...data } = input;
      return ctx.prisma.$transaction(async (tx) => {
        const entreprise = await tx.enterprise.create({ data });
        await tx.workflow.create({
          data: {
            enterpriseId: entreprise.id,
            name: "Navnløst arbeidsforløp",
          },
        });
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
        include: {
          createdWorkflows: true,
        },
      });

      return ctx.prisma.$transaction(async (tx) => {
        const nyEntreprise = await tx.enterprise.create({
          data: {
            projectId: input.targetProjectId,
            name: kilde.name,
            enterpriseNumber: kilde.enterpriseNumber,
            organizationNumber: kilde.organizationNumber,
            color: kilde.color,
            industry: kilde.industry,
            companyName: kilde.companyName,
          },
        });

        if (kilde.createdWorkflows.length > 0) {
          for (const af of kilde.createdWorkflows) {
            await tx.workflow.create({
              data: {
                enterpriseId: nyEntreprise.id,
                name: af.name,
              },
            });
          }
        } else {
          await tx.workflow.create({
            data: {
              enterpriseId: nyEntreprise.id,
              name: "Navnløst arbeidsforløp",
            },
          });
        }

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
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, entreprise.projectId);
      return ctx.prisma.enterprise.delete({ where: { id: input.id } });
    }),
});
