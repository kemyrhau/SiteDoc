import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../../trpc/trpc";
import { autoriserAdminForFirma } from "../../trpc/tilgangskontroll";
import {
  seedTimerForOrganization,
  seedLonnsartNivaa2,
} from "../../services/seed";

/**
 * Verifiser at bruker er firmaadmin for et firma.
 *
 * Steg 1b Fase A — bakoverkompatibilitet: hvis `inputOrgId` gitt deleger til
 * `autoriserAdminForFirma`. Hvis ikke gitt: fallback til bruker.organizationId.
 */
async function verifiserFirmaAdmin(
  userId: string,
  inputOrgId?: string,
): Promise<string> {
  if (inputOrgId) {
    await autoriserAdminForFirma(userId, inputOrgId);
    return inputOrgId;
  }

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
 * Read-only orgId for ansatte. Sitedoc_admin med inputOrgId kan se vilkårlig firma.
 */
async function hentBrukerOrgId(userId: string, inputOrgId?: string): Promise<string> {
  if (inputOrgId) {
    const bruker = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true, organizationId: true },
    });
    if (bruker.role === "sitedoc_admin") return inputOrgId;
    if (bruker.organizationId === inputOrgId) return inputOrgId;
    throw new TRPCError({ code: "FORBIDDEN", message: "Ikke ditt firma" });
  }

  const bruker = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!bruker.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ingen organisasjon tilknyttet" });
  }
  return bruker.organizationId;
}

export const onboardingRouter = router({
  // Hent status for Timer-modulen + katalog-størrelser (read-only for alle ansatte i firma)
  status: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const orgId = await hentBrukerOrgId(ctx.userId, input?.organizationId);

    const [organisasjon, antallNivaa1, antallNivaa2, antallTotalt, antallAktiviteter, antallTillegg, antallExpense] =
      await Promise.all([
        ctx.prisma.organization.findUniqueOrThrow({
          where: { id: orgId },
          select: { harTimerModul: true },
        }),
        ctx.prismaTimer.lonnsart.count({ where: { organizationId: orgId, seedNivaa: 1 } }),
        ctx.prismaTimer.lonnsart.count({ where: { organizationId: orgId, seedNivaa: 2 } }),
        ctx.prismaTimer.lonnsart.count({ where: { organizationId: orgId } }),
        ctx.prismaTimer.aktivitet.count({ where: { organizationId: orgId } }),
        ctx.prismaTimer.tillegg.count({ where: { organizationId: orgId } }),
        ctx.prismaTimer.expenseCategory.count({ where: { organizationId: orgId } }),
      ]);

    return {
      harTimerModul: organisasjon.harTimerModul,
      antallLonnsartNivaa1: antallNivaa1,
      antallLonnsartNivaa2: antallNivaa2,
      antallLonnsartEgendefinert: antallTotalt - antallNivaa1 - antallNivaa2,
      antallLonnsartTotalt: antallTotalt,
      antallAktiviteter,
      antallTillegg,
      antallExpenseKategorier: antallExpense,
    };
  }),

  // Aktiver modulen + seed Nivå 1 (+ valgfritt Nivå 2)
  aktiverNivaa1: protectedProcedure
    .input(
      z.object({
        inkluderNivaa2: z.boolean().default(false),
        organizationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

      // Sett harTimerModul = true (idempotent)
      await ctx.prisma.organization.update({
        where: { id: orgId },
        data: { harTimerModul: true },
      });

      const seedResultat = await seedTimerForOrganization(orgId, {
        inkluderNivaa2: input.inkluderNivaa2,
      });

      return {
        aktivert: true,
        seedResultat,
      };
    }),

  // Importer Nivå 2-pakken etter at Nivå 1 allerede er seedet
  aktiverNivaa2: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
    const orgId = await verifiserFirmaAdmin(ctx.userId, input?.organizationId);

    const organisasjon = await ctx.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { harTimerModul: true },
    });
    if (!organisasjon.harTimerModul) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Timer-modulen må aktiveres før Nivå 2 kan importeres",
      });
    }

    const resultat = await seedLonnsartNivaa2(orgId);
    return resultat;
  }),

  // «Migrerer fra annet system» — aktiver modulen UTEN å seede Nivå 1
  // (per timer.md § Onboarding scenario B). Idempotens: tom katalog tillates
  // bare hvis ingen lønnsarter finnes fra før.
  aktiverTomKatalog: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
    const orgId = await verifiserFirmaAdmin(ctx.userId, input?.organizationId);

    const antall = await ctx.prismaTimer.lonnsart.count({
      where: { organizationId: orgId },
    });
    if (antall > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Lønnsart-katalogen er ikke tom — kan ikke aktivere som migrerings-modus",
      });
    }

    await ctx.prisma.organization.update({
      where: { id: orgId },
      data: { harTimerModul: true },
    });

    return { aktivert: true };
  }),
});
