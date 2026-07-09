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
  // Hent innlogget brukers grunnleggende info (id, name, role, organizationId)
  // brukes til å skjule/vise admin-knapper på klient
  hentMin: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return null;
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true, role: true, nyNavigasjon: true },
    });
    if (!user) return null;
    const medlem = await ctx.prisma.organizationMember.findFirst({
      where: { userId: ctx.userId },
      select: { organizationId: true },
    });
    return { ...user, organizationId: medlem?.organizationId ?? null };
  }),

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

  // Redesign/navigasjon (Plan 2) — brukerens egen nyNavigasjon-toggle (brukermeny/Mer-tab).
  // Skriver til den bruker-lagrede kontoen (User.nyNavigasjon), som er autoritativ kilde i
  // presedensen konto > lokal/query > env-default > av (@sitedoc/shared resolverNyNavigasjon).
  // `paa=true/false` = eksplisitt valg; `null` = nullstill til «ikke tildelt» (fall gjennom).
  settNyNavigasjon: protectedProcedure
    .input(z.object({ paa: z.boolean().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { nyNavigasjon: input.paa },
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
