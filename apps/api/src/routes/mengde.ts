import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import {
  hentTilgjengeligeMappeIder,
  byggMappeTilgangsFilter,
} from "../services/folder-tilgang";

type AvviksStatus = "Match" | "Endret" | "Ny" | "Fjernet";
export interface AvviksRad {
  postnr: string | null;
  beskrivelse: string | null;
  enhet: string | null;
  mengdeAnbud: number;
  mengdeKontrakt: number;
  mengdeDiff: number;
  sumAnbud: number;
  sumKontrakt: number;
  sumDiff: number;
  status: AvviksStatus;
}

export const mengdeRouter = router({
  hentDokumenter: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const mappeIder = await hentTilgjengeligeMappeIder(
        ctx.userId,
        input.projectId,
      );
      return ctx.prisma.ftdDocument.findMany({
        where: {
          projectId: input.projectId,
          isActive: true,
          ...byggMappeTilgangsFilter(mappeIder),
        },
        include: { folder: { select: { id: true, name: true } } },
        orderBy: { uploadedAt: "desc" },
      });
    }),

  hentPerioder: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        enterpriseId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.ftdNotaPeriod.findMany({
        where: {
          projectId: input.projectId,
          ...(input.enterpriseId
            ? { enterpriseId: input.enterpriseId }
            : {}),
        },
        include: {
          enterprise: { select: { id: true, name: true, color: true } },
        },
        orderBy: { periodeNr: "asc" },
      });
    }),

  hentSpecPoster: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        periodId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.ftdSpecPost.findMany({
        where: { projectId: input.projectId },
        include: {
          notaPoster: input.periodId
            ? { where: { periodId: input.periodId } }
            : false,
        },
        orderBy: { postnr: "asc" },
      });
    }),

  hentAvviksanalyse: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const specPosts = await ctx.prisma.ftdSpecPost.findMany({
        where: { projectId: input.projectId },
      });
      const forstePeriode = await ctx.prisma.ftdNotaPeriod.findFirst({
        where: { projectId: input.projectId, type: "a_nota" },
        orderBy: { periodeNr: "asc" },
        include: { poster: true },
      });

      if (!forstePeriode) return { rows: [], summary: null };

      const kontraktMap = new Map(
        forstePeriode.poster.map((p) => [p.specPostId, p]),
      );

      const rows: AvviksRad[] = specPosts.map((sp) => {
        const kp = kontraktMap.get(sp.id);
        const mengdeAnbud = Number(sp.mengdeAnbud ?? 0);
        const mengdeKontrakt = kp ? Number(kp.mengdeAnbud ?? 0) : 0;
        const sumAnbud = Number(sp.sumAnbud ?? 0);
        const sumKontrakt = kp ? Number(kp.sumAnbud ?? 0) : 0;

        let status: AvviksStatus;
        if (!kp) status = "Fjernet";
        else if (sumAnbud === sumKontrakt && mengdeAnbud === mengdeKontrakt)
          status = "Match";
        else status = "Endret";

        return {
          postnr: sp.postnr,
          beskrivelse: sp.beskrivelse,
          enhet: sp.enhet,
          mengdeAnbud,
          mengdeKontrakt,
          mengdeDiff: mengdeKontrakt - mengdeAnbud,
          sumAnbud,
          sumKontrakt,
          sumDiff: sumKontrakt - sumAnbud,
          status,
        };
      });

      // Poster i kontrakt som ikke finnes i budsjett → "Ny"
      for (const [specPostId, kp] of kontraktMap) {
        if (!specPosts.find((sp) => sp.id === specPostId)) {
          rows.push({
            postnr: null,
            beskrivelse: "Ny post",
            enhet: null,
            mengdeAnbud: 0,
            mengdeKontrakt: Number(kp.mengdeAnbud ?? 0),
            mengdeDiff: Number(kp.mengdeAnbud ?? 0),
            sumAnbud: 0,
            sumKontrakt: Number(kp.sumAnbud ?? 0),
            sumDiff: Number(kp.sumAnbud ?? 0),
            status: "Ny" as const,
          });
        }
      }

      return {
        rows,
        summary: {
          totalAnbud: rows.reduce((s, r) => s + r.sumAnbud, 0),
          totalKontrakt: rows.reduce((s, r) => s + r.sumKontrakt, 0),
          totalDiff: rows.reduce((s, r) => s + r.sumDiff, 0),
          antallMatch: rows.filter((r) => r.status === "Match").length,
          antallEndret: rows.filter((r) => r.status === "Endret").length,
          antallNy: rows.filter((r) => r.status === "Ny").length,
          antallFjernet: rows.filter((r) => r.status === "Fjernet").length,
        },
      };
    }),

  lagreNotat: protectedProcedure
    .input(z.object({ specPostId: z.string(), tekst: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.ftdSpecPost.update({
        where: { id: input.specPostId },
        data: { eksternNotat: input.tekst },
      });
    }),

  slettPeriode: protectedProcedure
    .input(z.object({ periodId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.ftdNotaPeriod.delete({
        where: { id: input.periodId },
      });
    }),
});
