import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../../trpc/trpc";
import { autoriserAdminForFirma } from "../../trpc/tilgangskontroll";
import {
  seedTimerForOrganization,
  seedLonnsartNivaa2,
} from "../../services/seed";
import {
  syncProjektModulerPaaAktiver,
  skrivOrganizationModuleAktiver,
  erFirmamodulAktivert,
} from "../../services/firmamodul";

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

    // Steg 1e Fase B: harTimerModul leses fra OrganizationModule.
    const [harTimerModul, antallNivaa1, antallNivaa2, antallTotalt, antallAktiviteter, antallTillegg, antallExpense] =
      await Promise.all([
        erFirmamodulAktivert(orgId, "timer"),
        ctx.prismaTimer.lonnsart.count({ where: { organizationId: orgId, seedNivaa: 1 } }),
        ctx.prismaTimer.lonnsart.count({ where: { organizationId: orgId, seedNivaa: 2 } }),
        ctx.prismaTimer.lonnsart.count({ where: { organizationId: orgId } }),
        ctx.prismaTimer.aktivitet.count({ where: { organizationId: orgId } }),
        ctx.prismaTimer.tillegg.count({ where: { organizationId: orgId } }),
        ctx.prismaTimer.expenseCategory.count({ where: { organizationId: orgId } }),
      ]);

    return {
      harTimerModul,
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
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

      // Steg 1c Fase B: ProjectModule-rader synkroniseres for alle prosjekter
      // firmaet er knyttet til, så Timer-modul-tilgang er konsistent.
      // Steg 1e Fase C: OrganizationModule er eneste sannhetskilde for
      // firma-master-aktivering — har_*_modul-flaggene er droppet.
      await ctx.prisma.$transaction(async (tx) => {
        await skrivOrganizationModuleAktiver(tx, orgId, "timer", ctx.userId);
        await syncProjektModulerPaaAktiver(tx, orgId, "timer");
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
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
    const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

    // Steg 1e Fase B: leses fra OrganizationModule.
    if (!(await erFirmamodulAktivert(orgId, "timer"))) {
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
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
    const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

    const antall = await ctx.prismaTimer.lonnsart.count({
      where: { organizationId: orgId },
    });
    if (antall > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Lønnsart-katalogen er ikke tom — kan ikke aktivere som migrerings-modus",
      });
    }

    // Steg 1e Fase C: OrganizationModule er eneste sannhetskilde.
    await ctx.prisma.$transaction(async (tx) => {
      await skrivOrganizationModuleAktiver(tx, orgId, "timer", ctx.userId);
      await syncProjektModulerPaaAktiver(tx, orgId, "timer");
    });

    return { aktivert: true };
  }),
});
