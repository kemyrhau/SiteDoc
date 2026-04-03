import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc/trpc";
import { TRPCError } from "@trpc/server";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

// Hjelpefunksjon for å finne PSI med prosjekt + bygning (null = prosjektnivå)
function psiWhere(projectId: string, buildingId?: string | null) {
  return {
    projectId_buildingId: {
      projectId,
      buildingId: buildingId ?? null,
    },
  } as const;
}

export const psiRouter = router({
  // Hent alle PSI-er for prosjektet (prosjektnivå + per bygning)
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.psi.findMany({
        where: { projectId: input.projectId },
        include: {
          template: { select: { id: true, name: true, prefix: true } },
          building: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Hent én PSI med mal-objekter (for gjennomføring)
  hentMedObjekter: protectedProcedure
    .input(z.object({ psiId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({
        where: { id: input.psiId },
        include: {
          template: { include: { objects: { orderBy: { sortOrder: "asc" } } } },
          building: { select: { id: true, name: true } },
        },
      });
      await verifiserProsjektmedlem(ctx.userId, psi.projectId);
      return psi;
    }),

  // Opprett PSI (admin) — kan være prosjektnivå eller per bygning
  opprett: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      templateId: z.string().uuid(),
      buildingId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: input.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN", message: "Kun admin kan opprette PSI" });

      return ctx.prisma.psi.create({
        data: {
          projectId: input.projectId,
          buildingId: input.buildingId ?? null,
          templateId: input.templateId,
          version: 1,
        },
      });
    }),

  // Bump versjon — krev ny signering
  bumpVersjon: protectedProcedure
    .input(z.object({ psiId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: psi.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.prisma.psi.update({
        where: { id: input.psiId },
        data: { version: psi.version + 1 },
      });
    }),

  // Bytt mal (bumper versjon — ny mal = ny signering)
  byttMal: protectedProcedure
    .input(z.object({
      psiId: z.string().uuid(),
      templateId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: psi.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.prisma.psi.update({
        where: { id: input.psiId },
        data: { templateId: input.templateId, version: psi.version + 1 },
      });
    }),

  // Slett PSI
  slett: protectedProcedure
    .input(z.object({ psiId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: psi.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.prisma.psi.delete({ where: { id: input.psiId } });
    }),

  // Dashboard: hent alle signaturer for én PSI
  hentSignaturer: protectedProcedure
    .input(z.object({ psiId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      const medlem = await ctx.prisma.projectMember.findFirst({
        where: { userId: ctx.userId, projectId: psi.projectId, role: "admin" },
      });
      if (!medlem) throw new TRPCError({ code: "FORBIDDEN" });

      const signaturer = await ctx.prisma.psiSignatur.findMany({
        where: { psiId: input.psiId },
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

  // Min status: har jeg signert?
  hentMinStatus: protectedProcedure
    .input(z.object({ psiId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({ where: { id: input.psiId } });
      await verifiserProsjektmedlem(ctx.userId, psi.projectId);

      const signatur = await ctx.prisma.psiSignatur.findUnique({
        where: { psiId_userId: { psiId: input.psiId, userId: ctx.userId } },
      });

      return {
        signert: !!signatur?.completedAt,
        utdatert: signatur ? signatur.psiVersion < psi.version : false,
        versjon: psi.version,
        progresjon: signatur?.progress ?? 0,
      };
    }),

  // Start gjennomføring
  startGjennomforing: protectedProcedure
    .input(z.object({ psiId: z.string().uuid(), language: z.string().default("nb") }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({
        where: { id: input.psiId },
        include: { template: { include: { objects: { orderBy: { sortOrder: "asc" } } } } },
      });
      await verifiserProsjektmedlem(ctx.userId, psi.projectId);

      let signatur = await ctx.prisma.psiSignatur.findUnique({
        where: { psiId_userId: { psiId: input.psiId, userId: ctx.userId } },
      });

      if (!signatur || signatur.psiVersion < psi.version) {
        if (signatur) await ctx.prisma.psiSignatur.delete({ where: { id: signatur.id } });
        signatur = await ctx.prisma.psiSignatur.create({
          data: { psiId: input.psiId, psiVersion: psi.version, userId: ctx.userId, language: input.language },
        });
      }

      return { signaturId: signatur.id, psiVersjon: psi.version, progresjon: signatur.progress, template: psi.template };
    }),

  // Oppdater progresjon
  oppdaterProgresjon: protectedProcedure
    .input(z.object({ signaturId: z.string().uuid(), progress: z.number().int().min(0), data: z.record(z.unknown()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({ where: { id: input.signaturId } });
      if (signatur.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Allerede fullført" });
      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: { progress: input.progress, ...(input.data ? { data: input.data as object } : {}) },
      });
    }),

  // Fullfør med signatur
  fullfør: protectedProcedure
    .input(z.object({ signaturId: z.string().uuid(), signatureData: z.string().min(1), data: z.record(z.unknown()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({ where: { id: input.signaturId } });
      if (signatur.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Allerede fullført" });
      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: { signatureData: input.signatureData, completedAt: new Date(), ...(input.data ? { data: input.data as object } : {}) },
      });
    }),

  // Gjest: start
  guestStart: publicProcedure
    .input(z.object({
      psiId: z.string().uuid(),
      name: z.string().min(1).max(200),
      company: z.string().min(1).max(200),
      phone: z.string().max(30).optional(),
      language: z.string().default("nb"),
    }))
    .mutation(async ({ ctx, input }) => {
      const psi = await ctx.prisma.psi.findUniqueOrThrow({
        where: { id: input.psiId },
        include: { template: { include: { objects: { orderBy: { sortOrder: "asc" } } } } },
      });
      const signatur = await ctx.prisma.psiSignatur.create({
        data: { psiId: input.psiId, psiVersion: psi.version, guestName: input.name, guestCompany: input.company, guestPhone: input.phone, language: input.language },
      });
      return { signaturId: signatur.id, psiVersjon: psi.version, template: psi.template };
    }),

  // Gjest: oppdater progresjon
  guestOppdaterProgresjon: publicProcedure
    .input(z.object({ signaturId: z.string().uuid(), progress: z.number().int().min(0), data: z.record(z.unknown()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({ where: { id: input.signaturId } });
      if (signatur.userId) throw new TRPCError({ code: "FORBIDDEN", message: "Ikke en gjest-signatur" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST" });
      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: { progress: input.progress, ...(input.data ? { data: input.data as object } : {}) },
      });
    }),

  // Gjest: fullfør
  guestFullfør: publicProcedure
    .input(z.object({ signaturId: z.string().uuid(), signatureData: z.string().min(1), data: z.record(z.unknown()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const signatur = await ctx.prisma.psiSignatur.findUniqueOrThrow({ where: { id: input.signaturId } });
      if (signatur.userId) throw new TRPCError({ code: "FORBIDDEN" });
      if (signatur.completedAt) throw new TRPCError({ code: "BAD_REQUEST" });
      return ctx.prisma.psiSignatur.update({
        where: { id: input.signaturId },
        data: { signatureData: input.signatureData, completedAt: new Date(), ...(input.data ? { data: input.data as object } : {}) },
      });
    }),
});
