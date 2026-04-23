import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc/trpc";
import { verifiserOrganisasjonTilgang } from "../../trpc/tilgangskontroll";
import { prisma } from "@sitedoc/db";

const KATEGORIER = ["kjoretoy", "anleggsmaskin", "smautstyr"] as const;
const STATUS_VERDIER = [
  "bestilt",
  "mottatt",
  "tilgjengelig",
  "utlaant",
  "paa_service",
  "pensjonert",
] as const;

const PENSJONERT_GRUNN = ["solgt", "destruert", "tapt", "stjaalet", "slitt"] as const;

const opprettSchema = z.object({
  kategori: z.enum(KATEGORIER),
  type: z.string().min(1).max(100),
  merke: z.string().max(100).optional(),
  modell: z.string().max(100).optional(),
  internNummer: z.string().max(100).optional(),
  ansvarligUserId: z.string().uuid().nullable().optional(),
  lokasjon: z.string().max(255).optional(),
  anskaffelsesDato: z.string().optional(), // ISO-dato
  nypris: z.number().optional(),
  notater: z.string().optional(),
  registreringsnummer: z.string().max(20).optional(),
  serienummer: z.string().max(100).optional(),
});

async function hentBrukerOrg(userId: string): Promise<string> {
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!bruker?.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bruker tilhører ingen organisasjon — maskin-modulen krever firmatilknytning",
    });
  }
  return bruker.organizationId;
}

export const equipmentRouter = router({
  // List utstyr for brukerens firma, med filter
  list: protectedProcedure
    .input(
      z.object({
        kategori: z.enum(KATEGORIER).optional(),
        status: z.enum(STATUS_VERDIER).optional(),
        ansvarligUserId: z.string().uuid().optional(),
        inkluderPensjonert: z.boolean().default(false),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const organizationId = await hentBrukerOrg(ctx.userId);

      const inkluderPensjonert = input?.inkluderPensjonert ?? false;

      return ctx.prismaMaskin.equipment.findMany({
        where: {
          organizationId,
          ...(input?.kategori ? { kategori: input.kategori } : {}),
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.ansvarligUserId ? { ansvarligUserId: input.ansvarligUserId } : {}),
          ...(inkluderPensjonert ? {} : { status: { not: "pensjonert" } }),
        },
        orderBy: [{ kategori: "asc" }, { merke: "asc" }, { modell: "asc" }],
      });
    }),

  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const utstyr = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.id },
      });
      if (!utstyr) throw new TRPCError({ code: "NOT_FOUND" });

      await verifiserOrganisasjonTilgang(ctx.userId, utstyr.organizationId);
      return utstyr;
    }),

  opprett: protectedProcedure
    .input(opprettSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const organizationId = await hentBrukerOrg(ctx.userId);

      return ctx.prismaMaskin.equipment.create({
        data: {
          organizationId,
          kategori: input.kategori,
          type: input.type,
          merke: input.merke,
          modell: input.modell,
          internNummer: input.internNummer,
          ansvarligUserId: input.ansvarligUserId ?? null,
          lokasjon: input.lokasjon,
          anskaffelsesDato: input.anskaffelsesDato ? new Date(input.anskaffelsesDato) : null,
          nypris: input.nypris,
          notater: input.notater,
          registreringsnummer: input.registreringsnummer,
          serienummer: input.serienummer,
          status: "tilgjengelig",
        },
      });
    }),

  oppdater: protectedProcedure
    .input(opprettSchema.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const utstyr = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!utstyr) throw new TRPCError({ code: "NOT_FOUND" });
      await verifiserOrganisasjonTilgang(ctx.userId, utstyr.organizationId);

      const { id, anskaffelsesDato, ...rest } = input;
      return ctx.prismaMaskin.equipment.update({
        where: { id },
        data: {
          ...rest,
          ...(anskaffelsesDato !== undefined
            ? { anskaffelsesDato: anskaffelsesDato ? new Date(anskaffelsesDato) : null }
            : {}),
        },
      });
    }),

  settStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(STATUS_VERDIER),
        pensjonertGrunn: z.enum(PENSJONERT_GRUNN).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const utstyr = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!utstyr) throw new TRPCError({ code: "NOT_FOUND" });
      await verifiserOrganisasjonTilgang(ctx.userId, utstyr.organizationId);

      if (input.status === "pensjonert" && !input.pensjonertGrunn) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "pensjonertGrunn er påkrevd når status settes til 'pensjonert'",
        });
      }

      return ctx.prismaMaskin.equipment.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.status === "pensjonert"
            ? {
                pensjonertDato: new Date(),
                pensjonertGrunn: input.pensjonertGrunn,
              }
            : {}),
        },
      });
    }),
});
