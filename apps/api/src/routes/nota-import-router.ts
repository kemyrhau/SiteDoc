import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { importerNotaTilPeriode } from "../services/nota-import";

export const notaImportRouter = router({
  importerTilPeriode: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        kontraktId: z.string(),
        documentId: z.string(),
        periodeNr: z.number().int().min(1),
        erSluttnota: z.boolean().default(false),
        gapGodkjent: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      return importerNotaTilPeriode(ctx.prisma, {
        ...input,
        userId: ctx.userId,
      });
    }),

  hentNotaPoster: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        periodId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const notaPoster = await ctx.prisma.ftdNotaPost.findMany({
        where: { periodId: input.periodId },
        include: {
          specPost: {
            select: {
              id: true, postnr: true, beskrivelse: true, enhet: true,
              nsKode: true, nsTittel: true, fullNsTekst: true,
              eksternNotat: true, importNotat: true, ikkeIBudsjett: true,
            },
          },
        },
      });

      return notaPoster.map((np) => ({
        id: np.specPost.id,
        postnr: np.specPost.postnr,
        beskrivelse: np.specPost.beskrivelse,
        enhet: np.specPost.enhet,
        nsKode: np.specPost.nsKode,
        nsTittel: np.specPost.nsTittel,
        fullNsTekst: np.specPost.fullNsTekst,
        eksternNotat: np.specPost.eksternNotat,
        importNotat: np.specPost.importNotat,
        mengdeAnbud: np.mengdeAnbud,
        enhetspris: np.enhetspris,
        sumAnbud: np.sumAnbud,
        mengdeDenne: np.mengdeDenne,
        mengdeTotal: np.mengdeTotal,
        mengdeForrige: np.mengdeForrige ?? null,
        verdiDenne: np.verdiDenne,
        verdiTotal: np.verdiTotal,
        verdiForrige: np.verdiForrige ?? null,
        prosentFerdig: np.prosentFerdig,
      }));
    }),
});
