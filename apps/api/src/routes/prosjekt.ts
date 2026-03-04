import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc/trpc";
import { createProjectSchema } from "@siteflow/shared";
import { generateProjectNumber } from "@siteflow/shared";

export const prosjektRouter = router({
  // Hent prosjekter der innlogget bruker er medlem
  hentMine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.project.findMany({
      where: { members: { some: { userId: ctx.userId } } },
      orderBy: { updatedAt: "desc" },
      include: {
        enterprises: true,
        _count: { select: { members: true } },
      },
    });
  }),

  // Hent alle prosjekter
  hentAlle: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        enterprises: true,
        _count: { select: { members: true } },
      },
    });
  }),

  // Hent ett prosjekt med ID
  hentMedId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          enterprises: true,
          members: {
            include: {
              user: true,
              enterprises: { include: { enterprise: true } },
            },
          },
          templates: true,
          drawings: true,
          folders: { where: { parentId: null }, include: { children: true } },
        },
      });
    }),

  // Opprett nytt prosjekt
  opprett: publicProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      // Tell eksisterende prosjekter for sekvensnummer
      const antall = await ctx.prisma.project.count();
      const prosjektnummer = generateProjectNumber(antall + 1);

      return ctx.prisma.project.create({
        data: {
          ...input,
          projectNumber: prosjektnummer,
        },
      });
    }),

  // Oppdater prosjekt
  oppdater: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        address: z.string().optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        internalProjectNumber: z.string().max(100).nullable().optional(),
        externalProjectNumber: z.string().max(100).nullable().optional(),
        logoUrl: z.string().max(500).nullable().optional(),
        showInternalProjectNumber: z.boolean().optional(),
        status: z.enum(["active", "archived", "completed"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.project.update({
        where: { id },
        data,
      });
    }),
});
