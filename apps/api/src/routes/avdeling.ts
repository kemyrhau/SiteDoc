import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { autoriserAdminForFirma } from "../trpc/tilgangskontroll";

/**
 * Verifiser at bruker er firmaadmin for et firma.
 *
 * Steg 1b Fase C — orgId er påkrevd. Klienten må sende `valgtFirma.id`.
 */
async function verifiserFirmaAdmin(
  userId: string,
  inputOrgId: string,
): Promise<string> {
  await autoriserAdminForFirma(userId, inputOrgId);
  return inputOrgId;
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
  hentAlle: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
    const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
    const avdelinger = await ctx.prisma.avdeling.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { organizationMembers: true } },
      },
      orderBy: { navn: "asc" },
    });
    return avdelinger.map((a) => ({
      ...a,
      _count: { brukere: a._count.organizationMembers },
    }));
  }),

  // Opprett ny avdeling
  opprett: protectedProcedure
    .input(
      z.object({
        navn: z.string().min(1).max(255),
        kode: z.string().max(50).optional(),
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
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
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
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
    .input(z.object({
      id: z.string().uuid(),
      organizationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await hentAvdelingForFirma(input.id, orgId);

      const antallBrukere = await ctx.prisma.organizationMember.count({
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
