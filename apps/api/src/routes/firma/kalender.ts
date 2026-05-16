import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma, prisma, beregnNorskeHelligdager } from "@sitedoc/db";
import { router, protectedProcedure } from "../../trpc/trpc";
import {
  autoriserAdminForFirma,
  verifiserOrganisasjonTilgang,
} from "../../trpc/tilgangskontroll";

// T.9-spec — type-listen valideres her, ikke i Prisma-enum, slik at den
// kan utvides uten DB-migrasjon.
const KalenderType = z.enum([
  "helligdag",
  "fellesferie",
  "klemdager",
  "sommertid_start",
  "sommertid_slutt",
  "halvdag",
  "firma_fri",
]);

type KalenderType = z.infer<typeof KalenderType>;

/**
 * Konverter Date → "YYYY-MM-DD" i UTC. Brukes som sammenligningsnøkkel
 * ved import (helligdager kommer som UTC midnatt fra beregnNorskeHelligdager).
 */
function toIsoDato(dato: Date): string {
  return dato.toISOString().slice(0, 10);
}

/**
 * Valider at timerOverstyr kun settes for halvdag-type.
 * Kastes som BAD_REQUEST hvis kombinasjonen er ugyldig.
 */
function validerTimerOverstyr(type: KalenderType, timerOverstyr: number | null | undefined): void {
  if (type === "halvdag") {
    if (timerOverstyr === null || timerOverstyr === undefined) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Halvdag krever timerOverstyr (antall timer)",
      });
    }
    if (timerOverstyr <= 0 || timerOverstyr >= 24) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "timerOverstyr må være > 0 og < 24",
      });
    }
  } else if (timerOverstyr !== null && timerOverstyr !== undefined) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "timerOverstyr kan kun settes for halvdag-type",
    });
  }
}

/**
 * Returnerer status for sommertid-paret i et gitt år.
 * Brukes av hentForAar-respons så UI kan varsle om ufullstendig konfigurasjon.
 */
async function sommertidStatusForAar(
  organizationId: string,
  aar: number,
): Promise<"komplett" | "bare_start" | "bare_slutt" | "ingen"> {
  const rader = await prisma.arbeidstidsKalender.findMany({
    where: {
      organizationId,
      aar,
      type: { in: ["sommertid_start", "sommertid_slutt"] },
      aktiv: true,
    },
    select: { type: true },
  });
  const harStart = rader.some((r) => r.type === "sommertid_start");
  const harSlutt = rader.some((r) => r.type === "sommertid_slutt");
  if (harStart && harSlutt) return "komplett";
  if (harStart) return "bare_start";
  if (harSlutt) return "bare_slutt";
  return "ingen";
}

// HH:MM regex — 00:00 til 23:59. Brukes i Zod-input for de tre periode-feltene.
const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * T.4 — Tidsfelter (standardStartTid/standardSluttTid/pauseMin) på
 * ArbeidstidsKalender er kun gyldig for sommertid_start, sommertid_slutt
 * og halvdag. Avvises for helligdag/fellesferie/klemdager/firma_fri siden
 * de dagene ikke har arbeidstid-relevant rolle.
 */
function validerTidsfelter(
  type: KalenderType,
  felter: {
    standardStartTid?: string | null;
    standardSluttTid?: string | null;
    pauseMin?: number | null;
  },
): void {
  const harTidsfelt =
    (felter.standardStartTid !== null && felter.standardStartTid !== undefined) ||
    (felter.standardSluttTid !== null && felter.standardSluttTid !== undefined) ||
    (felter.pauseMin !== null && felter.pauseMin !== undefined);

  const erTidsRelevant =
    type === "sommertid_start" ||
    type === "sommertid_slutt" ||
    type === "halvdag";

  if (harTidsfelt && !erTidsRelevant) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Tidsfelter (standardStartTid/standardSluttTid/pauseMin) kan kun settes for sommertid_start, sommertid_slutt og halvdag",
    });
  }

  // Hvis begge tider er satt, krev start < slutt (samme dag, ingen midnatt-overgang).
  if (felter.standardStartTid && felter.standardSluttTid) {
    if (felter.standardStartTid >= felter.standardSluttTid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "standardStartTid må være før standardSluttTid",
      });
    }
  }
}

/**
 * T.4-validering — sommertid_start krever en aktiv sommertid_slutt-rad i
 * samme år. Forhindrer at firma ender opp med åpent sommertids-regime
 * uten definert avslutning (ville gjort `hentEffektivArbeidstid` til å
 * falle tilbake til firma-default for hele resten av året).
 *
 * `ignorerId` brukes ved oppdater for å ekskludere raden vi selv endrer
 * — relevant hvis brukeren bytter type FRA sommertid_slutt TIL
 * sommertid_start på samme rad (raden er ikke lenger en slutt etter
 * oppdateringen).
 */
async function krevSommertidParKomplett(
  organizationId: string,
  aar: number,
  ignorerId?: string,
): Promise<void> {
  const sluttRad = await prisma.arbeidstidsKalender.findFirst({
    where: {
      organizationId,
      aar,
      type: "sommertid_slutt",
      aktiv: true,
      ...(ignorerId ? { id: { not: ignorerId } } : {}),
    },
    select: { id: true },
  });

  if (!sluttRad) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Sommertid krever en sluttdato samme år. Opprett sommertid_slutt-rad først.",
    });
  }
}

/**
 * Hent én rad og verifiser at den tilhører firmaet.
 */
async function hentRadForFirma(id: string, organizationId: string) {
  const rad = await prisma.arbeidstidsKalender.findFirst({
    where: { id, organizationId },
  });
  if (!rad) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Kalender-rad finnes ikke eller tilhører ikke ditt firma",
    });
  }
  return rad;
}

export const kalenderRouter = router({
  /**
   * Hent alle aktive kalender-rader for et år. Tilgjengelig for alle
   * firma-medlemmer (ikke bare admin) — kalenderen er ikke sensitive data.
   */
  hentForAar: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        aar: z.number().int().min(1900).max(2200),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserOrganisasjonTilgang(ctx.userId, input.organizationId);

      const rader = await prisma.arbeidstidsKalender.findMany({
        where: {
          organizationId: input.organizationId,
          aar: input.aar,
          aktiv: true,
        },
        orderBy: { dato: "asc" },
      });

      const sommertidStatus = await sommertidStatusForAar(
        input.organizationId,
        input.aar,
      );

      return { rader, sommertidStatus };
    }),

  /**
   * Importer norske helligdager for et år. Idempotent — kjøres på nytt
   * uten å overskrive admin-deaktiverte rader.
   *
   * Strategi:
   *   - For hver av de 12 helligdagene fra beregnNorskeHelligdager:
   *     - Hvis dato eksisterer som aktiv=false → hopp over (admin har deaktivert)
   *     - Hvis dato eksisterer som aktiv=true → oppdater navn
   *     - Ellers → opprett ny rad
   */
  importerNorskStandard: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        aar: z.number().int().min(1900).max(2200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);

      const helligdager = beregnNorskeHelligdager(input.aar);

      const eksisterende = await prisma.arbeidstidsKalender.findMany({
        where: { organizationId: input.organizationId, aar: input.aar },
        select: { dato: true, type: true, aktiv: true },
      });
      const deaktiverteDatoer = new Set(
        eksisterende.filter((r) => !r.aktiv).map((r) => toIsoDato(r.dato)),
      );
      const eksisterendeDatoer = new Set(
        eksisterende.map((r) => toIsoDato(r.dato)),
      );

      let opprettet = 0;
      let oppdatert = 0;
      let hoppetOver = 0;

      for (const h of helligdager) {
        const datoIso = toIsoDato(h.dato);

        if (deaktiverteDatoer.has(datoIso)) {
          hoppetOver++;
          continue;
        }

        if (eksisterendeDatoer.has(datoIso)) {
          await prisma.arbeidstidsKalender.update({
            where: {
              organizationId_dato: {
                organizationId: input.organizationId,
                dato: h.dato,
              },
            },
            data: { navn: h.navn, type: "helligdag", aktiv: true },
          });
          oppdatert++;
        } else {
          await prisma.arbeidstidsKalender.create({
            data: {
              organizationId: input.organizationId,
              aar: input.aar,
              dato: h.dato,
              type: "helligdag",
              navn: h.navn,
            },
          });
          opprettet++;
        }
      }

      return { opprettet, oppdatert, hoppetOver };
    }),

  /**
   * Opprett en ny kalender-rad. Firma-admin-auth.
   *
   * Sommertid-par-validering (T.4 — hard validering):
   *   - Oppretting av `sommertid_start` krever at det finnes en aktiv
   *     `sommertid_slutt` i samme år. Kaster PRECONDITION_FAILED ellers.
   *   - `sommertid_slutt` kan opprettes uten matching start. Brukeren
   *     oppretter slutt først, deretter start.
   *
   * Status returneres via sommertidStatusForAar slik at UI kan varsle om
   * `bare_slutt`-tilstand mellom de to opprettelses-stegene.
   */
  opprett: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        dato: z.coerce.date(),
        type: KalenderType,
        navn: z.string().min(1).max(255),
        timerOverstyr: z.number().nullable().optional(),
        // T.4 (2026-05-16) — periode-overstyring. Kun gyldig for
        // sommertid_start/sommertid_slutt/halvdag (valideres i validerTidsfelter).
        standardStartTid: z.string().regex(HHMM_REGEX).nullable().optional(),
        standardSluttTid: z.string().regex(HHMM_REGEX).nullable().optional(),
        pauseMin: z.number().int().min(0).max(480).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      validerTimerOverstyr(input.type, input.timerOverstyr);
      validerTidsfelter(input.type, {
        standardStartTid: input.standardStartTid,
        standardSluttTid: input.standardSluttTid,
        pauseMin: input.pauseMin,
      });

      const aar = input.dato.getUTCFullYear();

      if (input.type === "sommertid_start") {
        await krevSommertidParKomplett(input.organizationId, aar);
      }

      try {
        const rad = await prisma.arbeidstidsKalender.create({
          data: {
            organizationId: input.organizationId,
            aar,
            dato: input.dato,
            type: input.type,
            navn: input.navn.trim(),
            timerOverstyr:
              input.timerOverstyr !== null && input.timerOverstyr !== undefined
                ? new Prisma.Decimal(input.timerOverstyr)
                : null,
            standardStartTid: input.standardStartTid ?? null,
            standardSluttTid: input.standardSluttTid ?? null,
            pauseMin: input.pauseMin ?? null,
          },
        });

        const sommertidStatus = await sommertidStatusForAar(
          input.organizationId,
          aar,
        );

        return { rad, sommertidStatus };
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "En kalender-rad finnes allerede på denne datoen",
          });
        }
        throw e;
      }
    }),

  /**
   * Oppdater en eksisterende kalender-rad. Firma-admin-auth.
   * Datoen kan ikke endres — opprett ny rad og slett gammel hvis dato skal byttes.
   */
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        organizationId: z.string().uuid(),
        type: KalenderType.optional(),
        navn: z.string().min(1).max(255).optional(),
        timerOverstyr: z.number().nullable().optional(),
        aktiv: z.boolean().optional(),
        // T.4 (2026-05-16) — periode-overstyring.
        standardStartTid: z.string().regex(HHMM_REGEX).nullable().optional(),
        standardSluttTid: z.string().regex(HHMM_REGEX).nullable().optional(),
        pauseMin: z.number().int().min(0).max(480).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const eksisterende = await hentRadForFirma(input.id, input.organizationId);

      const nyType = input.type ?? (eksisterende.type as KalenderType);
      const nyTimerOverstyr =
        input.timerOverstyr !== undefined
          ? input.timerOverstyr
          : eksisterende.timerOverstyr
            ? Number(eksisterende.timerOverstyr)
            : null;
      validerTimerOverstyr(nyType, nyTimerOverstyr);

      // T.4 — valider tidsfelter mot resulterende state. Bruker input-verdiene
      // hvis satt, ellers eksisterende. Slik fanges type-bytte FRA halvdag TIL
      // helligdag uten å eksplisitt sende standardStartTid: null som er
      // gyldig i tidligere state men ulovlig kombinasjon i ny state.
      const nyStandardStart =
        input.standardStartTid !== undefined
          ? input.standardStartTid
          : eksisterende.standardStartTid;
      const nyStandardSlutt =
        input.standardSluttTid !== undefined
          ? input.standardSluttTid
          : eksisterende.standardSluttTid;
      const nyPauseMin =
        input.pauseMin !== undefined ? input.pauseMin : eksisterende.pauseMin;
      validerTidsfelter(nyType, {
        standardStartTid: nyStandardStart,
        standardSluttTid: nyStandardSlutt,
        pauseMin: nyPauseMin,
      });

      // T.4 — bevarer invariant også på oppdater: hvis resulterende state er
      // sommertid_start, må det finnes en aktiv sommertid_slutt samme år
      // (eksklusive raden vi selv oppdaterer).
      if (nyType === "sommertid_start") {
        await krevSommertidParKomplett(
          input.organizationId,
          eksisterende.aar,
          input.id,
        );
      }

      const data: Prisma.ArbeidstidsKalenderUpdateInput = {};
      if (input.type !== undefined) data.type = input.type;
      if (input.navn !== undefined) data.navn = input.navn.trim();
      if (input.timerOverstyr !== undefined) {
        data.timerOverstyr =
          input.timerOverstyr === null
            ? null
            : new Prisma.Decimal(input.timerOverstyr);
      }
      if (input.aktiv !== undefined) data.aktiv = input.aktiv;
      if (input.standardStartTid !== undefined)
        data.standardStartTid = input.standardStartTid;
      if (input.standardSluttTid !== undefined)
        data.standardSluttTid = input.standardSluttTid;
      if (input.pauseMin !== undefined) data.pauseMin = input.pauseMin;

      return prisma.arbeidstidsKalender.update({
        where: { id: input.id },
        data,
      });
    }),

  /**
   * Soft-delete: setter aktiv=false. Behold raden for audit-spor og slik at
   * gjentatt importerNorskStandard ikke gjenoppretter admin-deaktiverte datoer.
   */
  slett: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        organizationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      await hentRadForFirma(input.id, input.organizationId);

      return prisma.arbeidstidsKalender.update({
        where: { id: input.id },
        data: { aktiv: false },
      });
    }),

  /**
   * Hent alle aktive kalender-rader for en periode. Brukes av mobil-cache
   * (T9d) — typisk fraAar = inneværende år, tilAar = neste år for å dekke
   * årsskifte. Tilgjengelig for alle firma-medlemmer.
   */
  hentForMobil: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        fraAar: z.number().int().min(1900).max(2200),
        tilAar: z.number().int().min(1900).max(2200),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.fraAar > input.tilAar) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "fraAar må være ≤ tilAar",
        });
      }
      await verifiserOrganisasjonTilgang(ctx.userId, input.organizationId);

      return prisma.arbeidstidsKalender.findMany({
        where: {
          organizationId: input.organizationId,
          aar: { gte: input.fraAar, lte: input.tilAar },
          aktiv: true,
        },
        orderBy: { dato: "asc" },
      });
    }),
});
