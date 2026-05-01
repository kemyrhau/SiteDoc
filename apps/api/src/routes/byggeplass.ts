import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { createByggeplassSchema } from "@sitedoc/shared";
import { verifiserAdmin, verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

export const byggeplassRouter = router({
  // Hent alle byggeplasser for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.byggeplass.findMany({
        where: {
          projectId: input.projectId,
          ...(input.type ? { type: input.type } : {}),
        },
        include: {
          drawings: {
            select: {
              id: true,
              name: true,
              drawingNumber: true,
              discipline: true,
              fileType: true,
              floor: true,
              geoReference: true,
            },
            orderBy: [
              { discipline: "asc" },
              { drawingNumber: "asc" },
              { name: "asc" },
            ],
          },
          _count: { select: { drawings: true } },
        },
        orderBy: { number: "asc" },
      });
    }),

  // Hent én byggeplass med ID
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          project: true,
          drawings: true,
        },
      });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return byggeplass;
    }),

  // Opprett ny byggeplass
  opprett: protectedProcedure
    .input(createByggeplassSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      // Auto-generer nummer per prosjekt
      const maks = await ctx.prisma.byggeplass.aggregate({
        where: { projectId: input.projectId },
        _max: { number: true },
      });
      const nesteNummer = (maks._max.number ?? 0) + 1;

      return ctx.prisma.byggeplass.create({
        data: { ...input, number: nesteNummer },
      });
    }),

  // Oppdater byggeplass
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        address: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({ where: { id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return ctx.prisma.byggeplass.update({ where: { id }, data });
    }),

  // Publiser byggeplass
  publiser: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({ where: { id: input.id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return ctx.prisma.byggeplass.update({
        where: { id: input.id },
        data: { status: "published" },
      });
    }),

  // Hent sammendrag før sletting (Fase 0.5 § 5 slette-policy)
  // Returnerer hva som vil skje med tilhørende data ved sletting:
  // - bevares: SetNull-relasjoner (data lever videre uten byggeplass-merking)
  // - slettes: Cascade-relasjoner (data slettes med byggeplassen)
  hentSletteSammendrag: protectedProcedure
    .input(z.object({ byggeplassId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.byggeplassId },
        select: {
          id: true,
          name: true,
          projectId: true,
          _count: {
            select: {
              drawings: true,
              pointClouds: true,
              checklists: true,
              ftdKontrakter: true,
              psiEr: true,
              omrader: true,
              kontrollplaner: true,
              gruppeKoblinger: true,
            },
          },
        },
      });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);

      return {
        navn: byggeplass.name,
        bevares: {
          tegninger: byggeplass._count.drawings,
          punktskyer: byggeplass._count.pointClouds,
          sjekklister: byggeplass._count.checklists,
          ftdKontrakter: byggeplass._count.ftdKontrakter,
          psi: byggeplass._count.psiEr,
        },
        slettes: {
          omrader: byggeplass._count.omrader,
          kontrollplaner: byggeplass._count.kontrollplaner,
          gruppeKoblinger: byggeplass._count.gruppeKoblinger,
        },
      };
    }),

  // Slett byggeplass (Fase 0.5 § 5 slette-policy)
  // Krever:
  // - prosjekt-admin (verifiserAdmin)
  // - case-insensitive navne-bekreftelse (GitHub-mønster)
  // SetNull-relasjoner (tegninger/sjekklister/PSI/kontrakter/punktskyer)
  // bevarer dataene; Cascade-relasjoner (områder/kontrollplaner/gruppe-
  // koblinger) slettes per schema-policy.
  slett: protectedProcedure
    .input(
      z.object({
        byggeplassId: z.string().uuid(),
        navnBekreftelse: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.byggeplassId },
        select: {
          id: true,
          name: true,
          projectId: true,
          _count: {
            select: {
              drawings: true,
              pointClouds: true,
              checklists: true,
              ftdKontrakter: true,
              psiEr: true,
              omrader: true,
              kontrollplaner: true,
              gruppeKoblinger: true,
            },
          },
        },
      });
      await verifiserAdmin(ctx.userId, byggeplass.projectId);

      if (
        input.navnBekreftelse.trim().toLowerCase() !==
        byggeplass.name.trim().toLowerCase()
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Navne-bekreftelse stemmer ikke. Skriv «${byggeplass.name}» nøyaktig.`,
        });
      }

      const sammendrag = {
        bevares: {
          tegninger: byggeplass._count.drawings,
          punktskyer: byggeplass._count.pointClouds,
          sjekklister: byggeplass._count.checklists,
          ftdKontrakter: byggeplass._count.ftdKontrakter,
          psi: byggeplass._count.psiEr,
        },
        slettes: {
          omrader: byggeplass._count.omrader,
          kontrollplaner: byggeplass._count.kontrollplaner,
          gruppeKoblinger: byggeplass._count.gruppeKoblinger,
        },
      };

      await ctx.prisma.byggeplass.delete({ where: { id: input.byggeplassId } });

      return { navn: byggeplass.name, ...sammendrag };
    }),
});
