import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { autoriserAdminForFirma } from "../trpc/tilgangskontroll";
import { krevVarelagerAktivert, VarelagerModulIkkeAktivertError } from "../services/varelager/moduleGate";

async function verifiserFirmaAdminOgVarelager(
  userId: string,
  organizationId: string,
): Promise<void> {
  await autoriserAdminForFirma(userId, organizationId);
  try {
    await krevVarelagerAktivert(organizationId);
  } catch (e) {
    if (e instanceof VarelagerModulIkkeAktivertError) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Varelager-modulen er ikke aktivert for dette firmaet",
      });
    }
    throw e;
  }
}

export const vareKategoriRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        kunAktive: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserFirmaAdminOgVarelager(ctx.userId, input.organizationId);

      return ctx.prismaVarelager.vareKategori.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.kunAktive ? { aktiv: true } : {}),
        },
        orderBy: { navn: "asc" },
      });
    }),

  opprett: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        navn: z.string().min(1).max(100),
        kontonummer: z.string().max(20).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserFirmaAdminOgVarelager(ctx.userId, input.organizationId);

      try {
        return await ctx.prismaVarelager.vareKategori.create({
          data: {
            organizationId: input.organizationId,
            navn: input.navn.trim(),
            kontonummer: input.kontonummer?.trim() || null,
          },
        });
      } catch (e: unknown) {
        if (
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          (e as { code: string }).code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "En kategori med dette navnet finnes allerede",
          });
        }
        throw e;
      }
    }),

  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        organizationId: z.string().uuid(),
        navn: z.string().min(1).max(100).optional(),
        kontonummer: z.string().max(20).nullable().optional(),
        aktiv: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserFirmaAdminOgVarelager(ctx.userId, input.organizationId);

      const eksisterende = await ctx.prismaVarelager.vareKategori.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!eksisterende || eksisterende.organizationId !== input.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const { id, organizationId: _orgId, navn, kontonummer, aktiv } = input;
      try {
        return await ctx.prismaVarelager.vareKategori.update({
          where: { id },
          data: {
            ...(navn !== undefined ? { navn: navn.trim() } : {}),
            ...(kontonummer !== undefined ? { kontonummer: kontonummer?.trim() || null } : {}),
            ...(aktiv !== undefined ? { aktiv } : {}),
          },
        });
      } catch (e: unknown) {
        if (
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          (e as { code: string }).code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "En kategori med dette navnet finnes allerede",
          });
        }
        throw e;
      }
    }),

  slett: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserFirmaAdminOgVarelager(ctx.userId, input.organizationId);

      const eksisterende = await ctx.prismaVarelager.vareKategori.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!eksisterende || eksisterende.organizationId !== input.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      try {
        await ctx.prismaVarelager.vareKategori.delete({ where: { id: input.id } });
        return { ok: true };
      } catch (e: unknown) {
        if (
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          (e as { code: string }).code === "P2003"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Kategorien har varer tilknyttet og kan ikke slettes",
          });
        }
        throw e;
      }
    }),
});
