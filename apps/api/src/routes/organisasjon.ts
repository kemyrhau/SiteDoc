import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";

/**
 * Verifiser at bruker er firmaadmin for sin organisasjon.
 */
async function verifiserFirmaAdmin(
  _prisma: typeof prisma,
  userId: string,
) {
  const bruker = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true, organizationId: true },
  });

  if (bruker.role !== "company_admin" && bruker.role !== "sitedoc_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Krever firmaadmin-rettighet" });
  }

  if (!bruker.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ingen organisasjon tilknyttet" });
  }

  return bruker.organizationId;
}

export const organisasjonRouter = router({
  // Hent innlogget brukers organisasjon (null hvis ingen)
  hentMin: protectedProcedure.query(async ({ ctx }) => {
    const bruker = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { role: true, organizationId: true },
    });

    if (!bruker.organizationId) return null;

    return ctx.prisma.organization.findUnique({
      where: { id: bruker.organizationId },
    });
  }),

  // Hent organisasjon med ID (kun firmaadmin)
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId);
      if (orgId !== input.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Ikke din organisasjon" });
      }

      return ctx.prisma.organization.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  // Hent organisasjonens prosjekter (kun firmaadmin)
  hentProsjekter: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId);

    const orgProsjekter = await ctx.prisma.organizationProject.findMany({
      where: { organizationId: orgId },
      include: {
        project: {
          include: {
            members: { select: { id: true } },
            enterprises: { select: { id: true } },
          },
        },
      },
      orderBy: { project: { createdAt: "desc" } },
    });

    return orgProsjekter.map((op) => ({
      id: op.project.id,
      projectNumber: op.project.projectNumber,
      name: op.project.name,
      status: op.project.status,
      antallMedlemmer: op.project.members.length,
      antallEntrepriser: op.project.enterprises.length,
      createdAt: op.project.createdAt,
    }));
  }),

  // Hent organisasjonens brukere (kun firmaadmin)
  hentBrukere: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId);

    return ctx.prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });
  }),

  // Oppdater organisasjon (kun firmaadmin)
  oppdater: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        organizationNumber: z.string().optional().nullable(),
        invoiceAddress: z.string().optional().nullable(),
        invoiceEmail: z.string().email().optional().nullable(),
        ehfEnabled: z.boolean().optional(),
        logoUrl: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId);

      return ctx.prisma.organization.update({
        where: { id: orgId },
        data: input,
      });
    }),

  // Legg til prosjekt til organisasjonen (kun firmaadmin)
  leggTilProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId);

      return ctx.prisma.organizationProject.upsert({
        where: {
          organizationId_projectId: {
            organizationId: orgId,
            projectId: input.projectId,
          },
        },
        update: {},
        create: {
          organizationId: orgId,
          projectId: input.projectId,
        },
      });
    }),

  // Fjern prosjekt fra organisasjonen (kun firmaadmin)
  fjernProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId);

      return ctx.prisma.organizationProject.delete({
        where: {
          organizationId_projectId: {
            organizationId: orgId,
            projectId: input.projectId,
          },
        },
      });
    }),
});
