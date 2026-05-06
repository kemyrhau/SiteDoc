import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { prisma } from "@sitedoc/db";
import { autoriserAdminForFirma } from "../trpc/tilgangskontroll";
import {
  krevVarelagerAktivert,
  VarelagerModulIkkeAktivertError,
} from "../services/varelager/moduleGate";
import {
  beregnFilHash,
  parseSmartDokVarerXml,
  type ParsetVareRad,
  type UtelattRad,
} from "../utils/vareforbrukImport";

/**
 * SmartDok varekatalog-import (Steg 4b — Fase 5).
 *
 * To-stegs flyt:
 *   1. importerForhandsvisning — parse + duplikat-rapport (ingen skriving)
 *   2. importerBekreft         — atomisk import: VareKategori-rader først,
 *                                så Vare-rader med kategoriId-FK satt.
 *
 * Filtreringer (per docs/claude/steg-4b-plan.md § 7):
 *   - Navn = "."                  → utelates (ugyldig)
 *   - Kategori = "Utleie Heatwork" → utelates (oppretes manuelt som Equipment)
 *   - Pris = 0                    → importeres som null (SmartDok bruker 0 = "ikke satt")
 *   - Internkostnad tom           → null
 *
 * Unique-constraint på (organizationId, navn, enhet) gjør at samme produkt
 * med to enheter (eks. Pukk 0-120 m³ + Pukk 0-120 Tonn) er to separate Vare-rader.
 */

async function verifiserFirmaAdminOgVarelager(
  userId: string,
  organizationId: string,
): Promise<void> {
  await autoriserAdminForFirma(userId, organizationId);
  try {
    await krevVarelagerAktivert(organizationId);
  } catch (e) {
    if (e instanceof VarelagerModulIkkeAktivertError) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Varelager-modulen er ikke aktivert for dette firmaet",
      });
    }
    throw e;
  }
}

const filInputSchema = z.object({
  filInnhold: z.string().max(10_000_000), // ~10 MB UTF-8 XML
  organizationId: z.string().uuid(),
});

type Forhåndsvisningsrad = {
  radnummer: number;
  navn: string;
  varenummer: string | null;
  kategori: string;
  enhet: string;
  enhetRaw: string;
  pris: number | null;
  erDuplikat: boolean;
  duplikatGrunn: string | null;
};

type DuplikatNøkkel = string; // `${navn-lower}|${enhet}`

function lagDuplikatNøkkel(navn: string, enhet: string): DuplikatNøkkel {
  return `${navn.trim().toLowerCase()}|${enhet}`;
}

export const vareImportRouter = router({
  importerForhandsvisning: protectedProcedure
    .input(filInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserFirmaAdminOgVarelager(ctx.userId, input.organizationId);

      if (input.filInnhold.length > 5_242_880) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Filen er over 5 MB",
        });
      }

      const parseresultat = parseSmartDokVarerXml(input.filInnhold);
      if (
        parseresultat.valideringsfeil.length > 0 &&
        parseresultat.rader.length === 0
      ) {
        return {
          filhash: parseresultat.filhash,
          totaltIFil:
            parseresultat.rader.length + parseresultat.utelatte.length,
          importerbart: 0,
          utelatte: parseresultat.utelatte,
          kategorier: [],
          eksisterendeKategorier: [],
          nyeKategorier: [],
          duplikaterIDB: 0,
          duplikaterIFil: 0,
          valideringsfeil: parseresultat.valideringsfeil,
          forhåndsvisning: [],
        };
      }

      // Hent eksisterende kategorier i firmaet
      const eksisterendeKat = await ctx.prismaVarelager.vareKategori.findMany({
        where: { organizationId: input.organizationId },
        select: { id: true, navn: true },
      });
      const katNavnSett = new Set(
        eksisterendeKat.map((k) => k.navn.trim().toLowerCase()),
      );
      const eksisterendeKategorier = parseresultat.kategorier.filter((k) =>
        katNavnSett.has(k.trim().toLowerCase()),
      );
      const nyeKategorier = parseresultat.kategorier.filter(
        (k) => !katNavnSett.has(k.trim().toLowerCase()),
      );

      // Hent eksisterende varer på (navn-lower, enhet) for duplikat-sjekk
      const eksisterendeVarer = await ctx.prismaVarelager.vare.findMany({
        where: { organizationId: input.organizationId },
        select: { navn: true, enhet: true },
      });
      const dbDupSett = new Set(
        eksisterendeVarer.map((v) => lagDuplikatNøkkel(v.navn, v.enhet)),
      );

      // Fil-interne duplikater (samme navn + enhet i to rader)
      const filTellinger = new Map<DuplikatNøkkel, number>();
      for (const r of parseresultat.rader) {
        const k = lagDuplikatNøkkel(r.navn, r.enhet);
        filTellinger.set(k, (filTellinger.get(k) ?? 0) + 1);
      }

      let duplikaterIDB = 0;
      let duplikaterIFil = 0;
      const seenIFil = new Set<DuplikatNøkkel>();
      const forhåndsvisning: Forhåndsvisningsrad[] = parseresultat.rader.map(
        (r) => {
          const k = lagDuplikatNøkkel(r.navn, r.enhet);
          const dbDup = dbDupSett.has(k);
          const filDup = (filTellinger.get(k) ?? 0) > 1;
          if (dbDup) duplikaterIDB += 1;
          if (filDup && seenIFil.has(k)) duplikaterIFil += 1;
          seenIFil.add(k);
          return {
            radnummer: r.radnummer,
            navn: r.navn,
            varenummer: r.varenummer,
            kategori: r.kategori,
            enhet: r.enhet,
            enhetRaw: r.enhetRaw,
            pris: r.pris,
            erDuplikat: dbDup || filDup,
            duplikatGrunn: dbDup
              ? "finnes allerede i firmaet"
              : filDup
                ? "duplikat i filen"
                : null,
          };
        },
      );

      const importerbart =
        parseresultat.rader.length - duplikaterIDB - duplikaterIFil;

      return {
        filhash: parseresultat.filhash,
        totaltIFil:
          parseresultat.rader.length + parseresultat.utelatte.length,
        importerbart,
        utelatte: parseresultat.utelatte,
        kategorier: parseresultat.kategorier,
        eksisterendeKategorier,
        nyeKategorier,
        duplikaterIDB,
        duplikaterIFil,
        valideringsfeil: parseresultat.valideringsfeil,
        forhåndsvisning,
      };
    }),

  importerBekreft: protectedProcedure
    .input(filInputSchema.extend({ filhash: z.string().length(64) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await verifiserFirmaAdminOgVarelager(ctx.userId, input.organizationId);

      if (input.filInnhold.length > 5_242_880) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Filen er over 5 MB",
        });
      }

      const beregnetHash = beregnFilHash(input.filInnhold);
      if (beregnetHash !== input.filhash) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Fil-innholdet stemmer ikke med forhåndsvisningen. Last opp filen på nytt.",
        });
      }

      const parseresultat = parseSmartDokVarerXml(input.filInnhold);
      if (parseresultat.valideringsfeil.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Valideringsfeil: ${parseresultat.valideringsfeil.join("; ")}`,
        });
      }

      // Hent eksisterende kategorier + varer for duplikat-håndtering
      const eksisterendeKat = await ctx.prismaVarelager.vareKategori.findMany({
        where: { organizationId: input.organizationId },
        select: { id: true, navn: true },
      });
      const katNavnTilId = new Map<string, string>();
      for (const k of eksisterendeKat) {
        katNavnTilId.set(k.navn.trim().toLowerCase(), k.id);
      }

      const eksisterendeVarer = await ctx.prismaVarelager.vare.findMany({
        where: { organizationId: input.organizationId },
        select: { navn: true, enhet: true },
      });
      const dbDupSett = new Set(
        eksisterendeVarer.map((v) => lagDuplikatNøkkel(v.navn, v.enhet)),
      );

      // Filtrer rader: hopp over DB-duplikater + fil-interne duplikater
      // (første forekomst importeres, etterfølgende hoppes over).
      const hoppetOver: Array<{ navn: string; grunn: string }> = [];
      const tilOpprettelse: ParsetVareRad[] = [];
      const seenIFil = new Set<DuplikatNøkkel>();
      for (const rad of parseresultat.rader) {
        const k = lagDuplikatNøkkel(rad.navn, rad.enhet);
        if (dbDupSett.has(k)) {
          hoppetOver.push({
            navn: `${rad.navn} (${rad.enhet})`,
            grunn: "finnes allerede i firmaet",
          });
          continue;
        }
        if (seenIFil.has(k)) {
          hoppetOver.push({
            navn: `${rad.navn} (${rad.enhet})`,
            grunn: "duplikat i filen",
          });
          continue;
        }
        seenIFil.add(k);
        tilOpprettelse.push(rad);
      }

      // Atomisk: seed kategorier først (Beslutning 8), deretter varer
      const opprettedeKategorier: Array<{ id: string; navn: string }> = [];
      const opprettedeVarer: Array<{ id: string; navn: string }> = [];

      await ctx.prismaVarelager.$transaction(async (tx) => {
        // Steg 1 — kategori-seeding
        for (const katNavn of parseresultat.kategorier) {
          const lc = katNavn.trim().toLowerCase();
          if (katNavnTilId.has(lc)) continue;
          const ny = await tx.vareKategori.create({
            data: {
              organizationId: input.organizationId,
              navn: katNavn.trim(),
            },
            select: { id: true, navn: true },
          });
          katNavnTilId.set(lc, ny.id);
          opprettedeKategorier.push(ny);
        }

        // Steg 2 — vare-opprettelse med kategoriId
        for (const rad of tilOpprettelse) {
          const kategoriId = katNavnTilId.get(rad.kategori.trim().toLowerCase());
          const v = await tx.vare.create({
            data: {
              organizationId: input.organizationId,
              navn: rad.navn,
              varenummer: rad.varenummer,
              enhet: rad.enhet,
              pris: rad.pris,
              internkostnad: rad.internkostnad,
              kategoriId: kategoriId ?? null,
            },
            select: { id: true, navn: true },
          });
          opprettedeVarer.push(v);
        }
      });

      // Activity-log (best-effort, én samlet rad)
      try {
        await prisma.activity.create({
          data: {
            actorUserId: ctx.userId,
            organizationId: input.organizationId,
            targetType: "vare_import",
            targetId: input.filhash,
            action: "vare.smartdok-importert",
            payload: {
              filhash: input.filhash,
              opprettedeVarer: opprettedeVarer.length,
              opprettedeKategorier: opprettedeKategorier.length,
              hoppetOver: hoppetOver.length,
              utelatte: parseresultat.utelatte.length,
            },
          },
        });
      } catch {
        // Ikke-blokkerende
      }

      const heatworkUtelatt: UtelattRad[] = parseresultat.utelatte.filter(
        (u) => u.grunn === "heatwork-utleie",
      );

      return {
        opprettedeVarer: opprettedeVarer.length,
        opprettedeKategorier: opprettedeKategorier.length,
        hoppetOver,
        utelatte: parseresultat.utelatte.length,
        heatworkUtelatt,
        filhash: input.filhash,
      };
    }),
});
