import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";

/**
 * Verifiser at bruker er firmaadmin for sin organisasjon.
 * Returnerer organisasjonId.
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

async function erSiteDocAdmin(userId: string): Promise<boolean> {
  const bruker = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true },
  });
  return bruker.role === "sitedoc_admin";
}

export const organisasjonRouter = router({
  // Hent alle organisasjoner (for firma-dropdown i admin)
  hentAlle: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }),

  // Opprett ny organisasjon
  opprett: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.organization.create({
        data: { name: input.name },
        select: { id: true, name: true },
      });
    }),

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

  // Hent organisasjon tilknyttet et prosjekt (via OrganizationProject)
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgProject = await ctx.prisma.organizationProject.findFirst({
        where: { projectId: input.projectId },
        include: { organization: true },
      });
      return orgProject?.organization ?? null;
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
            dokumentflytParts: { select: { id: true } },
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
      antallEntrepriser: op.project.dokumentflytParts.length,
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

  // Oppdater organisasjon (firmaadmin for sin egen, sitedoc_admin for vilkårlig)
  oppdater: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid().optional(),
        name: z.string().min(1).optional(),
        organizationNumber: z.string().optional().nullable(),
        invoiceAddress: z.string().optional().nullable(),
        invoiceEmail: z.string().email().optional().nullable(),
        ehfEnabled: z.boolean().optional(),
        logoUrl: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { organizationId: inputOrgId, ...data } = input;

      // sitedoc_admin kan redigere vilkårlig firma via organizationId
      if (inputOrgId && await erSiteDocAdmin(ctx.userId)) {
        return ctx.prisma.organization.update({
          where: { id: inputOrgId },
          data,
        });
      }

      // Ellers: brukerens egen organisasjon
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId);

      return ctx.prisma.organization.update({
        where: { id: orgId },
        data,
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

  // Hent integrasjonsstatus for organisasjonen (kun firmaadmin)
  hentIntegrasjonerStatus: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId);

    const integrasjoner = await ctx.prisma.organizationIntegration.findMany({
      where: { organizationId: orgId },
      select: {
        type: true,
        aktiv: true,
        url: true,
        createdAt: true,
      },
    });

    return integrasjoner.map((i) => ({
      type: i.type,
      aktiv: i.aktiv,
      url: i.url,
      harNøkkel: true, // Hvis raden finnes, har den en nøkkel — aldri send apiKey til klient
      createdAt: i.createdAt,
    }));
  }),

  // Endre rolle for en bruker i organisasjonen (kun firmaadmin)
  endreRolle: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        rolle: z.enum(["user", "company_admin"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.prisma, ctx.userId);

      // Verifiser at målbrukeren tilhører samme organisasjon
      const målbruker = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { organizationId: true, role: true },
      });

      if (!målbruker || målbruker.organizationId !== orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brukeren tilhører ikke din organisasjon",
        });
      }

      // Kan ikke endre sitedoc_admin
      if (målbruker.role === "sitedoc_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kan ikke endre rolle for systemadministrator",
        });
      }

      // Kan ikke degradere seg selv
      if (input.userId === ctx.userId && input.rolle !== "company_admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Du kan ikke fjerne din egen admin-rolle",
        });
      }

      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { role: input.rolle },
        select: { id: true, role: true },
      });
    }),
});
