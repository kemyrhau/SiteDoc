import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

export const psiRouter = router({
  // Hent aktiv PSI for prosjektet (med mal-objekter)
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const psi = await ctx.prisma.psi.findUnique({
        where: { projectId: input.projectId },
        include: {
          template: {
            include: { objects: { orderBy: { sortOrder: "asc" } } },
          },
        },
      });
      return psi;
    }),

  // Opprett PSI for prosjekt (admin)
  opprett: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      templateId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: input.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN", message: "Kun admin kan opprette PSI" });

      // Sjekk at det ikke allerede finnes PSI
      const eksisterende = await ctx.prisma.psi.findUnique({ where: { projectId: input.projectId } });
      if (eksisterende) throw new TRPCError({ code: "CONFLICT", message: "Prosjektet har allerede en PSI" });

      return ctx.prisma.psi.create({
        data: {
          projectId: input.projectId,
          templateId: input.templateId,
          version: 1,
        },
      });
    }),

  // Oppdater PSI (ny versjon — eksisterende signaturer er utdaterte)
  bumpVersjon: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: input.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });

      const psi = await ctx.prisma.psi.findUnique({ where: { projectId: input.projectId } });
      if (!psi) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.psi.update({
        where: { id: psi.id },
        data: { version: psi.version + 1 },
      });
    }),

  // Bytt mal på eksisterende PSI (admin)
  byttMal: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      templateId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: input.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });

      const psi = await ctx.prisma.psi.findUnique({ where: { projectId: input.projectId } });
      if (!psi) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.psi.update({
        where: { id: psi.id },
        data: { templateId: input.templateId },
      });
    }),

  // Dashboard: hent alle signaturer for PSI
  hentSignaturer: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: input.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });

      const psi = await ctx.prisma.psi.findUnique({ where: { projectId: input.projectId } });
      if (!psi) return { signaturer: [], versjon: 0 };

      const signaturer = await ctx.prisma.psiSignatur.findMany({
        where: { psiId: psi.id },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { startedAt: "desc" },
      });

      return {
        signaturer: signaturer.map((s) => ({
          id: s.id,
          brukerNavn: s.user?.name ?? s.guestName ?? "Ukjent",
          brukerEpost: s.user?.email ?? null,
          firma: s.guestCompany ?? null,
          erGjest: !s.userId,
          signertVersjon: s.psiVersion,
          gjeldende: s.psiVersion === psi.version,
          fullfort: !!s.completedAt,
          fullfortDato: s.completedAt,
          startetDato: s.startedAt,
          progresjon: s.progress,
          spraak: s.language,
        })),
        versjon: psi.version,
      };
    }),

  // Min status: har jeg signert gjeldende versjon?
  hentMinStatus: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const psi = await ctx.prisma.psi.findUnique({ where: { projectId: input.projectId } });
      if (!psi) return { harPsi: false, signert: false, utdatert: false, versjon: 0 };

      const signatur = await ctx.prisma.psiSignatur.findUnique({
        where: { psiId_userId: { psiId: psi.id, userId: ctx.userId } },
      });

      return {
        harPsi: true,
        signert: !!signatur?.completedAt,
        utdatert: signatur ? signatur.psiVersion < psi.version : false,
        versjon: psi.version,
        progresjon: signatur?.progress ?? 0,
      };
    }),

  // Start gjennomføring (oppretter eller returnerer eksisterende)
  startGjennomforing: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), language: z.string().default("nb") }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const psi = await ctx.prisma.psi.findUnique({
        where: { projectId: input.projectId },
        include: { template: { include: { objects: { orderBy: { sortOrder: "asc" } } } } },
      });
      if (!psi) throw new TRPCError({ code: "NOT_FOUND", message: "Ingen PSI for dette prosjektet" });

      // Finn eller opprett signatur
      let signatur = await ctx.prisma.psiSignatur.findUnique({
        where: { psiId_userId: { psiId: psi.id, userId: ctx.userId } },
      });

      if (!signatur || signatur.psiVersion < psi.version) {
        // Ny versjon — slett gammel og opprett ny
        if (signatur) {
          await ctx.prisma.psiSignatur.delete({ where: { id: signatur.id } });
        }
        signatur = await ctx.prisma.psiSignatur.create({
          data: {
            psiId: psi.id,
            psiVersion: psi.version,
            userId: ctx.userId,
            language: input.language,
          },
        });
      }

      return {
        signaturId: signatur.id,
        psiVersjon: psi.version,
        progresjon: signatur.progress,
        template: psi.template,
      };
    }),

  // Oppdater progresjon (lagre quiz-svar og seksjonsprogresjon)
  oppdaterProgresjon: protectedProcedure
    .input(z.object({
      signaturId: z.string().uuid(),
      progress: z.number().int().min(0),
      data: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({
        where: { id: input.signaturId },
      });
      if (signatur.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Allerede fullført" });

      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: {
          progress: input.progress,
          ...(input.data ? { data: input.data as object } : {}),
        },
      });
    }),

  // Fullfør PSI med signatur
  fullfør: protectedProcedure
    .input(z.object({
      signaturId: z.string().uuid(),
      signatureData: z.string().min(1), // base64
      data: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({
        where: { id: input.signaturId },
      });
      if (signatur.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Allerede fullført" });

      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: {
          signatureData: input.signatureData,
          completedAt: new Date(),
          ...(input.data ? { data: input.data as object } : {}),
        },
      });
    }),

  // Gjest: start gjennomføring via token (QR)
  guestStart: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(200),
      company: z.string().min(1).max(200),
      phone: z.string().max(30).optional(),
      language: z.string().default("nb"),
    }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUnique({
        where: { projectId: input.projectId },
        include: { template: { include: { objects: { orderBy: { sortOrder: "asc" } } } } },
      });
      if (!psi) throw new TRPCError({ code: "NOT_FOUND" });

      const signatur = await ctx.prisma.psiSignatur.create({
        data: {
          psiId: psi.id,
          psiVersion: psi.version,
          guestName: input.name,
          guestCompany: input.company,
          guestPhone: input.phone,
          language: input.language,
        },
      });

      return {
        signaturId: signatur.id,
        psiVersjon: psi.version,
        template: psi.template,
      };
    }),

  // Gjest: oppdater progresjon
  guestOppdaterProgresjon: publicProcedure
    .input(z.object({
      signaturId: z.string().uuid(),
      progress: z.number().int().min(0),
      data: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({
        where: { id: input.signaturId },
      });
      if (signatur.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Ikke en gjest-signatur" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST" });

      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: {
          progress: input.progress,
          ...(input.data ? { data: input.data as object } : {}),
        },
      });
    }),

  // Gjest: fullfør med signatur
  guestFullfør: publicProcedure
    .input(z.object({
      signaturId: z.string().uuid(),
      signatureData: z.string().min(1),
      data: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({
        where: { id: input.signaturId },
      });
      if (signatur.userId) throw new TRPCError({ code: "FORBIDDEN" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST" });

      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: {
          signatureData: input.signatureData,
          completedAt: new Date(),
          ...(input.data ? { data: input.data as object } : {}),
        },
      });
    }),
});
