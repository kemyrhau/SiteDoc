import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";

/**
 * Verifiser at bruker er SiteDoc-administrator.
 */
async function verifiserSiteDocAdmin(
  prisma: { user: { findUniqueOrThrow: (args: { where: { id: string }; select: { role: true } }) => Promise<{ role: string }> } },
  userId: string,
) {
  const bruker = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true },
  });

  if (bruker.role !== "sitedoc_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Krever SiteDoc-administrator" });
  }
}

export const adminRouter = router({
  // Sjekk om innlogget bruker er sitedoc_admin
  erAdmin: protectedProcedure.query(async ({ ctx }) => {
    const bruker = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { role: true },
    });
    return bruker.role === "sitedoc_admin";
  }),

  // Hent alle prosjekter (kun sitedoc_admin)
  hentAlleProsjekter: protectedProcedure.query(async ({ ctx }) => {
    await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

    return ctx.prisma.project.findMany({
      include: {
        members: { select: { id: true } },
        enterprises: { select: { id: true } },
        organizationProjects: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Hent alle organisasjoner (kun sitedoc_admin)
  hentAlleOrganisasjoner: protectedProcedure.query(async ({ ctx }) => {
    await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

    return ctx.prisma.organization.findMany({
      include: {
        users: { select: { id: true, name: true, email: true, role: true } },
        projects: {
          include: { project: { select: { id: true, name: true, projectNumber: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Opprett organisasjon (kun sitedoc_admin)
  opprettOrganisasjon: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      organizationNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      return ctx.prisma.organization.create({
        data: {
          name: input.name,
          organizationNumber: input.organizationNumber,
        },
      });
    }),

  // Tilknytt bruker til organisasjon + sett rolle (kun sitedoc_admin)
  settBrukerOrganisasjon: protectedProcedure
    .input(z.object({
      userId: z.string().uuid(),
      organizationId: z.string().uuid().nullable(),
      role: z.enum(["user", "company_admin"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const data: { organizationId: string | null; role?: string } = {
        organizationId: input.organizationId,
      };
      if (input.role) data.role = input.role;

      return ctx.prisma.user.update({
        where: { id: input.userId },
        data,
      });
    }),

  // Tilknytt prosjekt til organisasjon (kun sitedoc_admin)
  tilknyttProsjekt: protectedProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      return ctx.prisma.organizationProject.upsert({
        where: {
          organizationId_projectId: {
            organizationId: input.organizationId,
            projectId: input.projectId,
          },
        },
        update: {},
        create: {
          organizationId: input.organizationId,
          projectId: input.projectId,
        },
      });
    }),

  // Opprett prosjekt (kun sitedoc_admin)
  opprettProsjekt: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const antall = await ctx.prisma.project.count();
      const dato = new Date();
      const aar = dato.getFullYear();
      const mnd = String(dato.getMonth() + 1).padStart(2, "0");
      const dag = String(dato.getDate()).padStart(2, "0");
      const sekv = String(antall + 1).padStart(4, "0");
      const prosjektnummer = `SD-${aar}${mnd}${dag}-${sekv}`;

      return ctx.prisma.project.create({
        data: {
          name: input.name,
          description: input.description,
          projectNumber: prosjektnummer,
          members: {
            create: {
              userId: ctx.userId!,
              role: "admin",
            },
          },
        },
      });
    }),

  // Hent prosjektdata-statistikk for slettevarsel (kun sitedoc_admin)
  hentProsjektStatistikk: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      const entFilter = { creatorEnterprise: { projectId: input.projectId } };
      const [sjekklister, oppgaver, maler, entrepriser, medlemmer, tegninger, mapper] = await Promise.all([
        ctx.prisma.checklist.count({ where: entFilter }),
        ctx.prisma.task.count({ where: entFilter }),
        ctx.prisma.reportTemplate.count({ where: { projectId: input.projectId } }),
        ctx.prisma.enterprise.count({ where: { projectId: input.projectId } }),
        ctx.prisma.projectMember.count({ where: { projectId: input.projectId } }),
        ctx.prisma.drawing.count({ where: { projectId: input.projectId } }),
        ctx.prisma.folder.count({ where: { projectId: input.projectId } }),
      ]);

      return { sjekklister, oppgaver, maler, entrepriser, medlemmer, tegninger, mapper };
    }),

  // Slett prosjekt med all data (kun sitedoc_admin)
  slettProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      await ctx.prisma.project.delete({
        where: { id: input.projectId },
      });

      return { ok: true };
    }),

  // Hent alle brukere (kun sitedoc_admin)
  hentAlleBrukere: protectedProcedure.query(async ({ ctx }) => {
    await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

    return ctx.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        organization: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),
});
