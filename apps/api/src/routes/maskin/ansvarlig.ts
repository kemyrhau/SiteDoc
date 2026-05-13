import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc/trpc";
import {
  verifiserOrganisasjonTilgang,
  verifiserMaskinAnsvarligSkriveTilgang,
  hentBrukersOrg,
} from "../../trpc/tilgangskontroll";
import { prisma } from "@sitedoc/db";

/**
 * Tilleggsansvarlige (per A.6 hybrid).
 * Primær ligger på Equipment.ansvarligUserId — endres via equipment.oppdater.
 * Tilleggsansvarlige er m:n her med periode-felter (loan-pattern).
 */
export const ansvarligRouter = router({
  // Hent aktive tilleggsansvarlige for en maskin (periodeSlutt = NULL)
  list: protectedProcedure
    .input(z.object({ equipmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const equipment = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.equipmentId },
        select: { organizationId: true },
      });
      if (!equipment) throw new TRPCError({ code: "NOT_FOUND" });
      await verifiserOrganisasjonTilgang(ctx.userId, equipment.organizationId);

      const rader = await ctx.prismaMaskin.equipmentAnsvarlig.findMany({
        where: { equipmentId: input.equipmentId, periodeSlutt: null },
        orderBy: { periodeStart: "asc" },
      });

      // Berik med User-navn (cross-package svak ref)
      const userIds = Array.from(new Set(rader.map((r) => r.userId)));
      const users = userIds.length
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      return rader.map((r) => ({
        id: r.id,
        equipmentId: r.equipmentId,
        userId: r.userId,
        userName: userMap.get(r.userId)?.name ?? userMap.get(r.userId)?.email ?? null,
        periodeStart: r.periodeStart,
        opprettetAvUserId: r.opprettetAvUserId,
      }));
    }),

  tilfoy: protectedProcedure
    .input(
      z.object({
        equipmentId: z.string().uuid(),
        userId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserMaskinAnsvarligSkriveTilgang(ctx.userId, input.equipmentId);

      // Verifiser at mål-bruker tilhører samme firma som maskinen
      const equipment = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.equipmentId },
        select: { organizationId: true, ansvarligUserId: true },
      });
      if (!equipment) throw new TRPCError({ code: "NOT_FOUND" });

      const malBruker = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      if (!malBruker) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Bruker finnes ikke",
        });
      }
      const malOrgId = await hentBrukersOrg(input.userId);
      if (malOrgId !== equipment.organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Bruker tilhører ikke samme firma som maskinen",
        });
      }

      // Konflikt-sjekk: er denne brukeren allerede aktiv tilleggsansvarlig?
      const eksisterende = await ctx.prismaMaskin.equipmentAnsvarlig.findFirst({
        where: {
          equipmentId: input.equipmentId,
          userId: input.userId,
          periodeSlutt: null,
        },
      });
      if (eksisterende) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Brukeren er allerede tilleggsansvarlig for denne maskinen",
        });
      }

      return ctx.prismaMaskin.equipmentAnsvarlig.create({
        data: {
          equipmentId: input.equipmentId,
          userId: input.userId,
          opprettetAvUserId: ctx.userId,
        },
      });
    }),

  fjern: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const rad = await ctx.prismaMaskin.equipmentAnsvarlig.findUnique({
        where: { id: input.id },
        select: { equipmentId: true, periodeSlutt: true },
      });
      if (!rad) throw new TRPCError({ code: "NOT_FOUND" });
      if (rad.periodeSlutt) {
        // Allerede fjernet — idempotent
        return { ok: true };
      }

      await verifiserMaskinAnsvarligSkriveTilgang(ctx.userId, rad.equipmentId);

      await ctx.prismaMaskin.equipmentAnsvarlig.update({
        where: { id: input.id },
        data: { periodeSlutt: new Date() },
      });
      return { ok: true };
    }),
});
