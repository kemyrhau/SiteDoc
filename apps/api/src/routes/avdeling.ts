import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";

/**
 * Verifiser at bruker er firmaadmin for sin organisasjon.
 * Returnerer organizationId.
 */
async function verifiserFirmaAdmin(userId: string): Promise<string> {
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

/**
 * Verifiser at avdelingen tilhører brukerens firma.
 * Returnerer avdelingen.
 */
async function hentAvdelingForFirma(avdelingId: string, organizationId: string) {
  const avdeling = await prisma.avdeling.findFirst({
    where: { id: avdelingId, organizationId },
  });

  if (!avdeling) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Avdeling finnes ikke eller tilhører ikke ditt firma",
    });
  }

  return avdeling;
}

export const avdelingRouter = router({
  // Hent alle avdelinger for innlogget brukers firma
  hentAlle: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await verifiserFirmaAdmin(ctx.userId);
    return ctx.prisma.avdeling.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { brukere: true } },
      },
      orderBy: { navn: "asc" },
    });
  }),

  // Opprett ny avdeling
  opprett: protectedProcedure
    .input(
      z.object({
        navn: z.string().min(1).max(255),
        kode: z.string().max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);
      try {
        return await ctx.prisma.avdeling.create({
          data: {
            organizationId: orgId,
            navn: input.navn.trim(),
            kode: input.kode?.trim() || null,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Avdeling «${input.navn}» finnes allerede`,
          });
        }
        throw e;
      }
    }),

  // Oppdater avdeling (navn / kode / aktiv)
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        navn: z.string().min(1).max(255).optional(),
        kode: z.string().max(50).nullable().optional(),
        aktiv: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);
      await hentAvdelingForFirma(input.id, orgId);

      const data: Prisma.AvdelingUpdateInput = {};
      if (input.navn !== undefined) data.navn = input.navn.trim();
      if (input.kode !== undefined) data.kode = input.kode?.trim() || null;
      if (input.aktiv !== undefined) data.aktiv = input.aktiv;

      try {
        return await ctx.prisma.avdeling.update({
          where: { id: input.id },
          data,
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `En annen avdeling har allerede dette navnet`,
          });
        }
        throw e;
      }
    }),

  // Slett avdeling — blokkeres hvis brukere er tilknyttet
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);
      await hentAvdelingForFirma(input.id, orgId);

      const antallBrukere = await ctx.prisma.user.count({
        where: { avdelingId: input.id },
      });

      if (antallBrukere > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${antallBrukere} bruker(e) er tilknyttet denne avdelingen. Flytt eller fjern dem først.`,
        });
      }

      return ctx.prisma.avdeling.delete({ where: { id: input.id } });
    }),
});
