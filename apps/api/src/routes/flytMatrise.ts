import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { isValidStatusTransition } from "@sitedoc/shared";

/**
 * Flyt-rettighetsmatrise — admin-API (Kloss 2, config-design § 2).
 *
 * Leser/skriver FlytRettighetOverride (delta-modellen fra Kloss 1) og fører append-only
 * FlytRettighetLogg ved hver endring. **kanRedigereFlytMatrise = KUN sitedoc_admin i fase 1**
 * (Kenneth-vedtak 2026-07-23) — company_admin/prosjektadmin har ikke skrivetilgang ennå.
 *
 * Invariant (§ 5.4): en positiv override kan ALDRI skape en overgang statusmaskinen ikke har.
 * Håndheves både i den delte runtime-funksjonen (celleTillatt/prosjektadminCelle) OG her på skriv.
 */

// Sentinel-verdier for «(nytt)·Opprett»-raden (opprett er ingen statusovergang).
const SENTINEL_FRA = "nytt";
const SENTINEL_TIL = "opprett";

/** Pseudo-handlinger som ligger i handlingsuniverset men ikke i validTransitions. */
const PSEUDO_TIL = new Set(["deleted", "forwarded"]);

/**
 * Er en positiv override strukturelt gyldig? Opprett-sentinelen og pseudo-handlingene
 * (deleted/forwarded) er lovlige celler; alt annet må ligge i statusmaskinen.
 */
function erStruktureltGyldigOverride(fraStatus: string, tilStatus: string): boolean {
  if (fraStatus === SENTINEL_FRA && tilStatus === SENTINEL_TIL) return true;
  if (PSEUDO_TIL.has(tilStatus)) return true;
  return isValidStatusTransition(fraStatus, tilStatus);
}

async function verifiserSiteDocAdmin(userId: string): Promise<void> {
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (bruker?.role !== "sitedoc_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Kun SiteDoc-admin kan redigere flyt-rettighetsmatrisen" });
  }
}

const celleInput = z.object({
  orgId: z.string().uuid(),
  rolle: z.string().min(1),
  fraStatus: z.string().min(1),
  tilStatus: z.string().min(1),
});

export const flytMatriseRouter = router({
  // Les gjeldende overrides + om innlogget bruker kan redigere.
  hentMatrise: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bruker = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true } });
      const kanRedigere = bruker?.role === "sitedoc_admin";
      if (!kanRedigere) {
        // Fase 1: kun sitedoc_admin har tilgang til denne flaten i det hele tatt.
        throw new TRPCError({ code: "FORBIDDEN", message: "Ingen tilgang til flyt-rettighetsmatrisen" });
      }
      const overrides = await ctx.prisma.flytRettighetOverride.findMany({
        where: { orgId: input.orgId },
        select: { rolle: true, fraStatus: true, tilStatus: true, tillatt: true, endretAt: true, endretAv: { select: { name: true, email: true } } },
      });
      return { overrides, kanRedigere };
    }),

  // Append-only endringslogg for firmaet (flat, nyeste først).
  hentLogg: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.userId);
      return ctx.prisma.flytRettighetLogg.findMany({
        where: { orgId: input.orgId },
        orderBy: { endretAt: "desc" },
        take: 200,
        select: {
          rolle: true, fraStatus: true, tilStatus: true, fraVerdi: true, tilVerdi: true,
          kilde: true, endretAt: true, endretAv: { select: { name: true, email: true } },
        },
      });
    }),

  // Sett (upsert) én celle + før logg. tillatt=true snittes mot statusmaskinen.
  settRettighet: protectedProcedure
    .input(celleInput.extend({ tillatt: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.userId);

      if (input.tillatt && !erStruktureltGyldigOverride(input.fraStatus, input.tilStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Overgangen ${input.fraStatus} → ${input.tilStatus} finnes ikke i statusmaskinen og kan ikke slås på`,
        });
      }

      // Nåværende verdi (for logg): override-rad? på/av : default.
      const eksisterende = await ctx.prisma.flytRettighetOverride.findUnique({
        where: { orgId_rolle_fraStatus_tilStatus: { orgId: input.orgId, rolle: input.rolle, fraStatus: input.fraStatus, tilStatus: input.tilStatus } },
        select: { tillatt: true },
      });
      const fraVerdi = eksisterende ? (eksisterende.tillatt ? "på" : "av") : "default";
      const tilVerdi = input.tillatt ? "på" : "av";

      await ctx.prisma.$transaction([
        ctx.prisma.flytRettighetOverride.upsert({
          where: { orgId_rolle_fraStatus_tilStatus: { orgId: input.orgId, rolle: input.rolle, fraStatus: input.fraStatus, tilStatus: input.tilStatus } },
          create: { orgId: input.orgId, rolle: input.rolle, fraStatus: input.fraStatus, tilStatus: input.tilStatus, tillatt: input.tillatt, endretAvUserId: ctx.userId },
          update: { tillatt: input.tillatt, endretAvUserId: ctx.userId, endretAt: new Date() },
        }),
        ctx.prisma.flytRettighetLogg.create({
          data: { orgId: input.orgId, rolle: input.rolle, fraStatus: input.fraStatus, tilStatus: input.tilStatus, fraVerdi, tilVerdi, endretAvUserId: ctx.userId, kilde: "admin-ui" },
        }),
      ]);
      return { ok: true };
    }),

  // Tilbakestill til standard = slett override-raden + før logg (tilVerdi="default").
  tilbakestill: protectedProcedure
    .input(celleInput)
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.userId);

      const eksisterende = await ctx.prisma.flytRettighetOverride.findUnique({
        where: { orgId_rolle_fraStatus_tilStatus: { orgId: input.orgId, rolle: input.rolle, fraStatus: input.fraStatus, tilStatus: input.tilStatus } },
        select: { tillatt: true },
      });
      if (!eksisterende) return { ok: true }; // allerede standard — ingen endring, ingen logg

      await ctx.prisma.$transaction([
        ctx.prisma.flytRettighetOverride.delete({
          where: { orgId_rolle_fraStatus_tilStatus: { orgId: input.orgId, rolle: input.rolle, fraStatus: input.fraStatus, tilStatus: input.tilStatus } },
        }),
        ctx.prisma.flytRettighetLogg.create({
          data: { orgId: input.orgId, rolle: input.rolle, fraStatus: input.fraStatus, tilStatus: input.tilStatus, fraVerdi: eksisterende.tillatt ? "på" : "av", tilVerdi: "default", endretAvUserId: ctx.userId, kilde: "admin-ui" },
        }),
      ]);
      return { ok: true };
    }),
});
