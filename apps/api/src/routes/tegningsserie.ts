import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  opprettTegningsserieSchema,
  oppdaterTegningsserieSchema,
  flyttTegningerTilSerieSchema,
} from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

/**
 * Tegningsserie (T2, 2026-10-08). Lett «merk-og-flytt»-gruppering av tegninger fra én
 * rådgiver på én byggeplass (Kenneth-gatet 2026-10-06). Serien bærer BEVISST ikke
 * revisjon, målestokk eller status — de hører til den enkelte tegningen. Seriens
 * fag/opphav er STANDARDVERDIER: forslag ved opplasting (web) og eksplisitt skriving
 * via `brukPaAlle`, aldri stille overstyring (R10). Sletting av serien løsner
 * tegningene (FK SetNull), sletter dem aldri (R9, DoD test 10).
 *
 * Firmamodul-note: tegninger er en PROSJEKTmodul → isolasjon på projectId via
 * `verifiserProsjektmedlem`, samme som `tegningRouter`.
 */
export const tegningsserieRouter = router({
  // Hent seriene for en byggeplass (lista grupperer tegninger under disse).
  hentForByggeplass: protectedProcedure
    .input(z.object({ byggeplassId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.byggeplassId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return ctx.prisma.tegningsserie.findMany({
        where: { byggeplassId: input.byggeplassId },
        include: { _count: { select: { drawings: true } } },
        orderBy: [{ discipline: "asc" }, { name: "asc" }],
      });
    }),

  // Opprett en serie. Med `drawingIds` kobles de valgte tegningene straks («Ny serie
  // fra valgte»). Koblingen rører KUN serie_id — tegningenes eget fag/opphav er urørt
  // til brukeren eksplisitt trykker «Bruk på alle i serien».
  opprett: protectedProcedure
    .input(opprettTegningsserieSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { drawingIds, ...data } = input;

      // Hvis tegninger skal kobles: de MÅ tilhøre samme prosjekt som serien.
      if (drawingIds && drawingIds.length > 0) {
        const fremmed = await ctx.prisma.drawing.count({
          where: { id: { in: drawingIds }, projectId: { not: input.projectId } },
        });
        if (fremmed > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "En eller flere tegninger tilhører et annet prosjekt enn serien.",
          });
        }
      }

      return ctx.prisma.tegningsserie.create({
        data: {
          ...data,
          ...(drawingIds && drawingIds.length > 0
            ? { drawings: { connect: drawingIds.map((id) => ({ id })) } }
            : {}),
        },
        include: { _count: { select: { drawings: true } } },
      });
    }),

  // Oppdater seriens navn/metadata. Null nuller feltet eksplisitt.
  oppdater: protectedProcedure
    .input(oppdaterTegningsserieSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const serie = await ctx.prisma.tegningsserie.findUniqueOrThrow({
        where: { id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, serie.projectId);
      return ctx.prisma.tegningsserie.update({ where: { id }, data });
    }),

  // Slett serien. FK SetNull løsner tegningene — de BEVARES (DoD test 10).
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const serie = await ctx.prisma.tegningsserie.findUniqueOrThrow({
        where: { id: input.id },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, serie.projectId);
      await ctx.prisma.tegningsserie.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  // Flytt tegninger inn i (serieId satt) eller ut av (serieId = null) en serie.
  // Rører UTELUKKENDE serie_id — aldri tegningens eget fag/opphav/byggeplass
  // (DoD test 11; det er «Bruk på alle i serien» som skriver metadata).
  flyttTegninger: protectedProcedure
    .input(flyttTegningerTilSerieSchema)
    .mutation(async ({ ctx, input }) => {
      // Alle tegningene må tilhøre ETT prosjekt brukeren er medlem av.
      const tegninger = await ctx.prisma.drawing.findMany({
        where: { id: { in: input.drawingIds } },
        select: { projectId: true },
      });
      const prosjektIder = [...new Set(tegninger.map((t) => t.projectId))];
      if (prosjektIder.length !== 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tegningene må tilhøre samme prosjekt.",
        });
      }
      const projectId = prosjektIder[0]!;
      await verifiserProsjektmedlem(ctx.userId, projectId);

      // Flytter vi INN i en serie: serien må tilhøre samme prosjekt.
      if (input.serieId !== null) {
        const serie = await ctx.prisma.tegningsserie.findUniqueOrThrow({
          where: { id: input.serieId },
          select: { projectId: true },
        });
        if (serie.projectId !== projectId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Serien tilhører et annet prosjekt enn tegningene.",
          });
        }
      }

      const res = await ctx.prisma.drawing.updateMany({
        where: { id: { in: input.drawingIds } },
        data: { serieId: input.serieId },
      });
      return { antall: res.count };
    }),

  // «Bruk på alle i serien» (R10): skriv seriens fag/opphav/byggeplass som STANDARD på
  // alle tegninger i serien. Eksplisitt handling — web viser antallet først. Skriver kun
  // felt serien faktisk har satt; rører aldri revisjon/målestokk/status (serien har dem ikke).
  brukPaAlle: protectedProcedure
    .input(z.object({ serieId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const serie = await ctx.prisma.tegningsserie.findUniqueOrThrow({
        where: { id: input.serieId },
        select: { projectId: true, discipline: true, originator: true, byggeplassId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, serie.projectId);

      const data: { discipline?: string; originator?: string; byggeplassId?: string } = {};
      if (serie.discipline !== null) data.discipline = serie.discipline;
      if (serie.originator !== null) data.originator = serie.originator;
      if (serie.byggeplassId !== null) data.byggeplassId = serie.byggeplassId;

      if (Object.keys(data).length === 0) {
        return { antall: 0 };
      }

      const res = await ctx.prisma.drawing.updateMany({
        where: { serieId: input.serieId },
        data,
      });
      return { antall: res.count };
    }),
});
