import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { SPRAAK_KODER } from "@sitedoc/shared";

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
});
