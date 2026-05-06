import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { autoriserAdminForFirma } from "../trpc/tilgangskontroll";
import { Prisma, krypter } from "@sitedoc/db";

const FIRMA_TYPER = ["sentralregisteret"] as const;
const firmaTypeSchema = z.enum(FIRMA_TYPER);

export const firmaIntegrasjonRouter = router({
  list: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);

      const integrasjoner = await ctx.prisma.organizationIntegration.findMany({
        where: {
          organizationId: input.organizationId,
          type: { in: [...FIRMA_TYPER] },
        },
        orderBy: { createdAt: "asc" },
      });

      return integrasjoner.map((i) => ({
        id: i.id,
        type: i.type,
        url: i.url,
        harNøkkel: !!i.apiKey,
        aktiv: i.aktiv,
        createdAt: i.createdAt,
      }));
    }),

  lagre: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        type: firmaTypeSchema,
        apiKey: z.string().min(1),
        url: z.string().url().optional(),
        aktiv: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);

      const kryptertNoekkel = krypter(input.apiKey);

      const integrasjon = await ctx.prisma.organizationIntegration.upsert({
        where: {
          organizationId_type: {
            organizationId: input.organizationId,
            type: input.type,
          },
        },
        create: {
          organizationId: input.organizationId,
          type: input.type,
          url: input.url ?? null,
          apiKey: kryptertNoekkel,
          config: Prisma.JsonNull,
          aktiv: input.aktiv ?? true,
        },
        update: {
          apiKey: kryptertNoekkel,
          url: input.url !== undefined ? input.url : undefined,
          aktiv: input.aktiv !== undefined ? input.aktiv : undefined,
        },
      });

      return {
        id: integrasjon.id,
        type: integrasjon.type,
        url: integrasjon.url,
        harNøkkel: !!integrasjon.apiKey,
        aktiv: integrasjon.aktiv,
        createdAt: integrasjon.createdAt,
      };
    }),

  slett: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        type: firmaTypeSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);

      await ctx.prisma.organizationIntegration.deleteMany({
        where: {
          organizationId: input.organizationId,
          type: input.type,
        },
      });

      return { slettet: true };
    }),
});
