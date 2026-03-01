import { z } from "zod";
import { router, publicProcedure } from "../trpc/trpc";
import { createWorkflowSchema, updateWorkflowSchema } from "@siteflow/shared";

export const arbeidsforlopRouter = router({
  // Hent alle arbeidsforløp for alle entrepriser i et prosjekt
  hentForProsjekt: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workflow.findMany({
        where: { enterprise: { projectId: input.projectId } },
        include: {
          responderEnterprise: { select: { id: true, name: true } },
          templates: {
            include: { template: { select: { id: true, name: true, category: true } } },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Hent alle arbeidsforløp for en entreprise
  hentForEntreprise: publicProcedure
    .input(z.object({ enterpriseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workflow.findMany({
        where: { enterpriseId: input.enterpriseId },
        include: {
          responderEnterprise: { select: { id: true, name: true } },
          templates: {
            include: { template: { select: { id: true, name: true, category: true } } },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Opprett nytt arbeidsforløp med valgfrie maler
  opprett: publicProcedure
    .input(createWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      const { templateIds, ...data } = input;
      return ctx.prisma.workflow.create({
        data: {
          ...data,
          templates: {
            create: templateIds.map((templateId) => ({ templateId })),
          },
        },
        include: {
          responderEnterprise: { select: { id: true, name: true } },
          templates: {
            include: { template: { select: { id: true, name: true, category: true } } },
          },
        },
      });
    }),

  // Oppdater arbeidsforløp — navn, svarer-entreprise og/eller maltilknytninger
  oppdater: publicProcedure
    .input(updateWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, templateIds, ...data } = input;

      // Oppdater navn og/eller responderEnterpriseId hvis gitt
      if (Object.keys(data).length > 0) {
        await ctx.prisma.workflow.update({ where: { id }, data });
      }

      // Erstatt maltilknytninger hvis gitt
      if (templateIds !== undefined) {
        await ctx.prisma.workflowTemplate.deleteMany({ where: { workflowId: id } });
        if (templateIds.length > 0) {
          await ctx.prisma.workflowTemplate.createMany({
            data: templateIds.map((templateId) => ({ workflowId: id, templateId })),
          });
        }
      }

      return ctx.prisma.workflow.findUniqueOrThrow({
        where: { id },
        include: {
          responderEnterprise: { select: { id: true, name: true } },
          templates: {
            include: { template: { select: { id: true, name: true, category: true } } },
          },
        },
      });
    }),

  // Slett arbeidsforløp
  slett: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workflow.delete({ where: { id: input.id } });
    }),
});
