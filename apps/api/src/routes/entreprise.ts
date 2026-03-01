import { z } from "zod";
import { router, publicProcedure } from "../trpc/trpc";
import { createEnterpriseSchema, copyEnterpriseSchema } from "@siteflow/shared";

export const entrepriseRouter = router({
  // Hent alle entrepriser for et prosjekt
  hentForProsjekt: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.enterprise.findMany({
        where: { projectId: input.projectId },
        include: {
          members: { include: { user: true } },
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
  hentMedId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.enterprise.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          project: true,
          members: { include: { user: true } },
        },
      });
    }),

  // Opprett ny entreprise med auto-opprettet "Navnløst arbeidsforløp"
  opprett: publicProcedure
    .input(createEnterpriseSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const entreprise = await tx.enterprise.create({ data: input });
        await tx.workflow.create({
          data: {
            enterpriseId: entreprise.id,
            name: "Navnløst arbeidsforløp",
          },
        });
        return entreprise;
      });
    }),

  // Oppdater entreprise
  oppdater: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        organizationNumber: z.string().optional(),
        color: z.string().max(50).optional(),
        industry: z.string().max(100).optional(),
        companyName: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.enterprise.update({ where: { id }, data });
    }),

  // Kopier entreprise fra et prosjekt til et annet (eller samme)
  kopier: publicProcedure
    .input(copyEnterpriseSchema)
    .mutation(async ({ ctx, input }) => {
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

        return nyEntreprise;
      });
    }),

  // Slett entreprise
  slett: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.enterprise.delete({ where: { id: input.id } });
    }),
});
