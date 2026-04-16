import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  createDokumentflytSchema,
  updateDokumentflytSchema,
  addDokumentflytMedlemSchema,
  removeDokumentflytMedlemSchema,
  oppdaterRollerSchema,
} from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

const dokumentflytInclude = {
  medlemmer: {
    include: {
      dokumentflytPart: { select: { id: true, name: true, color: true } },
      projectMember: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      group: { select: { id: true, name: true } },
      hovedansvarligPerson: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { steg: "asc" as const },
  },
  maler: {
    include: { template: { select: { id: true, name: true, category: true } } },
  },
} as const;

export const dokumentflytRouter = router({
  // Hent alle dokumentflyter for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.dokumentflyt.findMany({
        where: { projectId: input.projectId },
        include: dokumentflytInclude,
        orderBy: { name: "asc" },
      });
    }),

  // Opprett ny dokumentflyt
  opprett: protectedProcedure
    .input(createDokumentflytSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { templateIds, medlemmer, roller, ...data } = input;
      return ctx.prisma.dokumentflyt.create({
        data: {
          ...data,
          roller: roller ?? [],
          maler: {
            create: templateIds.map((templateId) => ({ templateId })),
          },
          medlemmer: {
            create: medlemmer.map((m) => ({
              enterpriseId: m.enterpriseId,
              projectMemberId: m.projectMemberId,
              groupId: m.groupId,
              rolle: m.rolle,
              steg: m.steg,
            })),
          },
        },
        include: dokumentflytInclude,
      });
    }),

  // Oppdater dokumentflyt — navn og/eller maltilknytninger
  oppdater: protectedProcedure
    .input(updateDokumentflytSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { id, projectId: _projectId, templateIds, ...data } = input;

      if (Object.keys(data).length > 0) {
        await ctx.prisma.dokumentflyt.update({ where: { id }, data });
      }

      // Erstatt maltilknytninger hvis gitt
      if (templateIds !== undefined) {
        await ctx.prisma.dokumentflytMal.deleteMany({ where: { dokumentflytId: id } });
        if (templateIds.length > 0) {
          await ctx.prisma.dokumentflytMal.createMany({
            data: templateIds.map((templateId) => ({ dokumentflytId: id, templateId })),
          });
        }
      }

      return ctx.prisma.dokumentflyt.findUniqueOrThrow({
        where: { id },
        include: dokumentflytInclude,
      });
    }),

  // Oppdater roller-konfigurasjon (legg til/fjern roller, endre labels)
  oppdaterRoller: protectedProcedure
    .input(oppdaterRollerSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const eksisterende = await ctx.prisma.dokumentflyt.findUniqueOrThrow({
        where: { id: input.id },
        select: { roller: true },
      });

      // Finn roller som ble fjernet
      const nyeRolleNavn: Set<string> = new Set(input.roller.map((r) => r.rolle));
      const gamleRoller = (eksisterende.roller as Array<{ rolle: string }>) ?? [];
      const fjernedeRoller = gamleRoller
        .map((r) => r.rolle)
        .filter((rolle) => !nyeRolleNavn.has(rolle));

      // Slett DokumentflytMedlem for fjernede roller
      if (fjernedeRoller.length > 0) {
        await ctx.prisma.dokumentflytMedlem.deleteMany({
          where: {
            dokumentflytId: input.id,
            rolle: { in: fjernedeRoller },
          },
        });
      }

      return ctx.prisma.dokumentflyt.update({
        where: { id: input.id },
        data: { roller: input.roller },
        include: dokumentflytInclude,
      });
    }),

  // Slett dokumentflyt
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.dokumentflyt.delete({ where: { id: input.id } });
    }),

  // Legg til medlem (entreprise eller person) i dokumentflyt
  leggTilMedlem: protectedProcedure
    .input(addDokumentflytMedlemSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { projectId: _projectId, ...data } = input;
      return ctx.prisma.dokumentflytMedlem.create({
        data,
        include: {
          dokumentflytPart: { select: { id: true, name: true, color: true } },
          projectMember: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          group: { select: { id: true, name: true } },
        },
      });
    }),

  // Fjern medlem fra dokumentflyt
  fjernMedlem: protectedProcedure
    .input(removeDokumentflytMedlemSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.dokumentflytMedlem.delete({ where: { id: input.id } });
    }),

  // Sett/fjern hovedansvarlig for et medlem
  settHovedansvarlig: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        erHovedansvarlig: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const medlem = await ctx.prisma.dokumentflytMedlem.findUniqueOrThrow({
        where: { id: input.id },
      });

      // Fjern hovedansvarlig fra andre i samme dokumentflyt+rolle+steg
      if (input.erHovedansvarlig) {
        await ctx.prisma.dokumentflytMedlem.updateMany({
          where: {
            dokumentflytId: medlem.dokumentflytId,
            rolle: medlem.rolle,
            steg: medlem.steg,
            erHovedansvarlig: true,
          },
          data: { erHovedansvarlig: false },
        });
      }

      return ctx.prisma.dokumentflytMedlem.update({
        where: { id: input.id },
        data: { erHovedansvarlig: input.erHovedansvarlig },
      });
    }),

  // Sett hovedansvarlig person innenfor en gruppe (uten å opprette nye rader)
  settGruppeHovedansvarlig: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(), // DokumentflytMedlem-id (gruppe-raden)
        projectId: z.string().uuid(),
        hovedansvarligPersonId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const medlem = await ctx.prisma.dokumentflytMedlem.findUniqueOrThrow({
        where: { id: input.id },
      });

      // Fjern hovedansvarlig fra alle andre i samme dokumentflyt + rolle
      await ctx.prisma.dokumentflytMedlem.updateMany({
        where: {
          dokumentflytId: medlem.dokumentflytId,
          rolle: medlem.rolle,
          steg: medlem.steg,
        },
        data: {
          erHovedansvarlig: false,
          hovedansvarligPersonId: null,
        },
      });

      // Sett ny hovedansvarlig på denne gruppe-raden
      if (input.hovedansvarligPersonId) {
        return ctx.prisma.dokumentflytMedlem.update({
          where: { id: input.id },
          data: {
            erHovedansvarlig: true,
            hovedansvarligPersonId: input.hovedansvarligPersonId,
          },
        });
      }

      return ctx.prisma.dokumentflytMedlem.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  // Sett kanRedigere for et flytmedlem
  settKanRedigere: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        kanRedigere: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.dokumentflytMedlem.update({
        where: { id: input.id },
        data: { kanRedigere: input.kanRedigere },
      });
    }),
});
