import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc/trpc";
import { verifiserOrganisasjonTilgang } from "../../trpc/tilgangskontroll";
import { prisma } from "@sitedoc/db";
import {
  forhandsvisningSynkron,
  extractKjennemerke,
  parseForhandsvisning,
  krevMaskinAktivert,
  VegvesenIkkeFunnetError,
  VegvesenRateLimitError,
  VegvesenApiNokkelMangler,
} from "../../services/maskin";
import { normaliserRegnummer, erGyldigRegnummer } from "@sitedoc/shared";

const KATEGORIER = ["kjoretoy", "anleggsmaskin", "smautstyr"] as const;
const STATUS_VERDIER = [
  "bestilt",
  "mottatt",
  "tilgjengelig",
  "utlaant",
  "paa_service",
  "pensjonert",
] as const;
const EIERSKAP = ["eid", "leid", "leasing", "lant"] as const;

const PENSJONERT_GRUNN = ["solgt", "destruert", "tapt", "stjaalet", "slitt"] as const;

const opprettSchema = z.object({
  kategori: z.enum(KATEGORIER),
  type: z.string().min(1).max(100),
  merke: z.string().max(100).optional(),
  modell: z.string().max(100).optional(),
  internNavn: z.string().max(100).optional(),
  internNummer: z.string().max(100).optional(),
  ansvarligUserId: z.string().uuid().nullable().optional(),
  eierskap: z.enum(EIERSKAP).optional(),
  aarsmodell: z.number().int().min(1900).max(2100).nullable().optional(),
  lokasjon: z.string().max(255).optional(),
  anskaffelsesDato: z.string().optional(),
  nypris: z.number().optional(),
  notater: z.string().optional(),
  registreringsnummer: z.string().max(20).optional(),
  serienummer: z.string().max(100).optional(),
});

const regnummerSchema = z
  .string()
  .min(1)
  .transform((v) => normaliserRegnummer(v))
  .refine(erGyldigRegnummer, {
    message: "Ugyldig registreringsnummer (forventet 2 bokstaver + 4-5 sifre)",
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

function mapVegvesenFeil(err: unknown): TRPCError {
  if (err instanceof VegvesenIkkeFunnetError) {
    return new TRPCError({
      code: "NOT_FOUND",
      message: "Kjøretøy ikke funnet i Vegvesens register",
    });
  }
  if (err instanceof VegvesenRateLimitError) {
    return new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Vegvesen-API midlertidig overbelastet. Prøv igjen om ${Math.ceil(err.retryAfterSekunder / 60)} minutter.`,
    });
  }
  if (err instanceof VegvesenApiNokkelMangler) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Vegvesen-integrasjon mangler API-nøkkel på server",
    });
  }
  if (err instanceof Error && err.name === "AbortError") {
    return new TRPCError({
      code: "TIMEOUT",
      message: "Vegvesen svarte ikke innen tidsfristen — prøv igjen",
    });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Kunne ikke kontakte Vegvesen",
    cause: err,
  });
}

export const equipmentRouter = router({
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
      await krevMaskinAktivert(organizationId);

      return ctx.prismaMaskin.equipment.create({
        data: {
          organizationId,
          kategori: input.kategori,
          type: input.type,
          merke: input.merke,
          modell: input.modell,
          internNavn: input.internNavn,
          internNummer: input.internNummer,
          ansvarligUserId: input.ansvarligUserId ?? null,
          eierskap: input.eierskap ?? "eid",
          aarsmodell: input.aarsmodell ?? null,
          lokasjon: input.lokasjon,
          anskaffelsesDato: input.anskaffelsesDato ? new Date(input.anskaffelsesDato) : null,
          nypris: input.nypris,
          notater: input.notater,
          registreringsnummer: input.registreringsnummer
            ? normaliserRegnummer(input.registreringsnummer)
            : null,
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

      const { id, anskaffelsesDato, registreringsnummer, ...rest } = input;
      return ctx.prismaMaskin.equipment.update({
        where: { id },
        data: {
          ...rest,
          ...(anskaffelsesDato !== undefined
            ? { anskaffelsesDato: anskaffelsesDato ? new Date(anskaffelsesDato) : null }
            : {}),
          ...(registreringsnummer !== undefined
            ? {
                registreringsnummer: registreringsnummer
                  ? normaliserRegnummer(registreringsnummer)
                  : null,
              }
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

  // ==========================================================================
  //  Vegvesen-flyt — synkron forhåndsvisning + opprett med bekreftet data
  // ==========================================================================

  hentFraVegvesenForhandsvisning: protectedProcedure
    .input(z.object({ registreringsnummer: regnummerSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const organizationId = await hentBrukerOrg(ctx.userId);
      await krevMaskinAktivert(organizationId);

      // Sjekk dupletter før vi kontakter Vegvesen
      const eksisterende = await ctx.prismaMaskin.equipment.findFirst({
        where: { organizationId, registreringsnummer: input.registreringsnummer },
        select: { id: true },
      });
      if (eksisterende) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Kjøretøy er allerede registrert i firmaet ditt",
        });
      }

      try {
        const resultat = await forhandsvisningSynkron(
          ctx.prismaMaskin,
          input.registreringsnummer,
          null,
        );
        return {
          felter: resultat.felter,
          vegvesenData: resultat.vegvesenData,
        };
      } catch (err) {
        throw mapVegvesenFeil(err);
      }
    }),

  opprettMedVegvesen: protectedProcedure
    .input(
      z.object({
        registreringsnummer: regnummerSchema,
        vegvesenData: z.unknown(),
        type: z.string().min(1).max(100),
        internNavn: z.string().max(100).optional(),
        internNummer: z.string().max(100).optional(),
        ansvarligUserId: z.string().uuid().nullable().optional(),
        eierskap: z.enum(EIERSKAP).default("eid"),
        aarsmodell: z.number().int().min(1900).max(2100).nullable().optional(),
        lokasjon: z.string().max(255).optional(),
        anskaffelsesDato: z.string().optional(),
        nypris: z.number().optional(),
        notater: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const organizationId = await hentBrukerOrg(ctx.userId);
      await krevMaskinAktivert(organizationId);

      // Sikkerhets-sjekk: regnummeret i bekreftet data MÅ matche input
      const vegvesenRegnr = extractKjennemerke(input.vegvesenData);
      if (!vegvesenRegnr) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vegvesen-data mangler kjennemerke — hent forhåndsvisning på nytt",
        });
      }
      if (normaliserRegnummer(vegvesenRegnr) !== input.registreringsnummer) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Registreringsnummer i Vegvesen-data matcher ikke input",
        });
      }

      // Idempotens: 409 ved duplikat
      const eksisterende = await ctx.prismaMaskin.equipment.findFirst({
        where: { organizationId, registreringsnummer: input.registreringsnummer },
        select: { id: true },
      });
      if (eksisterende) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Kjøretøy er allerede registrert i firmaet ditt",
        });
      }

      // Extracter materialiserte felter fra rå-JSON
      const felter = parseForhandsvisning(input.vegvesenData, input.registreringsnummer);

      const aarsmodellFraVegvesen = felter.forsteRegistrering
        ? new Date(felter.forsteRegistrering).getFullYear()
        : null;

      const equipment = await ctx.prismaMaskin.equipment.create({
        data: {
          organizationId,
          kategori: "kjoretoy",
          type: input.type,
          merke: felter.merke ?? undefined,
          modell: felter.modell ?? undefined,
          internNavn: input.internNavn,
          internNummer: input.internNummer,
          ansvarligUserId: input.ansvarligUserId ?? null,
          eierskap: input.eierskap,
          aarsmodell: input.aarsmodell ?? aarsmodellFraVegvesen,
          lokasjon: input.lokasjon,
          anskaffelsesDato: input.anskaffelsesDato ? new Date(input.anskaffelsesDato) : null,
          nypris: input.nypris,
          notater: input.notater,
          status: "tilgjengelig",
          registreringsnummer: input.registreringsnummer,
          vin: felter.vin,
          farge: felter.farge,
          drivstoff: felter.drivstoff,
          kjoretoygruppe: felter.kjoretoygruppe,
          kjoretoygruppeNavn: felter.kjoretoygruppeNavn,
          antallSeter: felter.antallSeter,
          forsteRegistrering: felter.forsteRegistrering ? new Date(felter.forsteRegistrering) : null,
          effektKw: felter.effektKw ?? null,
          euroKlasse: felter.euroKlasse,
          totalvekt: felter.totalvekt,
          egenvekt: felter.egenvekt,
          nyttelast: felter.nyttelast,
          girkasse: felter.girkasse,
          co2GramPerKm: felter.co2GramPerKm ?? null,
          forbrukLiterPer10km: felter.forbrukLiterPer10km ?? null,
          euKontrollSist: felter.euKontrollSist ? new Date(felter.euKontrollSist) : null,
          euKontrollFrist: felter.euKontrollFrist ? new Date(felter.euKontrollFrist) : null,
          vegvesenData: input.vegvesenData as object,
          vegvesenDataOppdatert: new Date(),
          vegvesenDataStatus: "frisk",
        },
      });

      // Skriv audit-rad for nyregistreringen
      await ctx.prismaMaskin.vegvesenKo.create({
        data: {
          equipmentId: equipment.id,
          registreringsnummer: input.registreringsnummer,
          prioritet: 0,
          status: "fullfort",
          forsokAntall: 1,
          sistForsok: new Date(),
          fullfort: new Date(),
        },
      });

      return equipment;
    }),

  oppdaterFraVegvesen: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const utstyr = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.id },
        select: { organizationId: true, registreringsnummer: true },
      });
      if (!utstyr) throw new TRPCError({ code: "NOT_FOUND" });
      if (!utstyr.registreringsnummer) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Utstyr mangler registreringsnummer — kun kjøretøy støttes",
        });
      }

      // Kun firma-admin kan trigge manuell Vegvesen-oppdatering (unngår quota-sløsing)
      const bruker = await prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { role: true, organizationId: true },
      });
      if (bruker.role !== "company_admin" && bruker.role !== "sitedoc_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Krever firmaadmin-rettighet",
        });
      }
      if (bruker.organizationId !== utstyr.organizationId && bruker.role !== "sitedoc_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Annet firma" });
      }

      const { koerOppdatering } = await import("../../services/maskin");
      const resultat = await koerOppdatering(
        ctx.prismaMaskin,
        input.id,
        utstyr.registreringsnummer,
        50,
      );
      return resultat;
    }),
});
