import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc/trpc";
import { prisma } from "@sitedoc/db";
import { hentBrukersOrg } from "../../trpc/tilgangskontroll";
import { beregnNesteService } from "../../services/maskin";
import {
  byggServiceRapportHtml,
  esc,
  type ServiceRapportData,
  type ServiceRapportRad,
} from "@sitedoc/pdf";
import { renderPdfViaContainer } from "../../services/pdf-render-klient";

/**
 * Service-router (kundeønske #1, 2026-09-18) — skriveveien til ServiceRecord.
 *
 * Dette er ankeret: uten en skrivevei er ServiceRecord tom uansett hvor mye UI
 * som peker på den. registrerService oppretter en record og framskriver neste
 * service (del C): neste = driftstimer ved service + intervall. Fremskrivingen
 * skrives til BÅDE record (historikk) og equipment (gjeldende, denormalisert for
 * terskelvarselet). Avlest driftstimer bumpes på equipment — det er en fersk
 * manuell avlesning et menneske taster inn ved service (Kenneth 2026-09-18).
 */

const SERVICE_TYPER = [
  "service",
  "repair",
  "inspection",
  "eu_kontroll",
  "dekk",
  "olje",
] as const;

// Gjenbruker mønsteret fra equipment.ts: sitedoc_admin slipper forbi org-grensa.
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

export const serviceRouter = router({
  // Servicelogg for én maskin — nyeste først (servicelogg-visning + PDF).
  listForEquipment: protectedProcedure
    .input(z.object({ equipmentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const utstyr = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.equipmentId },
        select: { organizationId: true },
      });
      if (!utstyr) throw new TRPCError({ code: "NOT_FOUND" });
      await verifiserMaskinTilgang(ctx.userId, utstyr.organizationId);

      return ctx.prismaMaskin.serviceRecord.findMany({
        where: { equipmentId: input.equipmentId },
        orderBy: [{ dato: "desc" }, { createdAt: "desc" }],
      });
    }),

  // Registrer utført service (del B) + fremskriving (del C).
  registrerService: protectedProcedure
    .input(
      z.object({
        equipmentId: z.string().uuid(),
        dato: z.string(), // YYYY-MM-DD
        timer: z.number().int().min(0).nullable().optional(), // driftstimer ved service
        km: z.number().int().min(0).nullable().optional(),
        type: z.enum(SERVICE_TYPER).default("service"),
        beskrivelse: z.string().min(1).max(5000),
        utfortAv: z.string().max(500).nullable().optional(),
        kostnad: z.number().min(0).nullable().optional(),
        feilmeldingId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const utstyr = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.equipmentId },
        select: {
          organizationId: true,
          driftstimer: true,
          serviceIntervallTimer: true,
        },
      });
      if (!utstyr) throw new TRPCError({ code: "NOT_FOUND" });
      await verifiserMaskinTilgang(ctx.userId, utstyr.organizationId);

      const timerVedService = input.timer ?? null;

      // Del C — fremskriving. Krever både avlest driftstimer og et intervall.
      const nesteServiceTimer =
        timerVedService != null
          ? beregnNesteService(timerVedService, utstyr.serviceIntervallTimer)
          : null;

      const record = await ctx.prismaMaskin.serviceRecord.create({
        data: {
          equipmentId: input.equipmentId,
          type: input.type,
          dato: new Date(input.dato),
          timer: timerVedService,
          km: input.km ?? null,
          beskrivelse: input.beskrivelse,
          utfortAv: input.utfortAv ?? null,
          kostnad: input.kostnad ?? null,
          nesteServiceTimer,
          feilmeldingId: input.feilmeldingId ?? null,
          registrertAvUserId: ctx.userId,
        },
      });

      // Oppdater equipment: gjeldende terskel (denormalisert for banneret) +
      // bump driftstimer til avlest verdi (fersk manuell avlesning).
      const equipmentData: {
        nesteServiceTimer?: number;
        driftstimer?: number;
      } = {};
      if (nesteServiceTimer != null) equipmentData.nesteServiceTimer = nesteServiceTimer;
      if (
        timerVedService != null &&
        (utstyr.driftstimer == null || timerVedService >= utstyr.driftstimer)
      ) {
        equipmentData.driftstimer = timerVedService;
      }
      if (Object.keys(equipmentData).length > 0) {
        await ctx.prismaMaskin.equipment.update({
          where: { id: input.equipmentId },
          data: equipmentData,
        });
      }

      // Lukk åpen feilmelding hvis servicen refererer den (samme mønster som
      // Feilmelding.lukketAv = "service_record").
      if (input.feilmeldingId) {
        await ctx.prismaMaskin.feilmelding.updateMany({
          where: { id: input.feilmeldingId, status: "aapen" },
          data: {
            status: "lukket",
            lukketAv: "service_record",
            lukketDato: new Date(),
            lukketAvUserId: ctx.userId,
          },
        });
      }

      return record;
    }),

  // PDF-utskrift av servicelogg for én maskin. Bygger HTML via @sitedoc/pdf og
  // rendrer i pdf-render-containeren — samme mønster som timer.rapport.pdfEksport.
  // Overskrifter + filnavn injiseres oversatt fra klienten (ingen server-i18n).
  pdfEksport: protectedProcedure
    .input(
      z.object({
        equipmentId: z.string().uuid(),
        filnavn: z.string(),
        generertDato: z.string(),
        tekster: z.object({
          dokumentTittel: z.string(),
          maskin: z.string(),
          ident: z.string(),
          serviceIntervall: z.string(),
          nesteService: z.string(),
          gjeldendeDriftstimer: z.string(),
          timerEnhet: z.string(),
          servicelogg: z.string(),
          kolDato: z.string(),
          kolType: z.string(),
          kolDriftstimer: z.string(),
          kolKm: z.string(),
          kolBeskrivelse: z.string(),
          kolUtfortAv: z.string(),
          kolKostnad: z.string(),
          ingenData: z.string(),
          ikkeSatt: z.string(),
          generert: z.string(),
        }),
        // Oversatte type-etiketter (service/repair/...) fra klienten.
        typeEtiketter: z.record(z.string()),
        // Firmanavn + kostnad-suffiks (valuta) fra klienten (locale eies der).
        firmanavn: z.string(),
        kostnadSuffiks: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const utstyr = await ctx.prismaMaskin.equipment.findUnique({
        where: { id: input.equipmentId },
      });
      if (!utstyr) throw new TRPCError({ code: "NOT_FOUND" });
      await verifiserMaskinTilgang(ctx.userId, utstyr.organizationId);

      const records = await ctx.prismaMaskin.serviceRecord.findMany({
        where: { equipmentId: input.equipmentId },
        orderBy: [{ dato: "desc" }, { createdAt: "desc" }],
      });

      const maskinNavn =
        [utstyr.merke, utstyr.modell].filter(Boolean).join(" ") ||
        utstyr.internNavn ||
        utstyr.type;
      const maskinIdent =
        utstyr.internNummer ?? utstyr.registreringsnummer ?? utstyr.serienummer ?? null;

      const rader: ServiceRapportRad[] = records.map((r) => ({
        dato: r.dato.toISOString().slice(0, 10),
        type: input.typeEtiketter[r.type] ?? r.type,
        driftstimer: r.timer,
        km: r.km,
        beskrivelse: r.beskrivelse,
        utfortAv: r.utfortAv,
        kostnad: r.kostnad != null ? `${r.kostnad.toString()} ${input.kostnadSuffiks}` : null,
      }));

      const data: ServiceRapportData = {
        firmanavn: input.firmanavn,
        maskinNavn,
        maskinIdent,
        serviceIntervallTimer: utstyr.serviceIntervallTimer,
        nesteServiceTimer: utstyr.nesteServiceTimer,
        driftstimer: utstyr.driftstimer,
        rader,
        generertDato: input.generertDato,
      };

      const html = byggServiceRapportHtml(data, input.tekster);
      const stil = "font-family:Arial,Helvetica,sans-serif;font-size:7px;color:#6b7280";
      const header = `<div style="width:100%;box-sizing:border-box;padding:0 16mm;${stil};text-align:right">${esc(input.firmanavn)} · ${esc(maskinNavn)}</div>`;
      const footer = `<div style="width:100%;box-sizing:border-box;padding:0 16mm;${stil};display:flex;justify-content:flex-end"><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`;

      const { pdf } = await renderPdfViaContainer(html, header, footer, false);
      return { pdf: pdf.toString("base64"), filnavn: input.filnavn };
    }),
});
