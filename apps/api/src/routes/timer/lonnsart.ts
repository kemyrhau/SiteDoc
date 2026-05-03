import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db-timer";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../../trpc/trpc";
import { autoriserAdminForFirma } from "../../trpc/tilgangskontroll";
import { krevTimerAktivert } from "../../services/timer";

const TYPE_VERDIER = ["ordinaer", "fravaer", "feriepenger", "diett"] as const;
const SATS_ENHET_VERDIER = ["per_dag", "per_natt", "per_km", "per_time"] as const;

// Steg 1b Fase A — bakoverkompatibilitet: hvis `inputOrgId` gitt deleger til
// `autoriserAdminForFirma`. Hvis ikke gitt: fallback til bruker.organizationId.
async function verifiserFirmaAdmin(userId: string, inputOrgId?: string): Promise<string> {
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

export const lonnsartRouter = router({
  // List alle lønnsarter for innlogget firma (read-only for alle ansatte)
  list: protectedProcedure
    .input(
      z
        .object({
          inkluderInaktiv: z.boolean().default(false),
          organizationId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await hentBrukerOrgId(ctx.userId, input?.organizationId);
      const inkluderInaktiv = input?.inkluderInaktiv ?? false;

      return ctx.prismaTimer.lonnsart.findMany({
        where: {
          organizationId: orgId,
          ...(inkluderInaktiv ? {} : { aktiv: true }),
        },
        orderBy: [{ rekkefolge: "asc" }, { navn: "asc" }],
      });
    }),

  opprett: protectedProcedure
    .input(
      z.object({
        type: z.enum(TYPE_VERDIER),
        kode: z.string().max(50).nullable().optional(),
        navn: z.string().min(1).max(255),
        prisMotKunde: z.number().nullable().optional(),
        internkostnad: z.number().nullable().optional(),
        sats: z.number().nullable().optional(),
        satsEnhet: z.enum(SATS_ENHET_VERDIER).nullable().optional(),
        skalEksporteres: z.boolean().optional(),
        tvungenKommentar: z.boolean().optional(),
        rekkefolge: z.number().int().optional(),
        organizationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await krevTimerAktivert(orgId);

      try {
        return await ctx.prismaTimer.lonnsart.create({
          data: {
            organizationId: orgId,
            type: input.type,
            kode: input.kode?.trim() || null,
            navn: input.navn.trim(),
            prisMotKunde: input.prisMotKunde ?? null,
            internkostnad: input.internkostnad ?? null,
            sats: input.sats ?? null,
            satsEnhet: input.satsEnhet ?? null,
            skalEksporteres: input.skalEksporteres ?? true,
            tvungenKommentar: input.tvungenKommentar ?? false,
            rekkefolge: input.rekkefolge ?? 0,
            // seedNivaa = null → egendefinert (Nivå 3)
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Lønnsart med kode «${input.kode}» finnes allerede`,
          });
        }
        throw e;
      }
    }),

  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        type: z.enum(TYPE_VERDIER).optional(),
        kode: z.string().max(50).nullable().optional(),
        navn: z.string().min(1).max(255).optional(),
        prisMotKunde: z.number().nullable().optional(),
        internkostnad: z.number().nullable().optional(),
        sats: z.number().nullable().optional(),
        satsEnhet: z.enum(SATS_ENHET_VERDIER).nullable().optional(),
        skalEksporteres: z.boolean().optional(),
        tvungenKommentar: z.boolean().optional(),
        rekkefolge: z.number().int().optional(),
        aktiv: z.boolean().optional(),
        organizationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

      const eksisterende = await ctx.prismaTimer.lonnsart.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!eksisterende) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lønnsart finnes ikke eller tilhører ikke ditt firma",
        });
      }

      const data: Prisma.LonnsartUpdateInput = {};
      if (input.type !== undefined) data.type = input.type;
      if (input.kode !== undefined) data.kode = input.kode?.trim() || null;
      if (input.navn !== undefined) data.navn = input.navn.trim();
      if (input.prisMotKunde !== undefined) data.prisMotKunde = input.prisMotKunde;
      if (input.internkostnad !== undefined) data.internkostnad = input.internkostnad;
      if (input.sats !== undefined) data.sats = input.sats;
      if (input.satsEnhet !== undefined) data.satsEnhet = input.satsEnhet;
      if (input.skalEksporteres !== undefined) data.skalEksporteres = input.skalEksporteres;
      if (input.tvungenKommentar !== undefined) data.tvungenKommentar = input.tvungenKommentar;
      if (input.rekkefolge !== undefined) data.rekkefolge = input.rekkefolge;
      if (input.aktiv !== undefined) data.aktiv = input.aktiv;

      try {
        return await ctx.prismaTimer.lonnsart.update({
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
            message: "En annen lønnsart har allerede denne koden",
          });
        }
        throw e;
      }
    }),

  // Soft-delete: setter aktiv = false. Lønnsarter slettes aldri hardt
  // siden SheetTimer.lonnsartId har Restrict-FK.
  deaktiver: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      organizationId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

      const eksisterende = await ctx.prismaTimer.lonnsart.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!eksisterende) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lønnsart finnes ikke eller tilhører ikke ditt firma",
        });
      }

      return ctx.prismaTimer.lonnsart.update({
        where: { id: input.id },
        data: { aktiv: false },
      });
    }),
});
