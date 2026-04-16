import { z } from "zod";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc/trpc";
import { sendInvitasjonsEpost } from "../services/epost";
import {
  verifiserAdminEllerFirmaansvarlig,
} from "../trpc/tilgangskontroll";
import { sjekkRateLimit } from "../utils/rateLimiter";

export const invitasjonRouter = router({
  // Hent invitasjoner for et prosjekt
  // Admin → alle, firmaansvarlig → kun egne, andre → 403
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { erAdmin } = await verifiserAdminEllerFirmaansvarlig(
        ctx.userId,
        input.projectId,
      );

      return ctx.prisma.projectInvitation.findMany({
        where: {
          projectId: input.projectId,
          ...(!erAdmin ? { invitedByUserId: ctx.userId } : {}),
        },
        include: {
          invitedBy: { select: { id: true, name: true, email: true } },
          faggruppe: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Valider invitasjonstoken (brukes av aksept-siden)
  validerToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const ip = ctx.req.ip ?? ctx.req.headers["x-forwarded-for"]?.toString() ?? "unknown";
      if (!sjekkRateLimit("invitasjon", ip, 20, 60 * 1000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "For mange forespørsler. Prøv igjen senere." });
      }

      const invitasjon = await ctx.prisma.projectInvitation.findUnique({
        where: { token: input.token },
        include: {
          project: { select: { id: true, name: true } },
          invitedBy: { select: { name: true } },
        },
      });

      if (!invitasjon) {
        return { gyldig: false, grunn: "ikke_funnet" as const };
      }

      if (invitasjon.status === "accepted") {
        return {
          gyldig: false,
          grunn: "allerede_akseptert" as const,
          prosjektId: invitasjon.projectId,
        };
      }

      if (invitasjon.expiresAt < new Date()) {
        return { gyldig: false, grunn: "utlopt" as const };
      }

      return {
        gyldig: true,
        grunn: null,
        epost: invitasjon.email,
        prosjektNavn: invitasjon.project.name,
        prosjektId: invitasjon.projectId,
        invitertAv: invitasjon.invitedBy.name,
      };
    }),

  // Aksepter invitasjon
  aksepter: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ip = ctx.req.ip ?? ctx.req.headers["x-forwarded-for"]?.toString() ?? "unknown";
      if (!sjekkRateLimit("invitasjon", ip, 10, 60 * 1000)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "For mange forespørsler. Prøv igjen senere." });
      }

      const invitasjon = await ctx.prisma.projectInvitation.findUnique({
        where: { token: input.token },
      });

      if (!invitasjon) {
        throw new Error("Invitasjon ikke funnet");
      }

      if (invitasjon.status === "accepted") {
        return { alleredeAkseptert: true, prosjektId: invitasjon.projectId };
      }

      if (invitasjon.expiresAt < new Date()) {
        throw new Error("Invitasjonen har utløpt");
      }

      await ctx.prisma.projectInvitation.update({
        where: { id: invitasjon.id },
        data: {
          status: "accepted",
          acceptedAt: new Date(),
        },
      });

      return { alleredeAkseptert: false, prosjektId: invitasjon.projectId };
    }),

  // Send invitasjon på nytt (admin eller firmaansvarlig for egne)
  sendPaNytt: protectedProcedure
    .input(z.object({ id: z.string().uuid(), melding: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const invitasjon = await ctx.prisma.projectInvitation.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          project: { select: { name: true } },
          invitedBy: { select: { name: true } },
        },
      });

      const { erAdmin } = await verifiserAdminEllerFirmaansvarlig(
        ctx.userId,
        invitasjon.projectId,
      );

      if (!erAdmin && invitasjon.invitedByUserId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Du kan kun sende egne invitasjoner på nytt",
        });
      }

      const nyToken = crypto.randomBytes(32).toString("base64url");
      const nyUtloper = new Date();
      nyUtloper.setDate(nyUtloper.getDate() + 7);

      const oppdatert = await ctx.prisma.projectInvitation.update({
        where: { id: input.id },
        data: {
          token: nyToken,
          expiresAt: nyUtloper,
          status: "pending",
        },
      });

      await sendInvitasjonsEpost({
        til: invitasjon.email,
        invitasjonstoken: nyToken,
        prosjektNavn: invitasjon.project.name,
        invitertAvNavn: invitasjon.invitedBy.name ?? "En kollega",
        melding: input.melding,
      });

      return oppdatert;
    }),

  // Trekk tilbake invitasjon (admin eller firmaansvarlig for egne)
  trekkTilbake: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const invitasjon = await ctx.prisma.projectInvitation.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true, invitedByUserId: true },
      });

      const { erAdmin } = await verifiserAdminEllerFirmaansvarlig(
        ctx.userId,
        invitasjon.projectId,
      );

      if (!erAdmin && invitasjon.invitedByUserId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Du kan kun trekke tilbake egne invitasjoner",
        });
      }

      return ctx.prisma.projectInvitation.delete({
        where: { id: input.id },
      });
    }),
});
