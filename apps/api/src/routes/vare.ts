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

export const vareRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        kunAktive: z.boolean().optional(),
        kategoriId: z.string().uuid().nullable().optional(),
        sok: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserFirmaAdminOgVarelager(ctx.userId, input.organizationId);

      const sok = input.sok?.trim();
      return ctx.prismaVarelager.vare.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.kunAktive ? { aktiv: true } : {}),
          ...(input.kategoriId !== undefined ? { kategoriId: input.kategoriId } : {}),
          ...(sok
            ? {
                OR: [
                  { navn: { contains: sok, mode: "insensitive" } },
                  { varenummer: { contains: sok, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: {
          kategori: { select: { id: true, navn: true, kontonummer: true } },
        },
        orderBy: [{ navn: "asc" }],
      });
    }),

  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid(), organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserFirmaAdminOgVarelager(ctx.userId, input.organizationId);

      const vare = await ctx.prismaVarelager.vare.findUnique({
        where: { id: input.id },
        include: { kategori: { select: { id: true, navn: true } } },
      });
      if (!vare || vare.organizationId !== input.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return vare;
    }),

  opprett: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        navn: z.string().min(1).max(200),
        varenummer: z.string().max(50).nullable().optional(),
        enhet: z.string().min(1).max(20),
        pris: z.number().nullable().optional(),
        internkostnad: z.number().nullable().optional(),
        kategoriId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserFirmaAdminOgVarelager(ctx.userId, input.organizationId);

      if (input.kategoriId) {
        const kategori = await ctx.prismaVarelager.vareKategori.findUnique({
          where: { id: input.kategoriId },
          select: { organizationId: true },
        });
        if (!kategori || kategori.organizationId !== input.organizationId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Kategorien tilhører ikke dette firmaet",
          });
        }
      }

      try {
        return await ctx.prismaVarelager.vare.create({
          data: {
            organizationId: input.organizationId,
            navn: input.navn.trim(),
            varenummer: input.varenummer?.trim() || null,
            enhet: input.enhet.trim(),
            pris: input.pris ?? null,
            internkostnad: input.internkostnad ?? null,
            kategoriId: input.kategoriId ?? null,
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
            message: "En vare med samme navn og enhet finnes allerede",
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
        navn: z.string().min(1).max(200).optional(),
        varenummer: z.string().max(50).nullable().optional(),
        enhet: z.string().min(1).max(20).optional(),
        pris: z.number().nullable().optional(),
        internkostnad: z.number().nullable().optional(),
        kategoriId: z.string().uuid().nullable().optional(),
        aktiv: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserFirmaAdminOgVarelager(ctx.userId, input.organizationId);

      const eksisterende = await ctx.prismaVarelager.vare.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!eksisterende || eksisterende.organizationId !== input.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (input.kategoriId) {
        const kategori = await ctx.prismaVarelager.vareKategori.findUnique({
          where: { id: input.kategoriId },
          select: { organizationId: true },
        });
        if (!kategori || kategori.organizationId !== input.organizationId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Kategorien tilhører ikke dette firmaet",
          });
        }
      }

      const { id, organizationId: _orgId, navn, varenummer, enhet, pris, internkostnad, kategoriId, aktiv } = input;
      try {
        return await ctx.prismaVarelager.vare.update({
          where: { id },
          data: {
            ...(navn !== undefined ? { navn: navn.trim() } : {}),
            ...(varenummer !== undefined ? { varenummer: varenummer?.trim() || null } : {}),
            ...(enhet !== undefined ? { enhet: enhet.trim() } : {}),
            ...(pris !== undefined ? { pris } : {}),
            ...(internkostnad !== undefined ? { internkostnad } : {}),
            ...(kategoriId !== undefined ? { kategoriId } : {}),
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
            message: "En vare med samme navn og enhet finnes allerede",
          });
        }
        throw e;
      }
    }),

  deaktiver: protectedProcedure
    .input(z.object({ id: z.string().uuid(), organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserFirmaAdminOgVarelager(ctx.userId, input.organizationId);

      const eksisterende = await ctx.prismaVarelager.vare.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!eksisterende || eksisterende.organizationId !== input.organizationId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.prismaVarelager.vare.update({
        where: { id: input.id },
        data: { aktiv: false },
      });
    }),
});
