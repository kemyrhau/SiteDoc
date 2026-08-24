/**
 * U1 — Leder-timer-rapport på firmanivå.
 *
 * Aggregerer DailySheet/SheetTimer/SheetTillegg/SheetMachine på tvers av
 * firmaets prosjekter for en gitt periode. Brukes av firma-admin for
 * lønnskjøring og oversikt.
 *
 * Alle endepunkter gates med `autoriserAdminForFirma` (sitedoc_admin →
 * enhver org; company_admin → kun egen org).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../../trpc/trpc";
import { autoriserAdminForFirma } from "../../trpc/tilgangskontroll";
import { krevTimerAktivert } from "../../services/timer";

async function verifiserFirmaAdmin(
  userId: string,
  inputOrgId: string,
): Promise<string> {
  await autoriserAdminForFirma(userId, inputOrgId);
  return inputOrgId;
}

const periodeSchema = z.object({
  organizationId: z.string().uuid(),
  fra: z.string(), // ISO date YYYY-MM-DD
  til: z.string(),
  prosjektId: z.string().uuid().optional(),
  ansattId: z.string().uuid().optional(),
});

export const rapportRouter = router({
  /**
   * Hovedrapport: aggregerer timer per ansatt + per prosjekt for perioden.
   * Inkluderer kladd/sent/attestert i samme returstruktur — leder filtrerer
   * i UI ved behov.
   */
  firmaPeriodeRapport: protectedProcedure
    .input(periodeSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await krevTimerAktivert(orgId);

      const fraDato = new Date(input.fra);
      const tilDato = new Date(input.til);
      if (Number.isNaN(fraDato.getTime()) || Number.isNaN(tilDato.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ugyldig dato-format (forventet YYYY-MM-DD)",
        });
      }

      // Hent firmaets prosjekt-IDer (DailySheet har svak FK til Project)
      const prosjekter = await prisma.project.findMany({
        where: {
          primaryOrganizationId: orgId,
          ...(input.prosjektId ? { id: input.prosjektId } : {}),
        },
        select: { id: true, name: true, projectNumber: true, internalProjectNumber: true },
      });
      const prosjektIder = prosjekter.map((p) => p.id);
      const prosjektMap = new Map(prosjekter.map((p) => [p.id, p]));

      if (prosjektIder.length === 0) {
        return {
          ansatte: [],
          prosjekter: [],
          totalTimer: 0,
          antallSedler: 0,
          statusFordeling: { kladd: 0, sent: 0, attestert: 0 },
        };
      }

      // Hent dagseddel-rader i perioden for firmaets prosjekter.
      // T.1 (2026-05-11): DailySheet har ikke projectId — filtrer via SheetTimer-join.
      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where: {
          // Fase 1b: firma-isolasjon — kun sedler EID av firmaet (SHA-modell:
          // hvert firma rapporterer egne timer, aldri prosjekteiers). Lukker
          // cross-firma-lekkasje på delte prosjekter. Cross-org-invitert
          // arbeiders sedel (annet org) ekskluderes bevisst.
          organizationId: orgId,
          timer: { some: { projectId: { in: prosjektIder } } },
          dato: { gte: fraDato, lte: tilDato },
          ...(input.ansattId ? { userId: input.ansattId } : {}),
        },
        include: {
          timer: true,
          tillegg: true,
          maskiner: true,
        },
        orderBy: [{ dato: "asc" }, { createdAt: "asc" }],
      });

      // Berik med ansatt-data fra kjerne-DB
      const userIder = Array.from(new Set(sedler.map((s) => s.userId)));
      const brukere = await prisma.user.findMany({
        where: { id: { in: userIder } },
        select: { id: true, name: true, email: true },
      });
      const brukerMap = new Map(brukere.map((b) => [b.id, b]));
      const medlemmer = await prisma.organizationMember.findMany({
        where: { userId: { in: userIder } },
        select: { userId: true, ansattnummer: true },
      });
      const ansattnummerMap = new Map(medlemmer.map((m) => [m.userId, m.ansattnummer]));

      // Aggregér per ansatt
      type AnsattAggregat = {
        userId: string;
        navn: string | null;
        email: string;
        ansattnummer: string | null;
        totalTimer: number;
        perProsjekt: Map<string, number>; // prosjektId → timer
        perDag: Map<string, number>; // YYYY-MM-DD → timer
        statusFordeling: { kladd: number; sent: number; attestert: number };
        antallSedler: number;
        sistRegistrert: Date | null;
      };

      const ansattMap = new Map<string, AnsattAggregat>();
      let totalTimer = 0;
      const statusFordeling = { kladd: 0, sent: 0, attestert: 0 };

      for (const sedel of sedler) {
        const bruker = brukerMap.get(sedel.userId);
        if (!ansattMap.has(sedel.userId)) {
          ansattMap.set(sedel.userId, {
            userId: sedel.userId,
            navn: bruker?.name ?? null,
            email: bruker?.email ?? "(ukjent)",
            ansattnummer: ansattnummerMap.get(sedel.userId) ?? null,
            totalTimer: 0,
            perProsjekt: new Map(),
            perDag: new Map(),
            statusFordeling: { kladd: 0, sent: 0, attestert: 0 },
            antallSedler: 0,
            sistRegistrert: null,
          });
        }
        const a = ansattMap.get(sedel.userId)!;

        // T.1: Aggregér per timer-rad (rad har projectId, ikke sedelen).
        // Hver SheetTimer-rad kan ha forskjellig projectId — splitt mellom dem.
        let sedelTimer = 0;
        for (const t of sedel.timer) {
          const radTimer = Number(t.timer);
          sedelTimer += radTimer;
          a.perProsjekt.set(
            t.projectId,
            (a.perProsjekt.get(t.projectId) ?? 0) + radTimer,
          );
        }
        a.totalTimer += sedelTimer;
        totalTimer += sedelTimer;

        const datoNok = sedel.dato.toISOString().slice(0, 10);
        a.perDag.set(datoNok, (a.perDag.get(datoNok) ?? 0) + sedelTimer);

        const status =
          sedel.status === "kladd"
            ? "kladd"
            : sedel.status === "sent"
              ? "sent"
              : "attestert";
        a.statusFordeling[status] += 1;
        statusFordeling[status] += 1;

        a.antallSedler += 1;
        if (!a.sistRegistrert || sedel.dato > a.sistRegistrert) {
          a.sistRegistrert = sedel.dato;
        }
      }

      // Konverter Map → Array for serialisering
      const ansatte = Array.from(ansattMap.values()).map((a) => ({
        userId: a.userId,
        navn: a.navn,
        email: a.email,
        ansattnummer: a.ansattnummer,
        totalTimer: a.totalTimer,
        antallSedler: a.antallSedler,
        sistRegistrert: a.sistRegistrert,
        statusFordeling: a.statusFordeling,
        perProsjekt: Array.from(a.perProsjekt.entries()).map(([pid, timer]) => ({
          prosjektId: pid,
          prosjektNavn: prosjektMap.get(pid)?.name ?? "(ukjent)",
          // SD (prosjektNummer) beholdes for Excel-eksport (stabil, unik nøkkel
          // til regnskap). Internt vises brukervendt. Beslutning 3 + terminologi.md.
          prosjektNummer: prosjektMap.get(pid)?.projectNumber ?? null,
          internProsjektNummer: prosjektMap.get(pid)?.internalProjectNumber ?? null,
          timer,
        })),
        perDag: Array.from(a.perDag.entries())
          .sort(([a1], [b1]) => a1.localeCompare(b1))
          .map(([dato, timer]) => ({ dato, timer })),
      }));

      ansatte.sort((a, b) => b.totalTimer - a.totalTimer);

      return {
        ansatte,
        prosjekter: prosjekter.map((p) => ({
          id: p.id,
          navn: p.name,
          nummer: p.projectNumber,
        })),
        totalTimer,
        antallSedler: sedler.length,
        statusFordeling,
      };
    }),

  /**
   * Detaljeksport: RÅ timer-/tillegg-/utlegg-rader for perioden — grunnlaget
   * lønn/fakturering trenger, som aggregatet i firmaPeriodeRapport ikke gir.
   *
   * BEVISST egen prosedyre (ikke ombygging av firmaPeriodeRapport): skjerm-
   * rapporten aggregerer med groupBy for rask visning, detaljeksporten drar
   * hver rad. Samme payload til begge ville gitt treg skjerm ELLER amputert
   * eksport. SAMME filtre (periode/prosjekt/ansatt), kalt KUN ved eksport-klikk.
   *
   * Nøsting: maskin-rader bæres under sin timerad via SheetMachine.sheetTimerId
   * (samme som dagskort-hoveren). Klienten flater ut til ark-rader.
   *
   * Fremtid (proadm-underprosjekt): gruppering er datadrevet i klientens
   * kolonne-spec — en ny dimensjon = én kolonne (feltet legges på radene her)
   * + ett filter (utvid periodeSchema + where under). Ikke bygget nå.
   */
  detaljEksport: protectedProcedure
    .input(periodeSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await krevTimerAktivert(orgId);

      const fraDato = new Date(input.fra);
      const tilDato = new Date(input.til);
      if (Number.isNaN(fraDato.getTime()) || Number.isNaN(tilDato.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ugyldig dato-format (forventet YYYY-MM-DD)",
        });
      }

      const prosjekter = await prisma.project.findMany({
        where: {
          primaryOrganizationId: orgId,
          ...(input.prosjektId ? { id: input.prosjektId } : {}),
        },
        select: { id: true, name: true, projectNumber: true, internalProjectNumber: true },
      });
      const prosjektIder = prosjekter.map((p) => p.id);
      const prosjektMap = new Map(prosjekter.map((p) => [p.id, p]));

      if (prosjektIder.length === 0) {
        return { timerader: [], maskinUtenTimerad: [], tillegg: [], utlegg: [] };
      }

      const sedler = await ctx.prismaTimer.dailySheet.findMany({
        where: {
          organizationId: orgId,
          timer: { some: { projectId: { in: prosjektIder } } },
          dato: { gte: fraDato, lte: tilDato },
          ...(input.ansattId ? { userId: input.ansattId } : {}),
        },
        include: {
          // erstattet-filter: audit-rader fra rediger-mutasjoner ekskluderes
          // (samme som hentTilAttesteringFirma). Navnene inkluderes per rad via
          // de faktiske @relation-ene på SheetTimer.
          timer: {
            where: { attestertStatus: { not: "erstattet" } },
            include: {
              lonnsart: { select: { navn: true } },
              aktivitet: { select: { navn: true } },
            },
          },
          tillegg: {
            where: { attestertStatus: { not: "erstattet" } },
            include: { tillegg: { select: { navn: true } } },
          },
          maskiner: { where: { attestertStatus: { not: "erstattet" } } },
          // SheetUtlegg har ingen attestertStatus → intet erstattet-filter.
          // Bredere select enn attesterings-lista (kommentar med for eksport-ark),
          // men fortsatt IKKE vedlegg (svak FK uten @relation → umulig via query).
          utlegg: {
            select: {
              id: true,
              belop: true,
              kommentar: true,
              projectId: true,
              expenseCategory: { select: { navn: true } },
            },
          },
        },
        orderBy: [{ dato: "asc" }, { createdAt: "asc" }],
      });

      // Ansatt-navn + ansattnummer (org-scopet, som hentTilAttesteringFirma).
      const userIder = Array.from(new Set(sedler.map((s) => s.userId)));
      const brukere = await prisma.user.findMany({
        where: { id: { in: userIder } },
        select: { id: true, name: true, email: true },
      });
      const brukerMap = new Map(brukere.map((b) => [b.id, b]));
      const medlemmer = await prisma.organizationMember.findMany({
        where: { userId: { in: userIder }, organizationId: orgId },
        select: { userId: true, ansattnummer: true },
      });
      const ansattnummerMap = new Map(medlemmer.map((m) => [m.userId, m.ansattnummer]));

      // Kryss-prosjekt: rader kan peke på prosjekt utenfor firmaets egne — samle
      // alle unike projectId og slå opp navn for dem også (ellers «ukjent»).
      const alleProsjektIder = new Set<string>(prosjektIder);
      for (const s of sedler) {
        for (const r of s.timer) alleProsjektIder.add(r.projectId);
        for (const r of s.tillegg) alleProsjektIder.add(r.projectId);
        for (const r of s.maskiner) alleProsjektIder.add(r.projectId);
        for (const r of s.utlegg) alleProsjektIder.add(r.projectId);
      }
      const ekstraIder = Array.from(alleProsjektIder).filter((id) => !prosjektMap.has(id));
      if (ekstraIder.length > 0) {
        const ekstra = await prisma.project.findMany({
          where: { id: { in: ekstraIder } },
          select: { id: true, name: true, projectNumber: true, internalProjectNumber: true },
        });
        for (const p of ekstra) prosjektMap.set(p.id, p);
      }
      const prosjektNavn = (id: string): string => prosjektMap.get(id)?.name ?? "(ukjent)";

      // Maskin-navn (kryss-modul → db-maskin). Samme navn-form som dagskortet.
      const vehicleIder = Array.from(
        new Set(sedler.flatMap((s) => s.maskiner.map((m) => m.vehicleId))),
      );
      const utstyrMap = new Map<string, string>();
      if (vehicleIder.length > 0) {
        const utstyr = await ctx.prismaMaskin.equipment.findMany({
          where: { id: { in: vehicleIder } },
          select: { id: true, merke: true, modell: true, internNavn: true },
        });
        for (const e of utstyr) {
          const base = `${e.merke ?? ""} ${e.modell ?? ""}`.trim();
          utstyrMap.set(e.id, base || e.internNavn || e.id);
        }
      }

      const iso = (d: Date): string => d.toISOString().slice(0, 10);
      const ansatt = (userId: string): string =>
        brukerMap.get(userId)?.name ?? brukerMap.get(userId)?.email ?? "(ukjent)";

      const timerader = sedler.flatMap((s) =>
        s.timer.map((r) => ({
          id: r.id,
          dato: iso(s.dato),
          ansatt: ansatt(s.userId),
          ansattnr: ansattnummerMap.get(s.userId) ?? null,
          prosjekt: prosjektNavn(r.projectId),
          lonnsart: r.lonnsart?.navn ?? "(ukjent)",
          aktivitet: r.aktivitet?.navn ?? "(ukjent)",
          timer: Number(r.timer),
          beskrivelse: r.beskrivelse,
          // T.3: RAD-status (attestertStatus), ikke sedel-status. Lønn spør om
          // raden er attestert; en sedel kan stå "sent" mens enkeltrader er
          // returnert. null → "pending" (Prisma-default).
          radstatus: r.attestertStatus ?? "pending",
          // Nøsting: maskin-rader ført med DENNE timeraden (sheetTimerId === r.id).
          maskiner: s.maskiner
            .filter((m) => m.sheetTimerId === r.id)
            .map((m) => ({
              id: m.id,
              navn: utstyrMap.get(m.vehicleId) ?? m.vehicleId,
              // Maskintimer = egen størrelse (attesteringsflaten summerer den
              // separat), egen kolonne i eksporten — aldri i timer-kolonnen.
              timer: Number(m.timer),
              mengde: m.mengde === null ? null : Number(m.mengde),
              enhet: m.enhet,
              radstatus: m.attestertStatus ?? "pending",
            })),
        })),
      );

      // Maskin-rader UTEN gyldig sheetTimerId-kobling — vis ærlig, ikke skjul
      // (samme prinsipp som dagskortets «Maskin uten timerad»).
      const timerIderPerSedel = new Map(
        sedler.map((s) => [s.id, new Set(s.timer.map((r) => r.id))]),
      );
      const maskinUtenTimerad = sedler.flatMap((s) =>
        s.maskiner
          .filter(
            (m) => !m.sheetTimerId || !timerIderPerSedel.get(s.id)?.has(m.sheetTimerId),
          )
          .map((m) => ({
            id: m.id,
            dato: iso(s.dato),
            ansatt: ansatt(s.userId),
            ansattnr: ansattnummerMap.get(s.userId) ?? null,
            prosjekt: prosjektNavn(m.projectId),
            navn: utstyrMap.get(m.vehicleId) ?? m.vehicleId,
            timer: Number(m.timer),
            mengde: m.mengde === null ? null : Number(m.mengde),
            enhet: m.enhet,
            radstatus: m.attestertStatus ?? "pending",
          })),
      );

      const tillegg = sedler.flatMap((s) =>
        s.tillegg.map((r) => ({
          id: r.id,
          dato: iso(s.dato),
          ansatt: ansatt(s.userId),
          ansattnr: ansattnummerMap.get(s.userId) ?? null,
          prosjekt: prosjektNavn(r.projectId),
          tillegg: r.tillegg?.navn ?? "(ukjent)",
          antall: Number(r.antall),
          kommentar: r.kommentar,
          // T.3 rad-status (som timerader).
          radstatus: r.attestertStatus ?? "pending",
        })),
      );

      const utlegg = sedler.flatMap((s) =>
        s.utlegg.map((r) => ({
          id: r.id,
          dato: iso(s.dato),
          ansatt: ansatt(s.userId),
          ansattnr: ansattnummerMap.get(s.userId) ?? null,
          prosjekt: prosjektNavn(r.projectId),
          kategori: r.expenseCategory?.navn ?? "(ukjent)",
          belop: r.belop === null ? null : Number(r.belop),
          kommentar: r.kommentar,
          // SheetUtlegg har INGEN rad-status → sedel-status (kolonnen heter
          // «Seddelstatus» på utlegg-arket, ikke «Radstatus» — ulik betydning).
          seddelstatus: s.status,
        })),
      );

      return { timerader, maskinUtenTimerad, tillegg, utlegg };
    }),

  /**
   * Liste over firmaets prosjekter med eksisterende timer-data.
   * Brukes til prosjekt-filter-dropdown i rapport-UI.
   */
  hentFirmaProsjekterMedTimer: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

      const prosjekter = await prisma.project.findMany({
        where: { primaryOrganizationId: orgId },
        select: { id: true, name: true, projectNumber: true },
        orderBy: { name: "asc" },
      });
      if (prosjekter.length === 0) return [];

      const prosjektIder = prosjekter.map((p) => p.id);
      // T.1 (2026-05-11): DailySheet har ikke projectId — bruk SheetTimer.
      const medTimer = await ctx.prismaTimer.sheetTimer.groupBy({
        by: ["projectId"],
        where: { projectId: { in: prosjektIder } },
        _count: { _all: true },
      });
      const prosjektIdSett = new Set(medTimer.map((m) => m.projectId));

      return prosjekter
        .filter((p) => prosjektIdSett.has(p.id))
        .map((p) => ({
          id: p.id,
          navn: p.name,
          nummer: p.projectNumber,
        }));
    }),

  /**
   * Liste over ansatte i firmaet med registrerte timer.
   * Brukes til ansatt-filter-dropdown.
   */
  hentFirmaAnsatteMedTimer: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);

      const prosjekter = await prisma.project.findMany({
        where: { primaryOrganizationId: orgId },
        select: { id: true },
      });
      const prosjektIder = prosjekter.map((p) => p.id);
      if (prosjektIder.length === 0) return [];

      // T.1 (2026-05-11): DailySheet har ikke projectId — filtrer via SheetTimer.
      const sedler = await ctx.prismaTimer.dailySheet.groupBy({
        by: ["userId"],
        where: { timer: { some: { projectId: { in: prosjektIder } } } },
        _count: { _all: true },
      });
      const userIder = sedler.map((s) => s.userId);
      if (userIder.length === 0) return [];

      const brukere = await prisma.user.findMany({
        where: { id: { in: userIder } },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      });
      const medlemmer = await prisma.organizationMember.findMany({
        where: { userId: { in: userIder } },
        select: { userId: true, ansattnummer: true },
      });
      const ansattnummerMap = new Map(medlemmer.map((m) => [m.userId, m.ansattnummer]));
      return brukere.map((b) => ({
        ...b,
        ansattnummer: ansattnummerMap.get(b.id) ?? null,
      }));
    }),
});
