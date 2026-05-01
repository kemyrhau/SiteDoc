import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";

/**
 * Verifiser at bruker er firmaadmin for sin organisasjon.
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

export const kompetanseRouter = router({
  // Hent kompetansematrise for hele firmaet (brukere × kompetansetyper)
  // Returnerer flat data — UI bygger matrise-rendering
  hentMatrise: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await verifiserFirmaAdmin(ctx.userId);

    const [brukere, kompetansetyper, koblinger] = await Promise.all([
      ctx.prisma.user.findMany({
        where: { organizationId: orgId, canLogin: true },
        select: {
          id: true,
          name: true,
          email: true,
          ansattnummer: true,
          avdelingId: true,
          avdeling: { select: { id: true, navn: true } },
        },
        orderBy: [{ name: "asc" }],
      }),
      ctx.prisma.kompetansetype.findMany({
        where: { organizationId: orgId, aktiv: true },
        select: { id: true, navn: true, kategori: true },
        orderBy: [{ kategori: "asc" }, { navn: "asc" }],
      }),
      ctx.prisma.ansattKompetanse.findMany({
        where: {
          user: { organizationId: orgId },
        },
        select: {
          id: true,
          userId: true,
          kompetansetypeId: true,
          utstedtDato: true,
          utloper: true,
          sertifikatNr: true,
          utstederOrgan: true,
        },
      }),
    ]);

    return { brukere, kompetansetyper, koblinger };
  }),

  // Hent alle AnsattKompetanse-rader for en spesifikk bruker (for detalj-vy)
  hentForBruker: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);

      // Verifiser at målbruker tilhører samme firma
      const malBruker = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { organizationId: true },
      });
      if (!malBruker || malBruker.organizationId !== orgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bruker finnes ikke eller tilhører ikke ditt firma",
        });
      }

      return ctx.prisma.ansattKompetanse.findMany({
        where: { userId: input.userId },
        include: {
          kompetansetype: {
            select: { id: true, navn: true, kategori: true },
          },
        },
        orderBy: [
          { kompetansetype: { kategori: "asc" } },
          { kompetansetype: { navn: "asc" } },
        ],
      });
    }),
});
