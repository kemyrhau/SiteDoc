import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  autoriserAdminForFirma,
  verifiserOrganisasjonTilgang,
} from "../trpc/tilgangskontroll";
import { geokodAdresse } from "../services/rute-service";
import {
  recomputeMatrise,
  recomputeMatriseIBakgrunn,
} from "../services/reisetidMatrise";

/**
 * Verifiser at bruker er firmaadmin for et firma.
 * Speiler avdeling.ts (samme lokale mønster, signatur (userId, orgId)).
 */
async function verifiserFirmaAdmin(
  userId: string,
  inputOrgId: string,
): Promise<string> {
  await autoriserAdminForFirma(userId, inputOrgId);
  return inputOrgId;
}

/**
 * Verifiser at oppmøtestedet tilhører brukerens firma. Returnerer raden.
 */
async function hentOppmotestedForFirma(id: string, organizationId: string) {
  const oppmotested = await prisma.oppmotested.findFirst({
    where: { id, organizationId },
  });

  if (!oppmotested) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Oppmøtested finnes ikke eller tilhører ikke ditt firma",
    });
  }

  return oppmotested;
}

/**
 * Verifiser at en valgfri avdeling tilhører firmaet (hvis satt).
 */
async function verifiserAvdelingValgfri(
  avdelingId: string | null | undefined,
  organizationId: string,
): Promise<void> {
  if (!avdelingId) return;
  const avdeling = await prisma.avdeling.findFirst({
    where: { id: avdelingId, organizationId },
    select: { id: true },
  });
  if (!avdeling) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Avdelingen finnes ikke i ditt firma",
    });
  }
}

const latSchema = z.number().min(-90).max(90);
const lngSchema = z.number().min(-180).max(180);
const radiusSchema = z.number().int().min(10).max(5000);

export const oppmotestedRouter = router({
  // Hent alle oppmøtesteder for innlogget brukers firma (firma-admin)
  hentAlle: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      return ctx.prisma.oppmotested.findMany({
        where: { organizationId: orgId },
        include: { avdeling: { select: { id: true, navn: true } } },
        orderBy: { navn: "asc" },
      });
    }),

  // Medlems-tilgjengelig: aktive oppmøtesteder for firmaet (mobil-cache + GPS).
  // Member-level (verifiserOrganisasjonTilgang), ikke admin — speiler
  // organisasjon.hentArbeidstidDefaults-mønsteret. Returnerer kun feltene
  // mobil-Haversine trenger.
  hentForFirma: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserOrganisasjonTilgang(ctx.userId, input.organizationId);
      return ctx.prisma.oppmotested.findMany({
        where: { organizationId: input.organizationId, aktiv: true },
        select: {
          id: true,
          navn: true,
          lat: true,
          lng: true,
          radiusM: true,
        },
        orderBy: { navn: "asc" },
      });
    }),

  // R4: member-lesbar reisetid-matrise for firmaet (mobil-cache). Speiler
  // hentForFirma-mønsteret (verifiserOrganisasjonTilgang). Kun feltene
  // mobil-oppslaget trenger.
  hentMatriseForFirma: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserOrganisasjonTilgang(ctx.userId, input.organizationId);
      return ctx.prisma.reisetidMatrise.findMany({
        where: { organizationId: input.organizationId },
        select: { oppmotestedId: true, byggeplassId: true, kjoretidMin: true },
      });
    }),

  // Geokod en adresse → koordinat (firma-admin). Fyller lat/lng i UI; lagret
  // verdi = feltene (kart-klikk/manuell override bevart). Null-treff → null.
  geokod: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        adresse: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      return geokodAdresse(input.adresse);
    }),

  // R3: on-demand full firma-backfill av reisetid-matrisen (admin-only).
  // Await-er (eksplisitt brukerhandling — vil ha antall rader / feil).
  beregnMatrise: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      return recomputeMatrise({ organizationId: orgId });
    }),

  // Opprett nytt oppmøtested
  opprett: protectedProcedure
    .input(
      z.object({
        navn: z.string().min(1).max(255),
        adresse: z.string().max(500).optional(),
        lat: latSchema,
        lng: lngSchema,
        radiusM: radiusSchema.default(150),
        avdelingId: z.string().uuid().nullable().optional(),
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await verifiserAvdelingValgfri(input.avdelingId, orgId);
      try {
        const opprettet = await ctx.prisma.oppmotested.create({
          data: {
            organizationId: orgId,
            navn: input.navn.trim(),
            adresse: input.adresse?.trim() || null,
            lat: input.lat,
            lng: input.lng,
            radiusM: input.radiusM,
            avdelingId: input.avdelingId ?? null,
          },
        });
        // R3: nytt kontor → recompute kolonne (fire-and-forget).
        recomputeMatriseIBakgrunn({
          organizationId: orgId,
          oppmotestedId: opprettet.id,
        });
        return opprettet;
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Oppmøtested «${input.navn}» finnes allerede`,
          });
        }
        throw e;
      }
    }),

  // Oppdater oppmøtested
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        navn: z.string().min(1).max(255).optional(),
        adresse: z.string().max(500).nullable().optional(),
        lat: latSchema.optional(),
        lng: lngSchema.optional(),
        radiusM: radiusSchema.optional(),
        avdelingId: z.string().uuid().nullable().optional(),
        aktiv: z.boolean().optional(),
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      const eksisterende = await hentOppmotestedForFirma(input.id, orgId);
      if (input.avdelingId !== undefined) {
        await verifiserAvdelingValgfri(input.avdelingId, orgId);
      }

      const data: Prisma.OppmotestedUpdateInput = {};
      if (input.navn !== undefined) data.navn = input.navn.trim();
      if (input.adresse !== undefined) data.adresse = input.adresse?.trim() || null;
      if (input.lat !== undefined) data.lat = input.lat;
      if (input.lng !== undefined) data.lng = input.lng;
      if (input.radiusM !== undefined) data.radiusM = input.radiusM;
      if (input.aktiv !== undefined) data.aktiv = input.aktiv;
      if (input.avdelingId !== undefined) {
        data.avdeling = input.avdelingId
          ? { connect: { id: input.avdelingId } }
          : { disconnect: true };
      }

      try {
        const oppdatert = await ctx.prisma.oppmotested.update({
          where: { id: input.id },
          data,
        });
        // R3: recompute kolonne KUN hvis koordinatene faktisk endret seg.
        const latEndret = input.lat !== undefined && input.lat !== eksisterende.lat;
        const lngEndret = input.lng !== undefined && input.lng !== eksisterende.lng;
        if (latEndret || lngEndret) {
          recomputeMatriseIBakgrunn({
            organizationId: orgId,
            oppmotestedId: input.id,
          });
        }
        return oppdatert;
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Et annet oppmøtested har allerede dette navnet`,
          });
        }
        throw e;
      }
    }),

  // Slett oppmøtested
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid(), organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await hentOppmotestedForFirma(input.id, orgId);
      return ctx.prisma.oppmotested.delete({ where: { id: input.id } });
    }),
});
