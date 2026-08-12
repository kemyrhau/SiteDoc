import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserKanEksportere } from "../trpc/tilgangskontroll";
import { signerFilSti } from "../utils/hmac";

// Nedlastings-URL signeres ved hvert kall (arkivet lever i 7 dager på disk).
// 60 min, romsligere enn bilde-signeringens 5 min: signaturen valideres per
// HTTP-request i onRequest-hooken, og `@fastify/static` støtter Range-requests
// (gjenopptakbar/chunket nedlasting) — hver range er en ny request som re-
// valideres. Et stort arkiv over treg linje kan spenne mange minutter, så
// vinduet må dekke hele nedlastingen, ikke bare starten. Kortlevd nok til at en
// lekket lenke dør; brukeren henter uansett en fersk URL ved neste klikk.
const NEDLASTING_LEVETID_MS = 60 * 60 * 1000; // 60 min

export const eksportRouter = router({
  // Bestill en prosjekteksport. Worker plukker den opp asynkront.
  bestill: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserKanEksportere(ctx.userId, input.projectId);

      // Én aktiv jobb per prosjekt (fabels guard) — peker til den pågående.
      const aktiv = await ctx.prisma.eksportJobb.findFirst({
        where: { projectId: input.projectId, status: { in: ["bestilt", "bygger"] } },
        select: { id: true, status: true },
      });
      if (aktiv) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "En eksport for dette prosjektet er allerede i kø eller under bygging.",
        });
      }

      const prosjekt = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { primaryOrganizationId: true },
      });
      const organizationId = prosjekt?.primaryOrganizationId ?? null;

      const jobb = await ctx.prisma.eksportJobb.create({
        data: {
          type: "prosjekt_eksport",
          status: "bestilt",
          projectId: input.projectId,
          bestiltAvUserId: ctx.userId,
        },
        select: { id: true, status: true, createdAt: true },
      });

      // Spor: eksport-zipen er systemets mest sensitive fil (hele prosjektet i én
      // pakke). Logg bestillingen for diagnostikk (hvem, når, hvor).
      await ctx.prisma.activity.create({
        data: {
          actorUserId: ctx.userId,
          organizationId,
          projectId: input.projectId,
          targetType: "eksport",
          targetId: jobb.id,
          action: "bestilt",
          payload: { jobbId: jobb.id, projectId: input.projectId, organizationId },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });

      return jobb;
    }),

  // Historikk over eksporter for et prosjekt (nyeste først).
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserKanEksportere(ctx.userId, input.projectId);

      return ctx.prisma.eksportJobb.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          feilmelding: true,
          resultatStorrelse: true,
          utloperVed: true,
          createdAt: true,
          fullfortVed: true,
        },
      });
    }),

  // Utsted en kortlevd signert nedlastings-URL for et ferdig arkiv.
  //
  // MØNSTERREGEL (gjelder generelt, ikke bare eksport): et kall som skriver en
  // revisjonspliktig logg-rad per invokasjon skal være en mutation, ALDRI en
  // query. react-query kan cache og refetche queries fritt, så «utstedt 3 ganger»
  // ville dukket opp i revisjonssporet når brukeren klikket én. Et logget
  // sideeffekt-kall er per definisjon ikke en query.
  hentNedlastingsUrl: protectedProcedure
    .input(z.object({ jobbId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const jobb = await ctx.prisma.eksportJobb.findUnique({
        where: { id: input.jobbId },
        select: { projectId: true, status: true, resultatSti: true, utloperVed: true },
      });
      if (!jobb || !jobb.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Eksportjobben finnes ikke." });
      }
      await verifiserKanEksportere(ctx.userId, jobb.projectId);

      if (jobb.status !== "klar" || !jobb.resultatSti) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Eksporten er ikke klar for nedlasting.",
        });
      }
      if (jobb.utloperVed && jobb.utloperVed < new Date()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Eksporten er utløpt. Bestill en ny.",
        });
      }

      const prosjekt = await ctx.prisma.project.findUnique({
        where: { id: jobb.projectId },
        select: { primaryOrganizationId: true },
      });

      // 🔴 Det viktige sporet: hver gang en signert lenke utstedes (hvem, når, hvor).
      await ctx.prisma.activity.create({
        data: {
          actorUserId: ctx.userId,
          organizationId: prosjekt?.primaryOrganizationId ?? null,
          projectId: jobb.projectId,
          targetType: "eksport",
          targetId: input.jobbId,
          action: "nedlasting_url_utstedt",
          payload: { jobbId: input.jobbId, projectId: jobb.projectId },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });

      return { url: signerFilSti(jobb.resultatSti, NEDLASTING_LEVETID_MS) };
    }),
});
