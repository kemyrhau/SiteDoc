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
import {
  byggDetaljRader,
  grupperDetaljRader,
  ALLE_RADTYPER,
  type DetaljRadType,
  type Gruppering,
} from "@sitedoc/shared";
import { esc, byggTimerRapportHtml, type TimerRapportData } from "@sitedoc/pdf";
import { router, protectedProcedure } from "../../trpc/trpc";
import { autoriserAdminForFirma } from "../../trpc/tilgangskontroll";
import { krevTimerAktivert } from "../../services/timer";
import { renderPdfViaContainer } from "../../services/pdf-render-klient";

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

// Alle synlige PDF-overskrifter/etiketter injiseres oversatt fra klienten
// (api har ingen server-i18n; samme mønster som arkiv-PDF). Speiler
// TimerRapportTekster i @sitedoc/pdf — typecheck fanger avvik ved bruk.
const teksterSchema = z.object({
  dokumentTittel: z.string(),
  periode: z.string(),
  prosjekt: z.string(),
  ansatt: z.string(),
  alle: z.string(),
  ingenData: z.string(),
  sum: z.string(),
  // Sammendrag
  sammendrag: z.string(),
  kolAnsattnr: z.string(),
  kolTotalTimer: z.string(),
  kolSedler: z.string(),
  kolSistRegistrert: z.string(),
  kolKladd: z.string(),
  kolSent: z.string(),
  kolAttestert: z.string(),
  // Detaljer (merged Type-tabell, fase 2)
  detaljer: z.string(),
  subtotal: z.string(), // gruppe-subtotal-etikett (fase 4)
  kolDato: z.string(),
  kolType: z.string(),
  kolBetegnelse: z.string(),
  kolAktivitet: z.string(),
  kolFra: z.string(),
  kolTil: z.string(),
  kolTimer: z.string(),
  kolMaskintimer: z.string(),
  kolAntall: z.string(),
  kolBelop: z.string(),
  kolMengde: z.string(),
  kolEnhet: z.string(),
  kolBeskrivelse: z.string(),
  kolStatus: z.string(),
  typeTimer: z.string(),
  typeMaskin: z.string(),
  typeTillegg: z.string(),
  typeUtlegg: z.string(),
  maskinUtenTimerad: z.string(),
  maskinIkkeEksporterbar: z.string(),
  // Status-VERDIENE oversatt (rå DB-koder som pending/sent er ikke norsk).
  // Map verdi→etikett; ukjent verdi faller tilbake til rå streng i renderer.
  statusEtiketter: z.record(z.string()),
});

export const rapportRouter = router({
  /**
   * Hovedrapport: aggregerer timer per ansatt + per prosjekt for perioden.
   * Inkluderer kladd/sent/attestert i samme returstruktur — leder filtrerer
   * i UI ved behov.
   */
  firmaPeriodeRapport: protectedProcedure
    // kunEksporterbare: eksport-veien (aggregat-arkene) setter den → time-summene
    // ekskluderer lønnsarter med skalEksporteres=false, så aggregatet matcher
    // detalj-arkene (ingen «to sannheter»). SKJERMEN kaller uten flagget = alle
    // timer (attestering/oversikt trenger å se alt). Ordren gjelder eksporter.
    .input(periodeSchema.extend({ kunEksporterbare: z.boolean().optional() }))
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
      // 🔴 Prosjektfilter på RAD-nivå (2026-08-27): `some` under velger sedler som
      // HAR minst én rad på det filtrerte prosjektet; include-en må så filtrere
      // radene, ellers drar en Fjordgata-seddel med seg Olas Sentrumsparken-rader
      // (samme seddel, annet prosjekt) → summen lekker på tvers av prosjekter.
      // KUN når prosjektId er satt: uten filter er `prosjektIder` hele firmaet, og
      // rader kan bevisst peke på prosjekt UTENFOR firmaet (kryss-prosjekt, se
      // detaljEksport) — et ubetinget `in: prosjektIder` ville stille droppe dem.
      const radProsjektFilter = input.prosjektId ? { projectId: input.prosjektId } : {};
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
          // lonnsart.skalEksporteres for kunEksporterbare-filteret (time-summen).
          // where på rad-nivå: kun det filtrerte prosjektets rader (tomt = alle).
          timer: {
            where: radProsjektFilter,
            include: { lonnsart: { select: { skalEksporteres: true } } },
          },
          tillegg: { where: radProsjektFilter },
          maskiner: { where: radProsjektFilter },
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
          // Eksport-veien: hopp over lønnsarter merket skalEksporteres=false, så
          // aggregatets time-sum matcher detalj-arkene. Sedel-metadata
          // (statusFordeling/antallSedler/sistRegistrert) filtreres IKKE — en
          // sedel med kun ikke-eksporterbare timer er fortsatt en reell sedel.
          if (input.kunEksporterbare && t.lonnsart?.skalEksporteres === false) {
            continue;
          }
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
        return {
          timerader: [],
          maskinUtenTimerad: [],
          maskinIkkeEksporterbar: [],
          tillegg: [],
          utlegg: [],
        };
      }

      // 🔴 Prosjektfilter på RAD-nivå (2026-08-27) — samme lekkasje som
      // firmaPeriodeRapport: `some` velger sedelen, include-en må filtrere radene,
      // ellers går rader fra andre prosjekter på samme seddel ut i eksporten (og
      // ut av huset i et fakturagrunnlag). KUN når prosjektId er satt (kryss-
      // prosjekt-rader utenfor firmaet skal ikke stille droppes uten filter).
      const radProsjektFilter = input.prosjektId ? { projectId: input.prosjektId } : {};
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
            // skalEksporteres=false → timeraden utelates fra eksport (fabel-
            // vedtak). Filtreres i KODE (ikke DB-where) fordi maskin-rader som
            // henger på en ekskludert timerad skal klassifiseres separat — vi
            // trenger å vite HVILKE timerad-id-er som ble ekskludert.
            where: { attestertStatus: { not: "erstattet" }, ...radProsjektFilter },
            include: {
              lonnsart: { select: { navn: true, skalEksporteres: true } },
              aktivitet: { select: { navn: true } },
            },
          },
          tillegg: {
            where: {
              attestertStatus: { not: "erstattet" },
              tillegg: { skalEksporteres: true },
              ...radProsjektFilter,
            },
            include: { tillegg: { select: { navn: true } } },
          },
          maskiner: { where: { attestertStatus: { not: "erstattet" }, ...radProsjektFilter } },
          // SheetUtlegg har ingen attestertStatus → intet erstattet-filter.
          // Bredere select enn attesterings-lista (kommentar med for eksport-ark),
          // men fortsatt IKKE vedlegg (svak FK uten @relation → umulig via query).
          utlegg: {
            where: radProsjektFilter,
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

      // skalEksporteres-filter i kode: false → timeraden ut av eksporten.
      const eksporterbar = (r: { lonnsart: { skalEksporteres: boolean } | null }): boolean =>
        r.lonnsart?.skalEksporteres !== false;

      const timerader = sedler.flatMap((s) =>
        s.timer.filter(eksporterbar).map((r) => ({
          id: r.id,
          dato: iso(s.dato),
          ansatt: ansatt(s.userId),
          ansattnr: ansattnummerMap.get(s.userId) ?? null,
          prosjekt: prosjektNavn(r.projectId),
          lonnsart: r.lonnsart?.navn ?? "(ukjent)",
          aktivitet: r.aktivitet?.navn ?? "(ukjent)",
          // T.4 per-rad klokkeslett "HH:MM" (kun timer-rader har det).
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          timer: Number(r.timer),
          beskrivelse: r.beskrivelse,
          // T.3: RAD-status (attestertStatus), ikke sedel-status. Lønn spør om
          // raden er attestert; en sedel kan stå "sent" mens enkeltrader er
          // returnert. null → "pending" (Prisma-default).
          radstatus: r.attestertStatus ?? "pending",
          // Nøsting: maskin-rader ført med DENNE (eksporterbare) timeraden.
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

      // Maskin-linje (felles form for de to «løse» bøttene).
      const maskinLinje = (
        s: (typeof sedler)[number],
        m: (typeof sedler)[number]["maskiner"][number],
      ) => ({
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
      });

      // Maskin-klassifisering i to «løse» bøtter (nøstede ligger i timerader):
      //  - på en timerad som ble EKSKLUDERT av skalEksporteres → egen linje.
      //    IKKE «uten timerad»: den bøtta betyr «maskin brukt uten registrert
      //    arbeid» (et anomali-signal noen skal reagere på). Filtrerte-timerad-
      //    maskiner ville drukne signalet. Maskintimene beholdes (fakturerbart —
      //    maskin er ikke en lønnsart).
      //  - uten gyldig sheetTimerId-kobling → ekte «uten timerad».
      const maskinIkkeEksporterbar: ReturnType<typeof maskinLinje>[] = [];
      const maskinUtenTimerad: ReturnType<typeof maskinLinje>[] = [];
      for (const s of sedler) {
        const eksporterbareIder = new Set(
          s.timer.filter(eksporterbar).map((r) => r.id),
        );
        const ekskluderteIder = new Set(
          s.timer.filter((r) => !eksporterbar(r)).map((r) => r.id),
        );
        for (const m of s.maskiner) {
          if (m.sheetTimerId && eksporterbareIder.has(m.sheetTimerId)) continue; // nøstet
          if (m.sheetTimerId && ekskluderteIder.has(m.sheetTimerId)) {
            maskinIkkeEksporterbar.push(maskinLinje(s, m));
          } else {
            maskinUtenTimerad.push(maskinLinje(s, m));
          }
        }
      }

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

      return { timerader, maskinUtenTimerad, maskinIkkeEksporterbar, tillegg, utlegg };
    }),

  /**
   * PDF-eksport (fase 1): dokument-versjon av rapporten — samme innhold som
   * Excel, formatert som et dokument som kan sendes ut av huset. Ny mal på den
   * eksisterende HTML→PDF-motoren (pdf-render-containeren).
   *
   * DATA-GJENBRUK: kaller firmaPeriodeRapport (aggregat, kunEksporterbare) +
   * detaljEksport (detalj) via createCaller — samme raduttrekk som CSV/Excel,
   * ingen fjerde data-vei som kan drive fra hverandre. Overskrifter injiseres
   * oversatt fra klienten (ingen server-i18n). ID-kolonner utelates bevisst.
   *
   * 🔴 BETINGELSE (Kenneth 2026-08-26): to konsumenter tåler createCaller-mønsteret.
   * Dukker en TREDJE opp som trenger samme aggregat/detalj, EKSTRAHER data-
   * byggingen til delte funksjoner — tre call-sites begynner å skjule hvor
   * sannheten bor.
   */
  pdfEksport: protectedProcedure
    .input(
      periodeSchema.extend({
        firmanavn: z.string(),
        filnavn: z.string(),
        footerGenerert: z.string(),
        footerSide: z.string(),
        footerAv: z.string(),
        // Radvalg fra Tilpasset-modalen — hvilke radtyper som skal med (fase 2).
        // Utelatt/tom → alle fire (samme som de direkte format-knappene = full).
        radTyper: z
          .array(z.enum(["timer", "maskin", "tillegg", "utlegg"]))
          .min(1)
          .optional(),
        // Fase 4 (config v2). Utelatt → v1-default: intern · ingen · auto · ingen topptekst.
        mottaker: z.enum(["intern", "ekstern"]).optional(),
        gruppering: z.enum(["ingen", "ansatt", "prosjekt"]).optional(),
        orientering: z.enum(["auto", "staaende", "liggende"]).optional(),
        // Rå topptekst-linjer med flettefelt {firma}/{periode}/{prosjekt} — flettes
        // server-side fra rapportfilteret (én sannhet). Tom/utelatt → standard firmatopp.
        topptekstLinjer: z.array(z.string()).optional(),
        tekster: teksterSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const orgId = await verifiserFirmaAdmin(ctx.userId, input.organizationId);
      await krevTimerAktivert(orgId);

      const filtre = {
        organizationId: input.organizationId,
        fra: input.fra,
        til: input.til,
        prosjektId: input.prosjektId,
        ansattId: input.ansattId,
      };
      const caller = rapportRouter.createCaller(ctx);
      const aggregat = await caller.firmaPeriodeRapport({ ...filtre, kunEksporterbare: true });
      const detalj = await caller.detaljEksport(filtre);

      const prosjektFilter = input.prosjektId
        ? (aggregat.prosjekter.find((p) => p.id === input.prosjektId)?.navn ?? null)
        : null;
      const ansattFilter = input.ansattId
        ? (aggregat.ansatte.find((a) => a.userId === input.ansattId)?.navn ??
            aggregat.ansatte.find((a) => a.userId === input.ansattId)?.email ??
            null)
        : null;

      // Ett kronologisk radsett med Type-kolonne (fase 2), filtrert på radvalget.
      // SAMME @sitedoc/shared-bygger som Excel-arket → identisk radsett/rekkefølge.
      // Grupperingen (fase 4) PAKKER radsettet — rører det aldri (designlås 2).
      // ID-feltet slippes her (aldri i PDF — koblingsnøkkel for DB).
      const valgteRadTyper: readonly DetaljRadType[] = input.radTyper ?? ALLE_RADTYPER;
      const mottaker = input.mottaker ?? "intern";
      const gruppering: Gruppering = input.gruppering ?? "ingen";
      const flateRader = byggDetaljRader(detalj, valgteRadTyper);
      const grupper = grupperDetaljRader(flateRader, gruppering).map((g) => ({
        overskrift: g.overskrift,
        subtotal: g.subtotal,
        rader: g.rader.map((r) => ({
          type: r.type,
          nivaa: r.nivaa,
          dato: r.dato,
          ansatt: r.ansatt,
          ansattnr: r.ansattnr,
          prosjekt: r.prosjekt,
          betegnelse: r.betegnelse,
          aktivitet: r.aktivitet,
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          timer: r.timer,
          maskintimer: r.maskintimer,
          antall: r.antall,
          belop: r.belop,
          mengde: r.mengde,
          enhet: r.enhet,
          beskrivelse: r.beskrivelse,
          status: r.status,
          maskinMerke: r.maskinMerke,
        })),
      }));

      // Format=auto (designlås 3): liggende når beskrivelse-kolonnen faktisk er med
      // i PDF (noen valgt rad har beskrivelse), ellers stående. Eksplisitt valg låser.
      const beskrivelseMed = flateRader.some(
        (r) => r.beskrivelse !== null && r.beskrivelse !== "",
      );
      const orientering = input.orientering ?? "auto";
      const liggende =
        orientering === "liggende" || (orientering === "auto" && beskrivelseMed);

      // Topptekst (designlås 4): flett {firma}/{periode}/{prosjekt} fra filteret.
      // Appen spør aldri om noe den vet — det variable kommer fra rapportfilteret.
      const flettefelt: Record<string, string> = {
        "{firma}": input.firmanavn,
        "{periode}": `${input.fra}–${input.til}`,
        "{prosjekt}": prosjektFilter ?? input.tekster.alle,
      };
      const topptekstLinjer = (input.topptekstLinjer ?? [])
        .map((l) => l.replace(/\{firma\}|\{periode\}|\{prosjekt\}/g, (m) => flettefelt[m] ?? m))
        .filter((l) => l.trim().length > 0);

      const data: TimerRapportData = {
        firmanavn: input.firmanavn,
        fra: input.fra,
        til: input.til,
        prosjektFilter,
        ansattFilter,
        mottaker,
        topptekstLinjer,
        ansatte: aggregat.ansatte.map((a) => ({
          navn: a.navn ?? a.email,
          ansattnr: a.ansattnummer,
          totalTimer: a.totalTimer,
          antallSedler: a.antallSedler,
          sistRegistrert: a.sistRegistrert
            ? a.sistRegistrert.toISOString().slice(0, 10)
            : null,
          kladd: a.statusFordeling.kladd,
          sent: a.statusFordeling.sent,
          attestert: a.statusFordeling.attestert,
        })),
        grupper,
      };

      const html = byggTimerRapportHtml(data, input.tekster);

      // Margin-header (alle sider, kan ikke slås av per side): firmanavn +
      // periode så flersides-dokument er identifiserbart. Footer: generert-
      // stempel + Chromium-injiserte sidetall. Inline-stilt (margin arver ingen CSS).
      const stil = "font-family:Arial,Helvetica,sans-serif;font-size:7px;color:#6b7280";
      const header = `<div style="width:100%;box-sizing:border-box;padding:0 16mm;${stil};text-align:right">${esc(input.firmanavn)} · ${esc(input.fra)}–${esc(input.til)}</div>`;
      const footer = `<div style="width:100%;box-sizing:border-box;padding:0 16mm;${stil};display:flex;justify-content:space-between"><span>${esc(input.footerGenerert)}</span><span>${esc(input.footerSide)} <span class="pageNumber"></span> ${esc(input.footerAv)} <span class="totalPages"></span></span></div>`;

      const { pdf } = await renderPdfViaContainer(html, header, footer, liggende);
      return { pdf: pdf.toString("base64"), filnavn: input.filnavn };
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
