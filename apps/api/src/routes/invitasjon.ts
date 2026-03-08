import { z } from "zod";
import crypto from "crypto";
import { router, publicProcedure, protectedProcedure } from "../trpc/trpc";
import { sendInvitasjonsEpost } from "../services/epost";
import {
  verifiserProsjektmedlem,
  verifiserAdmin,
} from "../trpc/tilgangskontroll";

export const invitasjonRouter = router({
  // Hent alle invitasjoner for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      return ctx.prisma.projectInvitation.findMany({
        where: { projectId: input.projectId },
        include: {
          invitedBy: { select: { id: true, name: true, email: true } },
          enterprise: { select: { id: true, name: true } },
          group: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Valider invitasjonstoken (brukes av aksept-siden)
  validerToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
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

  // Send invitasjon på nytt
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

      await verifiserAdmin(ctx.userId, invitasjon.projectId);

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

  // Trekk tilbake invitasjon
  trekkTilbake: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const invitasjon = await ctx.prisma.projectInvitation.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserAdmin(ctx.userId, invitasjon.projectId);

      return ctx.prisma.projectInvitation.delete({
        where: { id: input.id },
      });
    }),
});
