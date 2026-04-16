import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { createFaggruppeSchema, copyFaggruppeSchema } from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

export const faggruppeRouter = router({
  // Hent alle faggrupper for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.faggruppe.findMany({
        where: { projectId: input.projectId },
        include: {
          ansvarlig: { select: { id: true, name: true, email: true } },
          faggruppeKoblinger: {
            include: {
              projectMember: {
                include: { user: true },
              },
            },
          },
          _count: {
            select: {
              bestillerChecklists: true,
              utforerChecklists: true,
              bestillerTasks: true,
              utforerTasks: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Hent én faggruppe med ID
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const faggruppe = await ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, faggruppe.projectId);
      return ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          project: true,
          faggruppeKoblinger: {
            include: {
              projectMember: {
                include: { user: true },
              },
            },
          },
        },
      });
    }),

  // Opprett ny faggruppe
  opprett: protectedProcedure
    .input(createFaggruppeSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { memberIds, ...data } = input;
      return ctx.prisma.$transaction(async (tx) => {
        const faggruppe = await tx.faggruppe.create({ data });
        if (memberIds.length > 0) {
          await tx.faggruppeKobling.createMany({
            data: memberIds.map((memberId) => ({
              projectMemberId: memberId,
              faggruppeId: faggruppe.id,
            })),
            skipDuplicates: true,
          });
        }
        return faggruppe;
      });
    }),

  // Oppdater faggruppe
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        faggruppeNummer: z.string().max(20).optional(),
        organizationNumber: z.string().optional(),
        color: z.string().max(50).optional(),
        industry: z.string().max(100).optional(),
        companyName: z.string().max(255).optional(),
        ansvarligId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const faggruppe = await ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, faggruppe.projectId);
      const { id, ...data } = input;
      return ctx.prisma.faggruppe.update({ where: { id }, data });
    }),

  // Kopier faggruppe fra et prosjekt til et annet (eller samme)
  kopier: protectedProcedure
    .input(copyFaggruppeSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.targetProjectId);
      const kilde = await ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.sourceFaggruppeId },
      });

      return ctx.prisma.$transaction(async (tx) => {
        const nyFaggruppe = await tx.faggruppe.create({
          data: {
            projectId: input.targetProjectId,
            name: input.name ?? kilde.name,
            faggruppeNummer: kilde.faggruppeNummer,
            organizationNumber: kilde.organizationNumber,
            color: input.color ?? kilde.color,
            industry: kilde.industry,
            companyName: kilde.companyName,
          },
        });

        if (input.memberIds.length > 0) {
          await tx.faggruppeKobling.createMany({
            data: input.memberIds.map((memberId) => ({
              projectMemberId: memberId,
              faggruppeId: nyFaggruppe.id,
            })),
            skipDuplicates: true,
          });
        }

        return nyFaggruppe;
      });
    }),

  // Sett ansvarlig for faggruppe
  settAnsvarlig: protectedProcedure
    .input(
      z.object({
        faggruppeId: z.string().uuid(),
        userId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const faggruppe = await ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.faggruppeId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, faggruppe.projectId);
      return ctx.prisma.faggruppe.update({
        where: { id: input.faggruppeId },
        data: { ansvarligId: input.userId },
      });
    }),

  // Slett faggruppe
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const faggruppe = await ctx.prisma.faggruppe.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true, name: true },
      });
      await verifiserProsjektmedlem(ctx.userId, faggruppe.projectId);

      // Sjekk om faggruppen har tilknyttede sjekklister eller oppgaver
      const [sjekklisteAntall, oppgaveAntall] = await Promise.all([
        ctx.prisma.checklist.count({
          where: {
            OR: [
              { bestillerFaggruppeId: input.id },
              { utforerFaggruppeId: input.id },
            ],
          },
        }),
        ctx.prisma.task.count({
          where: {
            OR: [
              { bestillerFaggruppeId: input.id },
              { utforerFaggruppeId: input.id },
            ],
          },
        }),
      ]);

      if (sjekklisteAntall > 0 || oppgaveAntall > 0) {
        const detaljer: string[] = [];
        if (sjekklisteAntall > 0) detaljer.push(`${sjekklisteAntall} sjekkliste${sjekklisteAntall !== 1 ? "r" : ""}`);
        if (oppgaveAntall > 0) detaljer.push(`${oppgaveAntall} oppgave${oppgaveAntall !== 1 ? "r" : ""}`);
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Kan ikke slette «${faggruppe.name}» fordi den har ${detaljer.join(" og ")} tilknyttet. Flytt eller slett disse først.`,
        });
      }

      return ctx.prisma.faggruppe.delete({ where: { id: input.id } });
    }),
});
