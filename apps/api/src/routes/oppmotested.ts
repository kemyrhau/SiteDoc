import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  autoriserAdminForFirma,
  verifiserOrganisasjonTilgang,
} from "../trpc/tilgangskontroll";
import { GEOFENCE_GRENSER } from "@sitedoc/shared";
import { geokodAdresse } from "../services/rute-service";
import {
  MANUELL_KILDE,
  recomputeMatrise,
  recomputeMatriseIBakgrunn,
} from "../services/reisetidMatrise";

/**
 * POST 2026-11-14 (10) B: byggeplassen må tilhøre firmaet (org-aksen går via
 * `project.primaryOrganizationId`). Ellers NOT_FOUND — vi røper ikke at den finnes.
 */
async function hentByggeplassForFirma(id: string, organizationId: string) {
  const byggeplass = await prisma.byggeplass.findFirst({
    where: { id, project: { primaryOrganizationId: organizationId } },
    select: { id: true },
  });
  if (!byggeplass) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Byggeplassen finnes ikke eller tilhører ikke ditt firma",
    });
  }
  return byggeplass;
}

/** Fornuftige tak for en manuell avstand (avstand gir lønn). */
export const MANUELL_AVSTAND_GRENSER = { maksKm: 2000, maksMin: 1440 } as const;

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
// V17-A: grensene BINDER nå fra den delte kilden (ingen tallendring).
const radiusSchema = z
  .number()
  .int()
  .min(GEOFENCE_GRENSER.oppmotested.min)
  .max(GEOFENCE_GRENSER.oppmotested.max);

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
        select: {
          oppmotestedId: true,
          byggeplassId: true,
          kjoretidMin: true,
          // Reise-terskel-km: mobil trenger avstanden for km-klassifisering.
          avstandM: true,
        },
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
  // POST 2026-11-14 (10): valgfri `byggeplassId` = «Beregn» for én byggeplass
  // i fanen Avstander (alle oppmøtesteder × den). Firma-isolasjonen er
  // intrinsisk i recomputeMatrise (byggeplass filtreres på org).
  beregnMatrise: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        byggeplassId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      if (input.byggeplassId) {
        await hentByggeplassForFirma(input.byggeplassId, orgId);
      }
      return recomputeMatrise({
        organizationId: orgId,
        byggeplassId: input.byggeplassId,
      });
    }),

  // POST 2026-11-14 (10) B: fanen «Avstander» (firma-admin). Byggeplasser i
  // aktive prosjekter med punkt — pluss byggeplasser som har en manuell verdi
  // selv om punktet er fjernet (en verdi som gir lønn skal aldri være usynlig).
  hentAvstander: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      const [innstilling, oppmotesteder, byggeplasser, rader] = await Promise.all([
        ctx.prisma.organizationSetting.findUnique({
          where: { organizationId: orgId },
          select: { reiseTerskelEnhet: true },
        }),
        ctx.prisma.oppmotested.findMany({
          where: { organizationId: orgId, aktiv: true },
          select: { id: true, navn: true },
          orderBy: { navn: "asc" },
        }),
        ctx.prisma.byggeplass.findMany({
          where: {
            project: { primaryOrganizationId: orgId, status: "active" },
            OR: [
              { latitude: { not: null } },
              {
                reisetidMatriser: {
                  some: { organizationId: orgId, kilde: { startsWith: MANUELL_KILDE } },
                },
              },
            ],
          },
          select: {
            id: true,
            name: true,
            number: true,
            latitude: true,
            project: { select: { id: true, name: true, projectNumber: true } },
          },
          orderBy: [{ project: { name: "asc" } }, { number: "asc" }],
        }),
        ctx.prisma.reisetidMatrise.findMany({
          where: { organizationId: orgId },
          select: {
            oppmotestedId: true,
            byggeplassId: true,
            kjoretidMin: true,
            avstandM: true,
            kilde: true,
            beregnetAt: true,
          },
        }),
      ]);
      return {
        enhet: (innstilling?.reiseTerskelEnhet ?? "minutter") as "minutter" | "km",
        oppmotesteder,
        byggeplasser: byggeplasser.map((b) => ({
          id: b.id,
          navn: b.name,
          nummer: b.number,
          harPunkt: b.latitude != null,
          prosjekt: b.project,
        })),
        rader,
      };
    }),

  // POST 2026-11-14 (10) B: firmaets egen verdi for ett par. Hovedverdien
  // følger «Måles i» (km → avstand, minutter → kjøretid). Lagres som
  // kilde="manuell"; recompute overskriver den aldri (manuell-vakt).
  oppdaterAvstand: protectedProcedure
    .input(
      z
        .object({
          organizationId: z.string().uuid(),
          oppmotestedId: z.string().uuid(),
          byggeplassId: z.string().uuid(),
          avstandKm: z
            .number()
            .positive()
            .max(MANUELL_AVSTAND_GRENSER.maksKm)
            .optional(),
          kjoretidMin: z
            .number()
            .int()
            .positive()
            .max(MANUELL_AVSTAND_GRENSER.maksMin)
            .optional(),
        })
        .refine((v) => v.avstandKm !== undefined || v.kjoretidMin !== undefined, {
          message: "Oppgi avstand eller kjøretid",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await hentOppmotestedForFirma(input.oppmotestedId, orgId);
      await hentByggeplassForFirma(input.byggeplassId, orgId);

      const eksisterende = await ctx.prisma.reisetidMatrise.findFirst({
        where: {
          organizationId: orgId,
          oppmotestedId: input.oppmotestedId,
          byggeplassId: input.byggeplassId,
        },
        select: { kjoretidMin: true, avstandM: true },
      });
      // Verdien som ikke oppgis beholdes fra raden når den er kjent (≥ 0).
      // Kjøretid er påkrevd i skjemaet — uten kjent kjøretid må den oppgis.
      const kjoretidMin =
        input.kjoretidMin ??
        (eksisterende && eksisterende.kjoretidMin >= 0 ? eksisterende.kjoretidMin : null);
      if (kjoretidMin == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kjøretid er ikke kjent for dette paret — oppgi kjøretid også",
        });
      }
      const avstandM =
        input.avstandKm !== undefined
          ? Math.round(input.avstandKm * 1000)
          : eksisterende?.avstandM != null && eksisterende.avstandM >= 0
            ? eksisterende.avstandM
            : null;

      return ctx.prisma.reisetidMatrise.upsert({
        where: {
          oppmotestedId_byggeplassId: {
            oppmotestedId: input.oppmotestedId,
            byggeplassId: input.byggeplassId,
          },
        },
        create: {
          organizationId: orgId,
          oppmotestedId: input.oppmotestedId,
          byggeplassId: input.byggeplassId,
          kjoretidMin,
          avstandM,
          kilde: MANUELL_KILDE,
        },
        update: { kjoretidMin, avstandM, kilde: MANUELL_KILDE, beregnetAt: new Date() },
      });
    }),

  // POST 2026-11-14 (10) B: «Tilbakestill» — fjern firmaets verdi og beregn
  // paret på nytt (hele byggeplass-raden; andre manuelle par står).
  tilbakestillAvstand: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        oppmotestedId: z.string().uuid(),
        byggeplassId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await hentOppmotestedForFirma(input.oppmotestedId, orgId);
      await hentByggeplassForFirma(input.byggeplassId, orgId);
      await ctx.prisma.reisetidMatrise.deleteMany({
        where: {
          organizationId: orgId,
          oppmotestedId: input.oppmotestedId,
          byggeplassId: input.byggeplassId,
        },
      });
      return recomputeMatrise({ organizationId: orgId, byggeplassId: input.byggeplassId });
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
            // (10): flyttet kontor → manuelle par merkes "manuell_endret".
            plasseringEndret: true,
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
