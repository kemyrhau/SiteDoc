/**
 * Printmotor fase 3 — lagrede utskriftsmaler for timer-rapport.
 *
 * `EksportOppsett` (db-timer, postgres-schema "timer") lagrer en VISNING —
 * radTyper + format som JSON — ikke dokumentstruktur. To nivåer via nullable
 * `eierId`: null = firmamal (alle i firmaet leser, kun firma-admin skriver),
 * satt = personlig (kun eieren ser/redigerer). `basertPaId` binder «Lagre som
 * min» til firmamalen den ble kopiert fra; «SetNull ved sletting» håndheves HER
 * (slett nuller basertPaId på pekende kopier), ikke av en Prisma-FK — modulen
 * har ingen @relation på tvers (A.20 svak-FK-mønster).
 *
 * Innebygde maler (Full eksport osv.) er KODE i klienten, ikke rader her.
 * «Løft personlig → firma» er KOPIERING på klienten (kall `lagre` med
 * nivaa="firma" + kopiert config), ikke en egen server-vei.
 *
 * Tilgang: hele rapport-flaten er firma-admin-gatet (autoriserAdminForFirma —
 * leser OrganizationMember.firmaRoller, IKKE User.role). Firmamal-skriving
 * krever den gaten; personlige rader er i tillegg eier-isolert (én firma-admin
 * kan ikke røre en annens personlige mal).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc/trpc";
import { autoriserAdminForFirma } from "../../trpc/tilgangskontroll";
import { krevTimerAktivert } from "../../services/timer";

async function verifiserFirmaAdmin(userId: string, inputOrgId: string): Promise<string> {
  await autoriserAdminForFirma(userId, inputOrgId);
  return inputOrgId;
}

/**
 * Config-formen (configVersion 2, fase 4). v1 var {radTyper, format}; fase 4 la til
 * `mottaker`/`gruppering`/`orientering`/`topptekst`. `format` (xlsx|pdf = filtype)
 * er URØRT fra v1 — `orientering` (auto|staaende|liggende = sideformat) er et EGET
 * felt, ikke en omdøping (navnekollisjon i designnotatet, ikke en beslutning).
 *
 * De fire fase 4-feltene er valgfrie med v1-defaults, så en klient som fortsatt
 * sender v1-config (kun radTyper+format) validerer og leses som intern/ingen/auto/
 * ingen topptekst — ingen atferdsendring for eksisterende maler. configVersion
 * bumpes til 2 på alle skriv herfra.
 */
const configSchema = z.object({
  radTyper: z.array(z.enum(["timer", "maskin", "tillegg", "utlegg"])).min(1),
  format: z.enum(["xlsx", "pdf"]),
  mottaker: z.enum(["intern", "ekstern"]).optional(),
  gruppering: z.enum(["ingen", "ansatt", "prosjekt"]).optional(),
  orientering: z.enum(["auto", "staaende", "liggende"]).optional(),
  topptekst: z.object({ linjer: z.array(z.string()) }).nullable().optional(),
});

const CONFIG_VERSION = 2;

const NIVAA = ["firma", "personlig"] as const;

export const eksportOppsettRouter = router({
  /**
   * Firmaets maler (eierId=null) + kallerens egne personlige (eierId=userId).
   * Aldri andres personlige. Firma øverst, så personlig, nyeste sist redigert
   * først innen hver bøtte (klienten grupperer på `eierId === null`).
   */
  list: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      return ctx.prismaTimer.eksportOppsett.findMany({
        where: {
          organizationId: orgId,
          OR: [{ eierId: null }, { eierId: ctx.userId }],
        },
        orderBy: [{ updatedAt: "desc" }],
      });
    }),

  /**
   * Opprett en mal. nivaa="firma" → eierId=null (krever firma-admin, som flaten
   * allerede er gatet på). nivaa="personlig" → eierId=kalleren. `basertPaId`
   * settes av «Lagre som min» og verifiseres å være en firmamal i samme firma.
   */
  lagre: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        name: z.string().min(1).max(120),
        config: configSchema,
        nivaa: z.enum(NIVAA),
        basertPaId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await krevTimerAktivert(orgId);

      // basertPaId må peke på en FIRMAMAL i samme firma (ellers er bindeleddet tull).
      if (input.basertPaId) {
        const opphav = await ctx.prismaTimer.eksportOppsett.findFirst({
          where: { id: input.basertPaId, organizationId: orgId, eierId: null },
          select: { id: true },
        });
        if (!opphav) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "basertPaId peker ikke på en firmamal i dette firmaet",
          });
        }
      }

      return ctx.prismaTimer.eksportOppsett.create({
        data: {
          organizationId: orgId,
          name: input.name.trim(),
          config: input.config,
          configVersion: CONFIG_VERSION,
          eierId: input.nivaa === "firma" ? null : ctx.userId,
          basertPaId: input.basertPaId ?? null,
          opprettetAvId: ctx.userId,
        },
      });
    }),

  /**
   * Oppdater navn/config på en eksisterende mal. Firmamal (eierId=null) krever
   * firma-admin (flaten er gatet); personlig mal krever at kalleren ER eieren.
   */
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        organizationId: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        config: configSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

      const eksisterende = await ctx.prismaTimer.eksportOppsett.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!eksisterende) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Malen finnes ikke" });
      }
      // Personlig mal: kun eieren. Firmamal (eierId=null): firma-admin, allerede verifisert.
      if (eksisterende.eierId !== null && eksisterende.eierId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Personlig mal kan kun endres av eieren",
        });
      }

      return ctx.prismaTimer.eksportOppsett.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          // Skriver vi config, er den v2-formen → bump configVersion samtidig.
          ...(input.config !== undefined
            ? { config: input.config, configVersion: CONFIG_VERSION }
            : {}),
        },
      });
    }),

  /**
   * Slett en mal. Samme eierskapssjekk som oppdater. Ved sletting av en FIRMAMAL
   * nulles `basertPaId` på personlige kopier som pekte hit (SetNull-semantikk
   * håndhevet i app-laget) — kopiene lever videre uendret. Alt i én transaksjon.
   */
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid(), organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

      const eksisterende = await ctx.prismaTimer.eksportOppsett.findFirst({
        where: { id: input.id, organizationId: orgId },
      });
      if (!eksisterende) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Malen finnes ikke" });
      }
      if (eksisterende.eierId !== null && eksisterende.eierId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Personlig mal kan kun slettes av eieren",
        });
      }

      await ctx.prismaTimer.$transaction([
        // SetNull: personlige kopier basert på denne firmamalen mister bindeleddet,
        // men beholder sin egen (frosne) config. No-op for en personlig mal.
        ctx.prismaTimer.eksportOppsett.updateMany({
          where: { basertPaId: input.id },
          data: { basertPaId: null },
        }),
        ctx.prismaTimer.eksportOppsett.delete({ where: { id: input.id } }),
      ]);

      return { slettet: true as const };
    }),
});
