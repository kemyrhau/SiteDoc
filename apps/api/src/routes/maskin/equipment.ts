import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc/trpc";
import {
  autoriserAdminForFirma,
  hentBrukersOrg,
  krevBrukersOrg,
} from "../../trpc/tilgangskontroll";
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
  "utgaatt",
] as const;
const EIERSKAP = ["eid", "leid", "leasing", "lant"] as const;

const UTGAATT_GRUNN = ["solgt", "destruert", "tapt", "stjaalet", "slitt"] as const;

const opprettSchema = z.object({
  organizationId: z.string().uuid().optional(),
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

/**
 * U6-fix: hent orgId for maskin-operasjon med sitedoc_admin-støtte.
 * Hvis input gir organizationId → verifiser admin-tilgang og bruk den.
 * Ellers → fallback til session-brukerens egen org (bakoverkompatibel).
 */
async function hentMaskinOrgFraInput(
  userId: string,
  inputOrgId: string | undefined,
): Promise<string> {
  if (inputOrgId) {
    await autoriserAdminForFirma(userId, inputOrgId);
    return inputOrgId;
  }
  return krevBrukersOrg(userId);
}

/**
 * U6-fix: verifiser at brukeren har tilgang til utstyr i en gitt org.
 * Erstatter verifiserOrganisasjonTilgang lokalt for å gi sitedoc_admin
 * lese-/skrive-tilgang på enhver org. Vanlige brukere må fortsatt ha
 * matchende organizationId.
 */
async function verifiserMaskinTilgang(
  userId: string,
  organizationId: string,
): Promise<void> {
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!bruker) throw new TRPCError({ code: "FORBIDDEN" });
  if (bruker.role === "sitedoc_admin") return;
  const brukersOrg = await hentBrukersOrg(userId);
  if (brukersOrg !== organizationId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
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
        organizationId: z.string().uuid().optional(),
        kategori: z.enum(KATEGORIER).optional(),
        status: z.enum(STATUS_VERDIER).optional(),
        ansvarligUserId: z.string().uuid().optional(),
        inkluderUtgaatt: z.boolean().default(false),
        sok: z.string().max(100).optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const organizationId = await hentMaskinOrgFraInput(
        ctx.userId,
        input?.organizationId,
      );

      const inkluderUtgaatt = input?.inkluderUtgaatt ?? false;
      const sokTrimmet = input?.sok?.trim();

      return ctx.prismaMaskin.equipment.findMany({
        where: {
          organizationId,
          ...(input?.kategori ? { kategori: input.kategori } : {}),
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.ansvarligUserId ? { ansvarligUserId: input.ansvarligUserId } : {}),
          ...(inkluderUtgaatt ? {} : { status: { not: "utgaatt" } }),
          ...(sokTrimmet
            ? {
                OR: [
                  { merke: { contains: sokTrimmet, mode: "insensitive" } },
                  { modell: { contains: sokTrimmet, mode: "insensitive" } },
                  { internNavn: { contains: sokTrimmet, mode: "insensitive" } },
                  { internNummer: { contains: sokTrimmet, mode: "insensitive" } },
                  { registreringsnummer: { contains: sokTrimmet, mode: "insensitive" } },
                  { vin: { contains: sokTrimmet, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ kategori: "asc" }, { merke: "asc" }, { modell: "asc" }],
      });
    }),

  // Aggregert antall per kategori (for filter-bar count-tags)
  antallPerKategori: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const organizationId = await hentMaskinOrgFraInput(
        ctx.userId,
        input?.organizationId,
      );

      const grupper = await ctx.prismaMaskin.equipment.groupBy({
        by: ["kategori"],
        where: { organizationId, status: { not: "utgaatt" } },
        _count: { _all: true },
      });
      return grupper.map((g) => ({
        kategori: g.kategori,
        antall: g._count._all,
      }));
    }),

  // Firma-medlemmer som kan velges som ansvarlig (filter-bar + ansvarlig-velger)
  hentMuligeAnsvarlige: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const organizationId = await hentMaskinOrgFraInput(
        ctx.userId,
        input?.organizationId,
      );

      const medlemmer = await prisma.organizationMember.findMany({
        where: { organizationId },
        select: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { name: "asc" } },
      });
      return medlemmer.map((m) => m.user);
    }),

  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const utstyr = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.id },
      });
      if (!utstyr) throw new TRPCError({ code: "NOT_FOUND" });

      await verifiserMaskinTilgang(ctx.userId, utstyr.organizationId);
      return utstyr;
    }),

  opprett: protectedProcedure
    .input(opprettSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const organizationId = await hentMaskinOrgFraInput(
        ctx.userId,
        input.organizationId,
      );
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
    .input(
      z.object({
        id: z.string().uuid(),
        // Generelt
        kategori: z.enum(KATEGORIER).optional(),
        type: z.string().min(1).max(100).optional(),
        merke: z.string().max(100).nullable().optional(),
        modell: z.string().max(100).nullable().optional(),
        internNavn: z.string().max(100).nullable().optional(),
        internNummer: z.string().max(100).nullable().optional(),
        ansvarligUserId: z.string().uuid().nullable().optional(),
        eierskap: z.enum(EIERSKAP).nullable().optional(),
        aarsmodell: z.number().int().min(1900).max(2100).nullable().optional(),
        lokasjon: z.string().max(255).nullable().optional(),
        // Anskaffelse
        anskaffelsesDato: z.string().nullable().optional(),
        nypris: z.number().nullable().optional(),
        eksportKode: z.string().max(50).nullable().optional(),
        // Notat
        notater: z.string().nullable().optional(),
        // Kjøretøy-info (manuell — Vegvesen-felter overskrives av oppdaterFraVegvesen)
        registreringsnummer: z.string().max(20).nullable().optional(),
        kmStand: z.number().int().nullable().optional(),
        motor: z.string().max(100).nullable().optional(),
        drivstoff: z.string().max(50).nullable().optional(),
        farge: z.string().max(50).nullable().optional(),
        // Anleggsmaskin-info
        serienummer: z.string().max(100).nullable().optional(),
        driftstimer: z.number().int().nullable().optional(),
        skuffeKapasitet: z.number().nullable().optional(),
        loftKapasitet: z.number().nullable().optional(),
        maksVekt: z.number().int().nullable().optional(),
        // Småutstyr-info
        kalibreringsDato: z.string().nullable().optional(),
        kalibreringsFrist: z.string().nullable().optional(),
        sertifiseringsDato: z.string().nullable().optional(),
        sertifiseringsFrist: z.string().nullable().optional(),
        effektW: z.number().int().nullable().optional(),
        vekt: z.number().int().nullable().optional(),
        // Steg 4b Fase 2 — utleie
        erUtleieobjekt: z.boolean().optional(),
        utleieprisPerDogn: z.number().nullable().optional(),
        utleieprisPerTime: z.number().nullable().optional(),
        utleieEnhet: z.enum(["doegn", "time"]).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const utstyr = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!utstyr) throw new TRPCError({ code: "NOT_FOUND" });
      await verifiserMaskinTilgang(ctx.userId, utstyr.organizationId);

      // Ekstra streng tilgangs-sjekk for ansvarligUserId-endringer (per A.6 hybrid)
      if (input.ansvarligUserId !== undefined) {
        const { verifiserMaskinAnsvarligSkriveTilgang } = await import(
          "../../trpc/tilgangskontroll"
        );
        await verifiserMaskinAnsvarligSkriveTilgang(ctx.userId, input.id);
      }

      const {
        id,
        anskaffelsesDato,
        registreringsnummer,
        kalibreringsDato,
        kalibreringsFrist,
        sertifiseringsDato,
        sertifiseringsFrist,
        ...rest
      } = input;

      function tilDate(v: string | null | undefined): Date | null | undefined {
        if (v === undefined) return undefined;
        if (v === null || v === "") return null;
        return new Date(v);
      }

      return ctx.prismaMaskin.equipment.update({
        where: { id },
        data: {
          ...rest,
          ...(anskaffelsesDato !== undefined
            ? { anskaffelsesDato: tilDate(anskaffelsesDato) }
            : {}),
          ...(registreringsnummer !== undefined
            ? {
                registreringsnummer: registreringsnummer
                  ? normaliserRegnummer(registreringsnummer)
                  : null,
              }
            : {}),
          ...(kalibreringsDato !== undefined
            ? { kalibreringsDato: tilDate(kalibreringsDato) }
            : {}),
          ...(kalibreringsFrist !== undefined
            ? { kalibreringsFrist: tilDate(kalibreringsFrist) }
            : {}),
          ...(sertifiseringsDato !== undefined
            ? { sertifiseringsDato: tilDate(sertifiseringsDato) }
            : {}),
          ...(sertifiseringsFrist !== undefined
            ? { sertifiseringsFrist: tilDate(sertifiseringsFrist) }
            : {}),
        },
      });
    }),

  settStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(STATUS_VERDIER),
        utgaattGrunn: z.enum(UTGAATT_GRUNN).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const utstyr = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });
      if (!utstyr) throw new TRPCError({ code: "NOT_FOUND" });
      await verifiserMaskinTilgang(ctx.userId, utstyr.organizationId);

      if (input.status === "utgaatt" && !input.utgaattGrunn) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "utgaattGrunn er påkrevd når status settes til 'utgaatt'",
        });
      }

      return ctx.prismaMaskin.equipment.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.status === "utgaatt"
            ? {
                utgaattDato: new Date(),
                utgaattGrunn: input.utgaattGrunn,
              }
            : {}),
        },
      });
    }),

  // ==========================================================================
  //  Vegvesen-flyt — synkron forhåndsvisning + opprett med bekreftet data
  // ==========================================================================

  hentFraVegvesenForhandsvisning: protectedProcedure
    .input(
      z.object({
        registreringsnummer: regnummerSchema,
        organizationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const organizationId = await hentMaskinOrgFraInput(
        ctx.userId,
        input.organizationId,
      );
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
        organizationId: z.string().uuid().optional(),
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
      const organizationId = await hentMaskinOrgFraInput(
        ctx.userId,
        input.organizationId,
      );
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
      await autoriserAdminForFirma(ctx.userId, utstyr.organizationId);

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
