import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc/trpc";
import { prisma } from "@sitedoc/db";
import { autoriserAdminForFirma, krevErKundeFirma } from "../../trpc/tilgangskontroll";
import {
  beregnFilHash,
  parseSmartDokXlsx,
  type ParsetMaskinRad,
} from "../../utils/maskinImport";
import { krevMaskinAktivert } from "../../services/maskin";

/**
 * SmartDok maskin-import.
 *
 * To-stegs flyt:
 *   1. importerForhandsvisning — parse + matching-rapport (ingen skriving)
 *   2. importerBekreft         — atomisk import (Equipment + EquipmentAnsvarlig + VegvesenKo prio 200)
 *
 * Filtreringer (per docs/claude/maskin.md):
 *   - Internnummer = "x"          → testdata, filtreres helt
 *   - 0XXX-placeholder            → internNummer settes null
 *   - Type-godkjenningsnumre      → filtreres av erGyldigRegnummer (fra parser)
 *   - Umatcha ansvarlig           → null + advarsel i rapport (IKKE blokker)
 *
 * Vegvesen-prio 200 = lav prioritet (lavere enn 100=auto). Worker plukker
 * én om gangen via 60s-polling — naturlig spredning over tid.
 */

const VEGVESEN_PRIO_SMARTDOK_IMPORT = 200;

// Steg 1b Fase C — orgId er påkrevd. Klienten må sende `valgtFirma.id`.
async function verifiserFirmaAdmin(userId: string, inputOrgId: string): Promise<string> {
  await autoriserAdminForFirma(userId, inputOrgId);
  await krevErKundeFirma(inputOrgId);
  return inputOrgId;
}

/**
 * Match klartekst-navn (f.eks. «Afrim Qefalia») mot User.name i org.
 * Case-insensitive eksakt-match. Returnerer Map<navn-lowercase → userId>.
 */
async function matchAnsvarlige(
  orgId: string,
  klartekstNavn: string[],
): Promise<Map<string, string>> {
  if (klartekstNavn.length === 0) return new Map();
  const lowercased = klartekstNavn.map((n) => n.toLowerCase());

  // Hent alle brukere i firmaet og match case-insensitive i JS (Postgres
  // `mode: insensitive` på `in` er ikke støttet — enklere å gjøre lokalt).
  const brukere = await prisma.user.findMany({
    where: { organizationId: orgId, name: { not: null } },
    select: { id: true, name: true },
  });

  const map = new Map<string, string>();
  for (const b of brukere) {
    if (!b.name) continue;
    const lc = b.name.toLowerCase();
    if (lowercased.includes(lc)) {
      map.set(lc, b.id);
    }
  }
  return map;
}

const filInputSchema = z.object({
  filInnhold: z.string().max(10_000_000), // base64 ~7MB rå = ~10MB base64
  organizationId: z.string().uuid(),
});

export const importRouter = router({
  importerForhandsvisning: protectedProcedure
    .input(filInputSchema)
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await krevMaskinAktivert(orgId);

      const buffer = Buffer.from(input.filInnhold, "base64");
      if (buffer.length > 5_242_880) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Filen er over 5 MB",
        });
      }

      const filHash = beregnFilHash(buffer);
      const parseresultat = await parseSmartDokXlsx(buffer);

      const ansvarligNavn = [
        ...new Set(
          parseresultat.rader.flatMap((r) =>
            [r.ansvarlig1Navn, r.ansvarlig2Navn].filter(
              (n): n is string => !!n && n.trim().length > 0,
            ),
          ),
        ),
      ];
      const ansvarligMap = await matchAnsvarlige(orgId, ansvarligNavn);
      const matchaAnsvarlige = ansvarligNavn.filter((n) =>
        ansvarligMap.has(n.toLowerCase()),
      );
      const umatchaAnsvarlige = ansvarligNavn.filter(
        (n) => !ansvarligMap.has(n.toLowerCase()),
      );

      // Duplikat-sjekk: DB-eksisterende internnummer + fil-interne duplikater
      const internnumre = parseresultat.rader
        .map((r) => r.internnummer)
        .filter((n): n is string => !!n);
      const eksisterende =
        internnumre.length === 0
          ? []
          : await ctx.prismaMaskin.equipment.findMany({
              where: {
                organizationId: orgId,
                internNummer: { in: internnumre },
              },
              select: { internNummer: true },
            });
      const dbDupSett = new Set(
        eksisterende
          .map((e) => e.internNummer)
          .filter((n): n is string => !!n),
      );

      // Tell forekomster av hvert internnummer i fila for å oppdage interne duplikater
      const internTellinger = new Map<string, number>();
      for (const r of parseresultat.rader) {
        if (r.internnummer) {
          internTellinger.set(r.internnummer, (internTellinger.get(r.internnummer) ?? 0) + 1);
        }
      }
      const internDupSett = new Set(
        [...internTellinger.entries()]
          .filter(([, n]) => n > 1)
          .map(([k]) => k),
      );

      // Aggregat
      const fordeling = {
        kjoretoy: 0,
        anleggsmaskin: 0,
        smautstyr: 0,
      };
      let medRegnummer = 0;
      let leid = 0;
      let duplikaterDB = 0;
      let duplikaterFilInterne = 0;
      const seenIFil = new Set<string>();
      for (const r of parseresultat.rader) {
        fordeling[r.kategori]++;
        if (r.harGyldigRegnummer) medRegnummer++;
        if (r.eierskap === "leid") leid++;
        if (r.internnummer && dbDupSett.has(r.internnummer)) duplikaterDB++;
        if (r.internnummer && seenIFil.has(r.internnummer)) duplikaterFilInterne++;
        if (r.internnummer) seenIFil.add(r.internnummer);
      }
      const duplikater = duplikaterDB + duplikaterFilInterne;

      return {
        filHash,
        totaltIFil: parseresultat.rader.length + parseresultat.filtrerte.length,
        importerbart: parseresultat.rader.length,
        duplikater,
        duplikaterDB,
        duplikaterFilInterne,
        filtrerte: parseresultat.filtrerte,
        fordeling,
        medRegnummer,
        leid,
        ansvarligeMatcha: matchaAnsvarlige,
        ansvarligeUmatcha: umatchaAnsvarlige,
        valideringsfeil: parseresultat.valideringsfeil,
        forhåndsvisning: parseresultat.rader.slice(0, 25).map((r) => ({
          radnummer: r.radnummer,
          navn: r.navn,
          internnummer: r.internnummer,
          regnummer: r.regnummer,
          kategori: r.kategori,
          eierskap: r.eierskap,
          aarsmodell: r.aarsmodell,
          ansvarlig1Navn: r.ansvarlig1Navn,
          ansvarlig2Navn: r.ansvarlig2Navn,
          ansvarlig1Match: r.ansvarlig1Navn
            ? ansvarligMap.has(r.ansvarlig1Navn.toLowerCase())
            : null,
          ansvarlig2Match: r.ansvarlig2Navn
            ? ansvarligMap.has(r.ansvarlig2Navn.toLowerCase())
            : null,
          erDuplikat:
            r.internnummer
              ? dbDupSett.has(r.internnummer) || internDupSett.has(r.internnummer)
              : false,
        })),
      };
    }),

  importerBekreft: protectedProcedure
    .input(
      filInputSchema.extend({
        filHash: z.string().length(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await krevMaskinAktivert(orgId);

      const buffer = Buffer.from(input.filInnhold, "base64");
      if (buffer.length > 5_242_880) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Filen er over 5 MB",
        });
      }

      const beregnetHash = beregnFilHash(buffer);
      if (beregnetHash !== input.filHash) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Fil-innholdet stemmer ikke med forhåndsvisningen. Last opp filen på nytt.",
        });
      }

      const parseresultat = await parseSmartDokXlsx(buffer);
      if (parseresultat.valideringsfeil.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Valideringsfeil: ${parseresultat.valideringsfeil.join("; ")}`,
        });
      }

      // Match ansvarlige (umatcha → null + advarsel, ikke blokker)
      const ansvarligNavn = [
        ...new Set(
          parseresultat.rader.flatMap((r) =>
            [r.ansvarlig1Navn, r.ansvarlig2Navn].filter(
              (n): n is string => !!n && n.trim().length > 0,
            ),
          ),
        ),
      ];
      const ansvarligMap = await matchAnsvarlige(orgId, ansvarligNavn);
      const umatcha = ansvarligNavn.filter(
        (n) => !ansvarligMap.has(n.toLowerCase()),
      );

      // Duplikat-sjekk #1: eksisterende internnumre i firmaet
      const internnumre = parseresultat.rader
        .map((r) => r.internnummer)
        .filter((n): n is string => !!n);
      const eksisterende =
        internnumre.length === 0
          ? []
          : await ctx.prismaMaskin.equipment.findMany({
              where: {
                organizationId: orgId,
                internNummer: { in: internnumre },
              },
              select: { internNummer: true },
            });
      const dbDupSett = new Set(
        eksisterende
          .map((e) => e.internNummer)
          .filter((n): n is string => !!n),
      );

      // Filtrer ut DB-duplikater OG fil-interne duplikater FØR transaksjon.
      // Fil-internt: første forekomst importeres, etterfølgende hoppes over.
      // Forhindrer unique-constraint-brudd på (organizationId, internNummer)
      // som ville rullet tilbake hele transaksjonen.
      const hoppetOver: Array<{ navn: string; grunn: string }> = [];
      const tilOpprettelse: typeof parseresultat.rader = [];
      const settInternIFil = new Set<string>();
      for (const rad of parseresultat.rader) {
        if (rad.internnummer && dbDupSett.has(rad.internnummer)) {
          hoppetOver.push({
            navn: rad.navn,
            grunn: `Internnummer ${rad.internnummer} finnes allerede i firmaet`,
          });
          continue;
        }
        if (rad.internnummer && settInternIFil.has(rad.internnummer)) {
          hoppetOver.push({
            navn: rad.navn,
            grunn: `Internnummer ${rad.internnummer} duplisert i fila`,
          });
          continue;
        }
        if (rad.internnummer) settInternIFil.add(rad.internnummer);
        tilOpprettelse.push(rad);
      }

      // Atomisk transaksjon — Equipment + EquipmentAnsvarlig + VegvesenKo
      const opprettet: Array<{ id: string; navn: string; kategori: string }> = [];
      let vegvesenKølagt = 0;

      await ctx.prismaMaskin.$transaction(
        async (tx) => {
          for (const rad of tilOpprettelse) {
            const ansvarlig1Id = rad.ansvarlig1Navn
              ? ansvarligMap.get(rad.ansvarlig1Navn.toLowerCase()) ?? null
              : null;
            const ansvarlig2Id = rad.ansvarlig2Navn
              ? ansvarligMap.get(rad.ansvarlig2Navn.toLowerCase()) ?? null
              : null;

            const data = byggEquipmentData(rad, orgId, ansvarlig1Id);

            const eq = await tx.equipment.create({ data, select: { id: true } });

            if (ansvarlig2Id && ansvarlig2Id !== ansvarlig1Id) {
              await tx.equipmentAnsvarlig.create({
                data: {
                  equipmentId: eq.id,
                  userId: ansvarlig2Id,
                  opprettetAvUserId: ctx.userId ?? null,
                },
              });
            }

            if (rad.harGyldigRegnummer && rad.regnummer) {
              await tx.vegvesenKo.create({
                data: {
                  equipmentId: eq.id,
                  registreringsnummer: rad.regnummer,
                  prioritet: VEGVESEN_PRIO_SMARTDOK_IMPORT,
                  status: "ventende",
                },
              });
              vegvesenKølagt++;
            }

            opprettet.push({ id: eq.id, navn: rad.navn, kategori: rad.kategori });
          }
        },
        { timeout: 120_000 }, // 2 min for 126 rader
      );

      return {
        opprettet: opprettet.length,
        hoppetOver,
        vegvesenKølagt,
        umatchaAnsvarlige: umatcha,
        filtrerte: parseresultat.filtrerte.length,
      };
    }),
});

/**
 * Bygg Prisma-create-data for én Equipment-rad. Mapper Timetall→driftstimer
 * (anleggsmaskin) eller Km.stand→kmStand (kjøretøy). Småutstyr får begge i null
 * fordi schema ikke har brukstime-felt for den kategorien.
 */
function byggEquipmentData(
  rad: ParsetMaskinRad,
  orgId: string,
  ansvarligUserId: string | null,
) {
  const base = {
    organizationId: orgId,
    kategori: rad.kategori,
    type: rad.kategori === "kjoretoy"
      ? "Kjøretøy"
      : rad.kategori === "anleggsmaskin"
        ? "Anleggsmaskin"
        : "Småutstyr",
    internNavn: rad.navn,
    internNummer: rad.internnummer,
    ansvarligUserId,
    eierskap: rad.eierskap,
    aarsmodell: rad.aarsmodell,
    lokasjon: rad.lokasjon,
    notater: rad.notat,
    status: "tilgjengelig",
    registreringsnummer: rad.regnummer,
  };

  if (rad.kategori === "kjoretoy") {
    return { ...base, kmStand: rad.kmStand };
  }
  if (rad.kategori === "anleggsmaskin") {
    return { ...base, driftstimer: rad.timetall };
  }
  return base;
}
