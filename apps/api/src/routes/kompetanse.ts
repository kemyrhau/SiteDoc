import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserKompetanseSkriveTilgang } from "../trpc/tilgangskontroll";

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

  // Opprett ny AnsattKompetanse-rad (Fase 0.5 § 2 + A.28 — Runde 2)
  // Gate: verifiserKompetanseSkriveTilgang (RBAC per OrganizationSetting)
  opprett: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        kompetansetypeId: z.string().uuid(),
        utstedtDato: z.string().date().nullable().optional(),
        utloper: z.string().date().nullable().optional(),
        utstederOrgan: z.string().max(255).nullable().optional(),
        sertifikatNr: z.string().max(100).nullable().optional(),
        notat: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserKompetanseSkriveTilgang(ctx.userId, input.userId);

      // Verifiser at kompetansetype tilhører samme firma som målbrukeren
      const malBruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { organizationId: true },
      });
      const type = await ctx.prisma.kompetansetype.findFirst({
        where: { id: input.kompetansetypeId, organizationId: malBruker.organizationId ?? undefined },
        select: { id: true },
      });
      if (!type) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kompetansetype finnes ikke eller tilhører ikke samme firma",
        });
      }

      try {
        return await ctx.prisma.ansattKompetanse.create({
          data: {
            userId: input.userId,
            kompetansetypeId: input.kompetansetypeId,
            utstedtDato: input.utstedtDato ? new Date(input.utstedtDato) : null,
            utloper: input.utloper ? new Date(input.utloper) : null,
            utstederOrgan: input.utstederOrgan?.trim() || null,
            sertifikatNr: input.sertifikatNr?.trim() || null,
            notat: input.notat?.trim() || null,
            opprettetAvUserId: ctx.userId, // A.3-audit-spor (uten FK)
            importertVia: "manuell",
          },
          include: {
            kompetansetype: { select: { id: true, navn: true, kategori: true } },
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Denne brukeren har allerede en registrering for denne kompetansetypen",
          });
        }
        throw e;
      }
    }),

  // Oppdater AnsattKompetanse-rad (userId + kompetansetypeId kan IKKE endres)
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        utstedtDato: z.string().date().nullable().optional(),
        utloper: z.string().date().nullable().optional(),
        utstederOrgan: z.string().max(255).nullable().optional(),
        sertifikatNr: z.string().max(100).nullable().optional(),
        notat: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const eksisterende = await ctx.prisma.ansattKompetanse.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });
      if (!eksisterende) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kompetanse-registrering finnes ikke",
        });
      }
      await verifiserKompetanseSkriveTilgang(ctx.userId, eksisterende.userId);

      const data: Prisma.AnsattKompetanseUpdateInput = {};
      if (input.utstedtDato !== undefined) {
        data.utstedtDato = input.utstedtDato ? new Date(input.utstedtDato) : null;
      }
      if (input.utloper !== undefined) {
        data.utloper = input.utloper ? new Date(input.utloper) : null;
      }
      if (input.utstederOrgan !== undefined) {
        data.utstederOrgan = input.utstederOrgan?.trim() || null;
      }
      if (input.sertifikatNr !== undefined) {
        data.sertifikatNr = input.sertifikatNr?.trim() || null;
      }
      if (input.notat !== undefined) {
        data.notat = input.notat?.trim() || null;
      }

      return ctx.prisma.ansattKompetanse.update({
        where: { id: input.id },
        data,
        include: {
          kompetansetype: { select: { id: true, navn: true, kategori: true } },
        },
      });
    }),

  // Slett AnsattKompetanse-rad
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const eksisterende = await ctx.prisma.ansattKompetanse.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });
      if (!eksisterende) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kompetanse-registrering finnes ikke",
        });
      }
      await verifiserKompetanseSkriveTilgang(ctx.userId, eksisterende.userId);

      return ctx.prisma.ansattKompetanse.delete({
        where: { id: input.id },
      });
    }),
});
