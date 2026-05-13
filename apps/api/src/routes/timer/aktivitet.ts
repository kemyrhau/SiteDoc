import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db-timer";
import { router, protectedProcedure } from "../../trpc/trpc";
import { autoriserAdminForFirma, resolverOrgFraInput } from "../../trpc/tilgangskontroll";
import { krevTimerAktivert } from "../../services/timer";

// Steg 1b Fase C — orgId er påkrevd. Klienten må sende `valgtFirma.id`.
async function verifiserFirmaAdmin(userId: string, inputOrgId: string): Promise<string> {
  await autoriserAdminForFirma(userId, inputOrgId);
  return inputOrgId;
}

export const aktivitetRouter = router({
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
      const orgId = await resolverOrgFraInput(ctx.userId, input?.organizationId);
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
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
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
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

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
    .input(z.object({
      id: z.string().uuid(),
      organizationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

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
