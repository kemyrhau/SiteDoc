import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { createWorkflowSchema, updateWorkflowSchema, addWorkflowStepMemberSchema, removeWorkflowStepMemberSchema } from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

const workflowInclude = {
  responderEnterprise: { select: { id: true, name: true } },
  responderEnterprise2: { select: { id: true, name: true } },
  responderEnterprise3: { select: { id: true, name: true } },
  templates: {
    include: { template: { select: { id: true, name: true, category: true } } },
  },
  stepMembers: {
    include: {
      projectMember: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  },
} as const;

export const arbeidsforlopRouter = router({
  // Hent alle arbeidsforløp for alle entrepriser i et prosjekt
  // Henter fra DokumentFlyt (ny modell) og mapper til Workflow-format for bakoverkompatibilitet med mobil
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // Prøv DokumentFlyt først (ny modell brukt av nye prosjekter)
      const dokumentflyter = await ctx.prisma.dokumentflyt.findMany({
        where: { projectId: input.projectId },
        include: {
          medlemmer: {
            include: {
              enterprise: { select: { id: true, name: true } },
              projectMember: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
            orderBy: { steg: "asc" },
          },
          maler: {
            include: { template: { select: { id: true, name: true, category: true } } },
          },
        },
        orderBy: { name: "asc" },
      });

      if (dokumentflyter.length > 0) {
        // Mapp DokumentFlyt → Workflow-format for mobil
        return dokumentflyter.map((df) => {
          const oppretter = df.medlemmer.find((m) => m.rolle === "oppretter" && m.enterpriseId);
          const svarer1 = df.medlemmer.find((m) => m.rolle === "svarer" && m.steg === 1 && m.enterpriseId);
          const svarer2 = df.medlemmer.find((m) => m.rolle === "svarer" && m.steg === 2 && m.enterpriseId);
          const svarer3 = df.medlemmer.find((m) => m.rolle === "svarer" && m.steg === 3 && m.enterpriseId);

          return {
            id: df.id,
            name: df.name,
            enterpriseId: oppretter?.enterpriseId ?? "",
            responderEnterpriseId: svarer1?.enterpriseId ?? null,
            responderEnterprise: svarer1?.enterprise ?? null,
            responderEnterprise2Id: svarer2?.enterpriseId ?? null,
            responderEnterprise2: svarer2?.enterprise ?? null,
            responderEnterprise3Id: svarer3?.enterpriseId ?? null,
            responderEnterprise3: svarer3?.enterprise ?? null,
            templates: df.maler.map((m) => ({
              workflowId: df.id,
              templateId: m.templateId,
              template: m.template,
            })),
            stepMembers: df.medlemmer
              .filter((m) => m.projectMemberId)
              .map((m) => ({
                id: m.id,
                workflowId: df.id,
                projectMemberId: m.projectMemberId!,
                step: m.steg,
                projectMember: m.projectMember,
              })),
            createdAt: df.createdAt,
            updatedAt: df.updatedAt,
          };
        });
      }

      // Fallback: gammel Workflow-modell for eldre prosjekter
      return ctx.prisma.workflow.findMany({
        where: { enterprise: { projectId: input.projectId } },
        include: workflowInclude,
        orderBy: { name: "asc" },
      });
    }),

  // Hent alle arbeidsforløp for en entreprise
  hentForEntreprise: protectedProcedure
    .input(z.object({ enterpriseId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const entreprise = await ctx.prisma.enterprise.findUniqueOrThrow({
        where: { id: input.enterpriseId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, entreprise.projectId);
      return ctx.prisma.workflow.findMany({
        where: { enterpriseId: input.enterpriseId },
        include: workflowInclude,
        orderBy: { name: "asc" },
      });
    }),

  // Opprett nytt arbeidsforløp med valgfrie maler
  opprett: protectedProcedure
    .input(createWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      const entreprise = await ctx.prisma.enterprise.findUniqueOrThrow({
        where: { id: input.enterpriseId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, entreprise.projectId);
      const { templateIds, ...data } = input;
      return ctx.prisma.workflow.create({
        data: {
          ...data,
          templates: {
            create: templateIds.map((templateId) => ({ templateId })),
          },
        },
        include: workflowInclude,
      });
    }),

  // Oppdater arbeidsforløp — navn, svarer-entreprise og/eller maltilknytninger
  oppdater: protectedProcedure
    .input(updateWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      const arbeidsforlop = await ctx.prisma.workflow.findUniqueOrThrow({
        where: { id: input.id },
        select: { enterprise: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, arbeidsforlop.enterprise.projectId);
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
        include: workflowInclude,
      });
    }),

  // Slett arbeidsforløp
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const arbeidsforlop = await ctx.prisma.workflow.findUniqueOrThrow({
        where: { id: input.id },
        select: { enterprise: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, arbeidsforlop.enterprise.projectId);
      return ctx.prisma.workflow.delete({ where: { id: input.id } });
    }),

  // Legg til person i steg 2 eller 3
  leggTilStegMedlem: protectedProcedure
    .input(addWorkflowStepMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const arbeidsforlop = await ctx.prisma.workflow.findUniqueOrThrow({
        where: { id: input.workflowId },
        select: { enterprise: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, arbeidsforlop.enterprise.projectId);
      return ctx.prisma.workflowStepMember.create({
        data: {
          workflowId: input.workflowId,
          projectMemberId: input.projectMemberId,
          step: input.step,
        },
        include: {
          projectMember: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    }),

  // Fjern person fra steg 2 eller 3
  fjernStegMedlem: protectedProcedure
    .input(removeWorkflowStepMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const arbeidsforlop = await ctx.prisma.workflow.findUniqueOrThrow({
        where: { id: input.workflowId },
        select: { enterprise: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, arbeidsforlop.enterprise.projectId);
      return ctx.prisma.workflowStepMember.deleteMany({
        where: {
          workflowId: input.workflowId,
          projectMemberId: input.projectMemberId,
          step: input.step,
        },
      });
    }),
});
