import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";
import { prisma } from "@sitedoc/db";
import { KOMPETANSE_KATEGORIER } from "@sitedoc/shared";
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
 * Verifiser at brukeren tilhører en organisasjon. Returnerer orgId.
 * Brukes for read-only ruter — alle ansatte kan se firma-katalogen.
 */
async function hentBrukerOrgId(userId: string): Promise<string> {
  const bruker = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!bruker.organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ingen organisasjon tilknyttet" });
  }

  return bruker.organizationId;
}

const kategoriSchema = z.enum(KOMPETANSE_KATEGORIER);

export const kompetansetypeRouter = router({
  // Hent alle kompetansetyper for brukerens firma (read-only katalog)
  hentAlle: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await hentBrukerOrgId(ctx.userId);
    return ctx.prisma.kompetansetype.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { ansattKompetanser: true } },
      },
      orderBy: [{ kategori: "asc" }, { navn: "asc" }],
    });
  }),

  // Opprett ny kompetansetype (firma-admin)
  opprett: protectedProcedure
    .input(
      z.object({
        navn: z.string().min(1).max(255),
        kategori: kategoriSchema,
        defaultUtloperAarEtterUtstedt: z.number().int().min(0).max(99).nullable().optional(),
        beskrivelse: z.string().max(1000).nullable().optional(),
        kobletTilEquipmentModell: z.string().max(255).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);
      try {
        return await ctx.prisma.kompetansetype.create({
          data: {
            organizationId: orgId,
            navn: input.navn.trim(),
            kategori: input.kategori,
            defaultUtloperAarEtterUtstedt: input.defaultUtloperAarEtterUtstedt ?? null,
            beskrivelse: input.beskrivelse?.trim() || null,
            kobletTilEquipmentModell: input.kobletTilEquipmentModell?.trim() || null,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Kompetansetype «${input.navn}» finnes allerede`,
          });
        }
        throw e;
      }
    }),

  // Oppdater kompetansetype (firma-admin)
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        navn: z.string().min(1).max(255).optional(),
        kategori: kategoriSchema.optional(),
        aktiv: z.boolean().optional(),
        defaultUtloperAarEtterUtstedt: z.number().int().min(0).max(99).nullable().optional(),
        beskrivelse: z.string().max(1000).nullable().optional(),
        kobletTilEquipmentModell: z.string().max(255).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);
      const eksisterende = await ctx.prisma.kompetansetype.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!eksisterende) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kompetansetype finnes ikke eller tilhører ikke ditt firma",
        });
      }

      const data: Prisma.KompetansetypeUpdateInput = {};
      if (input.navn !== undefined) data.navn = input.navn.trim();
      if (input.kategori !== undefined) data.kategori = input.kategori;
      if (input.aktiv !== undefined) data.aktiv = input.aktiv;
      if (input.defaultUtloperAarEtterUtstedt !== undefined) {
        data.defaultUtloperAarEtterUtstedt = input.defaultUtloperAarEtterUtstedt;
      }
      if (input.beskrivelse !== undefined) {
        data.beskrivelse = input.beskrivelse?.trim() || null;
      }
      if (input.kobletTilEquipmentModell !== undefined) {
        data.kobletTilEquipmentModell = input.kobletTilEquipmentModell?.trim() || null;
      }

      try {
        return await ctx.prisma.kompetansetype.update({
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
            message: `En annen kompetansetype har allerede dette navnet`,
          });
        }
        throw e;
      }
    }),

  // Slett kompetansetype — blokkeres hvis ansatt-kompetanser finnes (Restrict-FK)
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);
      const eksisterende = await ctx.prisma.kompetansetype.findFirst({
        where: { id: input.id, organizationId: orgId },
        include: { _count: { select: { ansattKompetanser: true } } },
      });
      if (!eksisterende) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Kompetansetype finnes ikke eller tilhører ikke ditt firma",
        });
      }

      if (eksisterende._count.ansattKompetanser > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${eksisterende._count.ansattKompetanser} ansatt-rad(er) er knyttet til denne kompetansetypen. Fjern dem først.`,
        });
      }

      return ctx.prisma.kompetansetype.delete({ where: { id: input.id } });
    }),
});
