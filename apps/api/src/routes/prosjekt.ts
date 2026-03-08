import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { createProjectSchema } from "@sitedoc/shared";
import { generateProjectNumber } from "@sitedoc/shared";
import {
  verifiserProsjektmedlem,
  verifiserAdmin,
} from "../trpc/tilgangskontroll";

export const prosjektRouter = router({
  // Hent prosjekter der innlogget bruker er medlem (sitedoc_admin ser alle)
  hentMine: protectedProcedure.query(async ({ ctx }) => {
    const bruker = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { role: true } });
    const erSitedocAdmin = bruker.role === "sitedoc_admin";
    return ctx.prisma.project.findMany({
      where: erSitedocAdmin ? {} : { members: { some: { userId: ctx.userId } } },
      orderBy: { updatedAt: "desc" },
      include: {
        enterprises: true,
        _count: { select: { members: true } },
      },
    });
  }),

  // Hent alle prosjekter (sitedoc_admin ser alle)
  hentAlle: protectedProcedure.query(async ({ ctx }) => {
    const bruker = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { role: true } });
    const erSitedocAdmin = bruker.role === "sitedoc_admin";
    return ctx.prisma.project.findMany({
      where: erSitedocAdmin ? {} : { members: { some: { userId: ctx.userId } } },
      orderBy: { createdAt: "desc" },
      include: {
        enterprises: true,
        _count: { select: { members: true } },
      },
    });
  }),

  // Hent ett prosjekt med ID
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.id);

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
          organizationProjects: { select: { id: true } },
        },
      });
    }),

  // Opprett nytt prosjekt — kobler automatisk til brukerens firma hvis det finnes
  opprett: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      // Tell eksisterende prosjekter for sekvensnummer
      const antall = await ctx.prisma.project.count();
      const prosjektnummer = generateProjectNumber(antall + 1);

      const prosjekt = await ctx.prisma.project.create({
        data: {
          ...input,
          projectNumber: prosjektnummer,
          members: {
            create: {
              userId: ctx.userId!,
              role: "admin",
            },
          },
        },
      });

      // Auto-tilknytt til brukerens firma
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { organizationId: true },
      });

      if (bruker.organizationId) {
        await ctx.prisma.organizationProject.create({
          data: {
            organizationId: bruker.organizationId,
            projectId: prosjekt.id,
          },
        });
      }

      return prosjekt;
    }),

  // Oppdater prosjekt
  oppdater: protectedProcedure
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
      await verifiserAdmin(ctx.userId, input.id);

      const { id, ...data } = input;
      return ctx.prisma.project.update({
        where: { id },
        data,
      });
    }),
});
