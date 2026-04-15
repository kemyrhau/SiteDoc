import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { SPRAAK_KODER } from "@sitedoc/shared";

const tabellOppsettSchema = z.object({
  kolonner: z.array(z.string()),
  bredder: z.record(z.string(), z.number()).optional(),
  sortering: z.object({
    kolonne: z.string(),
    retning: z.enum(["asc", "desc"]),
  }).nullable().optional(),
});

export const brukerRouter = router({
  hentSpraak: protectedProcedure.query(async ({ ctx }) => {
    const bruker = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { language: true },
    });
    return bruker?.language ?? "nb";
  }),

  oppdaterSpraak: protectedProcedure
    .input(z.object({ language: z.enum(SPRAAK_KODER as [string, ...string[]]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { language: input.language },
      });
      return { ok: true };
    }),

  // Hent tabelloppsett for en spesifikk liste
  hentTabelloppsett: protectedProcedure
    .input(z.object({ liste: z.string() }))
    .query(async ({ ctx, input }) => {
      const bruker = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { tabelloppsett: true },
      });
      const oppsett = bruker?.tabelloppsett as Record<string, unknown> | null;
      if (!oppsett || !oppsett[input.liste]) return null;
      return oppsett[input.liste] as { kolonner: string[]; bredder?: Record<string, number>; sortering?: { kolonne: string; retning: string } | null };
    }),

  // Lagre tabelloppsett for en spesifikk liste
  lagreTabelloppsett: protectedProcedure
    .input(z.object({
      liste: z.string(),
      oppsett: tabellOppsettSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const bruker = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { tabelloppsett: true },
      });
      const gjeldende = (bruker?.tabelloppsett as Record<string, unknown>) ?? {};
      const oppdatert = { ...gjeldende, [input.liste]: input.oppsett } as Record<string, unknown>;
      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { tabelloppsett: oppdatert as Parameters<typeof ctx.prisma.user.update>[0]["data"]["tabelloppsett"] },
      });
      return { ok: true };
    }),
});
