import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc/trpc";
import { verifiserOrganisasjonTilgang } from "../../trpc/tilgangskontroll";

export const vegvesenKoRouter = router({
  hentStatus: protectedProcedure
    .input(z.object({ equipmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const utstyr = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.equipmentId },
        select: { organizationId: true },
      });
      if (!utstyr) throw new TRPCError({ code: "NOT_FOUND" });
      await verifiserOrganisasjonTilgang(ctx.userId, utstyr.organizationId);

      const sisteRad = await ctx.prismaMaskin.vegvesenKo.findFirst({
        where: { equipmentId: input.equipmentId },
        orderBy: { opprettet: "desc" },
        select: {
          id: true,
          status: true,
          prioritet: true,
          forsokAntall: true,
          sistForsok: true,
          feilmelding: true,
          opprettet: true,
          fullfort: true,
        },
      });
      return sisteRad;
    }),
});
