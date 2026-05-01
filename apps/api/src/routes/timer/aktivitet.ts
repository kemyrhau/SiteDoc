import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db-timer";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../../trpc/trpc";
import { krevTimerAktivert } from "../../services/timer";

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

export const aktivitetRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          inkluderInaktiv: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const orgId = await hentBrukerOrgId(ctx.userId);
      const inkluderInaktiv = input?.inkluderInaktiv ?? false;

      return ctx.prismaTimer.aktivitet.findMany({
        where: {
          organizationId: orgId,
          ...(inkluderInaktiv ? {} : { aktiv: true }),
        },
        orderBy: { navn: "asc" },
      });
    }),

  opprett: protectedProcedure
    .input(
      z.object({
        kode: z.string().max(50).nullable().optional(),
        navn: z.string().min(1).max(255),
        internkostnad: z.number().nullable().optional(),
        prisMotKunde: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);
      await krevTimerAktivert(orgId);

      try {
        return await ctx.prismaTimer.aktivitet.create({
          data: {
            organizationId: orgId,
            kode: input.kode?.trim() || null,
            navn: input.navn.trim(),
            internkostnad: input.internkostnad ?? null,
            prisMotKunde: input.prisMotKunde ?? null,
          },
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Aktivitet med kode «${input.kode}» finnes allerede`,
          });
        }
        throw e;
      }
    }),

  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        kode: z.string().max(50).nullable().optional(),
        navn: z.string().min(1).max(255).optional(),
        internkostnad: z.number().nullable().optional(),
        prisMotKunde: z.number().nullable().optional(),
        aktiv: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);

      const eksisterende = await ctx.prismaTimer.aktivitet.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!eksisterende) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Aktivitet finnes ikke eller tilhører ikke ditt firma",
        });
      }

      const data: Prisma.AktivitetUpdateInput = {};
      if (input.kode !== undefined) data.kode = input.kode?.trim() || null;
      if (input.navn !== undefined) data.navn = input.navn.trim();
      if (input.internkostnad !== undefined) data.internkostnad = input.internkostnad;
      if (input.prisMotKunde !== undefined) data.prisMotKunde = input.prisMotKunde;
      if (input.aktiv !== undefined) data.aktiv = input.aktiv;

      try {
        return await ctx.prismaTimer.aktivitet.update({
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
            message: "En annen aktivitet har allerede denne koden",
          });
        }
        throw e;
      }
    }),

  // Soft-delete (Restrict-FK på DailySheet)
  deaktiver: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId);

      const eksisterende = await ctx.prismaTimer.aktivitet.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!eksisterende) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Aktivitet finnes ikke eller tilhører ikke ditt firma",
        });
      }

      return ctx.prismaTimer.aktivitet.update({
        where: { id: input.id },
        data: { aktiv: false },
      });
    }),
});
