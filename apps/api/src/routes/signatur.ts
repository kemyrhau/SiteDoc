import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem, erHmsAdmin } from "../trpc/tilgangskontroll";
import { beregnSignaturStatus } from "@sitedoc/shared";
import type { PrismaClient } from "@sitedoc/db";

/**
 * Signaturliste (SJA/HMS-runder) — «hvem har signert, hvem mangler».
 * Fabel-ordre 2026-09-06. Speiler psi.ts (hentSignaturer/hentMinStatus): snapshot
 * ved «Avslutt runde» framfor live-oppslag, rundenummer ER versjonen.
 *
 * Modellen keyer til DOKUMENTET (checklistId XOR taskId). MalBygger håndhever én
 * signaturliste pr. mal, så «én pr. dokument» er sikret i UI — routeren jobber
 * derfor på dokument-nivå.
 */

// Dokument-referanse: nøyaktig én av checklistId/taskId (XOR — speiler DB-guarden).
const dokumentRef = z
  .object({
    checklistId: z.string().uuid().optional(),
    taskId: z.string().uuid().optional(),
  })
  .refine((d) => !!d.checklistId !== !!d.taskId, {
    message: "Oppgi nøyaktig én av checklistId/taskId",
  });

type DokumentRef = { checklistId?: string; taskId?: string };

/** Prisma-filter for runde/deltaker-tabellene fra en dokument-referanse. */
function refFilter(ref: DokumentRef): { checklistId: string } | { taskId: string } {
  return ref.checklistId ? { checklistId: ref.checklistId } : { taskId: ref.taskId! };
}

/**
 * Utled projectId + bestiller (ansvarlig-kandidat) fra dokumentet. SJA er
 * Checklist, avvik/RUH er Task — begge henter prosjekt via malen (ingen egen
 * projectId-kolonne). Task uten mal er ugyldig for signaturliste.
 */
async function hentDokumentKontekst(
  prisma: PrismaClient,
  ref: DokumentRef,
): Promise<{ projectId: string; bestillerUserId: string; innholdsVersjon: number }> {
  if (ref.checklistId) {
    const c = await prisma.checklist.findUniqueOrThrow({
      where: { id: ref.checklistId },
      select: { bestillerUserId: true, innholdsVersjon: true, template: { select: { projectId: true } } },
    });
    return { projectId: c.template.projectId, bestillerUserId: c.bestillerUserId, innholdsVersjon: c.innholdsVersjon };
  }
  const t = await prisma.task.findUniqueOrThrow({
    where: { id: ref.taskId! },
    select: { bestillerUserId: true, innholdsVersjon: true, template: { select: { projectId: true } } },
  });
  if (!t.template) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Oppgaven mangler mal — kan ikke ha signaturliste",
    });
  }
  return { projectId: t.template.projectId, bestillerUserId: t.bestillerUserId, innholdsVersjon: t.innholdsVersjon };
}

/**
 * Nyeste endringslogg-tidspunkt for dokumentet — «før endring <dato>» henter datoen
 * herfra (read-only; rører verken loggens generering eller visning). null = ingen
 * loggrader ennå (da vises amber-raden uten dato).
 */
async function hentInnholdEndretAt(prisma: PrismaClient, ref: DokumentRef): Promise<Date | null> {
  const rad = ref.checklistId
    ? await prisma.checklistChangeLog.findFirst({
        where: { checklistId: ref.checklistId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
    : await prisma.taskChangeLog.findFirst({
        where: { taskId: ref.taskId! },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
  return rad?.createdAt ?? null;
}

/**
 * Ansvarlig for signaturlista = SJA-ens oppretter (bestiller), HMS-admin eller
 * sitedoc_admin. Gater runde- og deltakerhåndtering («kun ansvarlig»).
 */
async function erAnsvarlig(
  prisma: PrismaClient,
  userId: string,
  projectId: string,
  bestillerUserId: string,
): Promise<boolean> {
  if (bestillerUserId === userId) return true;
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (bruker?.role === "sitedoc_admin") return true;
  return erHmsAdmin(userId, projectId);
}

async function krevAnsvarlig(
  prisma: PrismaClient,
  userId: string,
  projectId: string,
  bestillerUserId: string,
): Promise<void> {
  if (!(await erAnsvarlig(prisma, userId, projectId, bestillerUserId))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Kun ansvarlig kan endre signaturrundene",
    });
  }
}

const hmsKortSchema = z.string().regex(/^\d{7}$/, "HMS-kortnummer må være 7 siffer");

const deltakerVisning = {
  id: true,
  userId: true,
  guestName: true,
  guestCompany: true,
  guestPhone: true,
  lagtTilAt: true,
  fjernetAt: true,
  user: { select: { name: true } },
} as const;

export const signaturRouter = router({
  /**
   * Full runde-/deltaker-tilstand for objekt-renderer (web + mobil) og PDF.
   * Én query gir alt: aktive deltakere, alle runder med signatursett, gjeldende
   * status (X av Y) og om innlogget bruker er ansvarlig / har egen deltaker-rad.
   */
  hentRunder: protectedProcedure
    .input(dokumentRef)
    .query(async ({ ctx, input }) => {
      const { projectId, bestillerUserId, innholdsVersjon } = await hentDokumentKontekst(ctx.prisma, input);
      await verifiserProsjektmedlem(ctx.userId, projectId);
      const filter = refFilter(input);

      const [deltakere, runder, ansvarlig, innholdEndretAt] = await Promise.all([
        ctx.prisma.dokumentDeltaker.findMany({
          where: filter,
          select: deltakerVisning,
          orderBy: { lagtTilAt: "asc" },
        }),
        ctx.prisma.signaturRunde.findMany({
          where: filter,
          orderBy: { rundeNr: "asc" },
          select: {
            id: true,
            rundeNr: true,
            startetAt: true,
            startetAv: true,
            avsluttetAt: true,
            avsluttetAv: true,
            aarsak: true,
            antallDeltakere: true,
            signaturer: {
              select: {
                id: true,
                deltakerId: true,
                hmsKortNr: true,
                harIkkeHmsKort: true,
                signaturbilde: true,
                completedAt: true,
                signertTidspunkt: true,
                signertVersjon: true,
                nySignaturKrevdAt: true,
                nySignaturKrevdAv: true,
                bekreftetAvUserId: true,
              },
            },
          },
        }),
        erAnsvarlig(ctx.prisma, ctx.userId, projectId, bestillerUserId),
        hentInnholdEndretAt(ctx.prisma, input),
      ]);

      const aktiveDeltakere = deltakere.filter((d) => d.fjernetAt === null);
      const gjeldende = runder.length > 0 ? runder[runder.length - 1] : null;
      // Tellende attestasjoner = de som IKKE er krevd ny (krevd-ny er flyttet til
      // manko). 🔴 Signert (egen rad) og bekreftet (gjest bekreftet av ansvarlig)
      // holdes fra hverandre — de blandes aldri i dokumentet.
      const tellende = gjeldende?.signaturer.filter((s) => s.nySignaturKrevdAt === null) ?? [];
      const antallFørEndring = tellende.filter((s) => s.signertVersjon < innholdsVersjon).length;
      const status = beregnSignaturStatus(
        gjeldende
          ? {
              rundeNr: gjeldende.rundeNr,
              avsluttet: gjeldende.avsluttetAt !== null,
              antallSignert: tellende.filter((s) => !s.bekreftetAvUserId).length,
              antallBekreftet: tellende.filter((s) => s.bekreftetAvUserId).length,
              antallSignertFørEndring: antallFørEndring,
              antallDeltakere: gjeldende.antallDeltakere,
            }
          : null,
        aktiveDeltakere.length,
      );

      const minDeltaker = aktiveDeltakere.find((d) => d.userId === ctx.userId);

      // Løs opp navn for «Krev ny signatur»-sporet OG «bekreftet av <navn>» (gjest
      // bekreftet av ansvarlig) — ett samlet oppslag.
      const bekreftIder = [
        ...new Set(
          runder.flatMap((r) =>
            r.signaturer.flatMap((s) => [s.nySignaturKrevdAv, s.bekreftetAvUserId].filter((x): x is string => !!x)),
          ),
        ),
      ];
      const brukerNavn = new Map<string, string>();
      if (bekreftIder.length > 0) {
        const brukere = await ctx.prisma.user.findMany({
          where: { id: { in: bekreftIder } },
          select: { id: true, name: true },
        });
        for (const u of brukere) brukerNavn.set(u.id, u.name ?? "Ukjent");
      }

      return {
        deltakere: deltakere.map((d) => ({
          id: d.id,
          userId: d.userId,
          navn: d.user?.name ?? d.guestName ?? "Ukjent",
          firma: d.guestCompany ?? null,
          telefon: d.guestPhone ?? null,
          erGjest: !d.userId,
          aktiv: d.fjernetAt === null,
          lagtTilAt: d.lagtTilAt,
          fjernetAt: d.fjernetAt,
        })),
        runder: runder.map((r) => ({
          id: r.id,
          rundeNr: r.rundeNr,
          startetAt: r.startetAt,
          avsluttetAt: r.avsluttetAt,
          aarsak: r.aarsak,
          antallDeltakere: r.antallDeltakere,
          erGjeldende: gjeldende?.id === r.id,
          signaturer: r.signaturer.map((s) => ({
            deltakerId: s.deltakerId,
            hmsKortNr: s.hmsKortNr,
            harIkkeHmsKort: s.harIkkeHmsKort,
            signaturbilde: s.signaturbilde,
            completedAt: s.completedAt,
            signertTidspunkt: s.signertTidspunkt,
            signertVersjon: s.signertVersjon,
            // Krevd ny signatur → deltakeren er flyttet til manko; raden bæres for sporet.
            nySignaturKrevdAt: s.nySignaturKrevdAt,
            nySignaturKrevdAvNavn: s.nySignaturKrevdAv ? brukerNavn.get(s.nySignaturKrevdAv) ?? null : null,
            // Gjest bekreftet av ansvarlig → «bekreftet av <navn>» (aldri utelatt).
            bekreftetAvNavn: s.bekreftetAvUserId ? brukerNavn.get(s.bekreftetAvUserId) ?? "Ukjent" : null,
          })),
        })),
        status,
        // Dokumentets nåværende innholdsversjon + når innholdet sist ble endret
        // (fra endringsloggen) — driver amber «signert før endring <dato>».
        innholdsVersjon,
        innholdEndretAt,
        gjeldendeRundeLaast: gjeldende?.avsluttetAt != null,
        kanRedigere: ansvarlig,
        minDeltakerId: minDeltaker?.id ?? null,
      };
    }),

  /**
   * Chip-tall «X av Y signert» for alle SJA i et prosjekt — HMS-listekortet.
   * Returnerer en FLAT form: den nøstede take:1 + _count-selecten bor internt i
   * resolveren, så den dype relasjonstypen aldri havner i den eksponerte
   * output-typen (unngår TS2589 i tRPC-klienten, O-5c/api.md:506). Én spørring.
   */
  hentChips: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const rader = await ctx.prisma.checklist.findMany({
        where: {
          template: { projectId: input.projectId, domain: "hms", subdomain: "sja" },
        },
        select: {
          id: true,
          innholdsVersjon: true,
          signaturRunder: {
            take: 1,
            orderBy: { rundeNr: "desc" },
            select: {
              rundeNr: true,
              avsluttetAt: true,
              antallDeltakere: true,
              // Krevd-ny teller ikke; før-endring gir amber; signert/bekreftet splittes
              // → trenger versjon + bekreftet-flagg, ikke bare _count. Bundet av antall
              // deltakere per runde (lite).
              signaturer: { select: { signertVersjon: true, nySignaturKrevdAt: true, bekreftetAvUserId: true } },
            },
          },
          _count: { select: { signaturDeltakere: { where: { fjernetAt: null } } } },
        },
      });
      return rader.map((r) => {
        const siste = r.signaturRunder[0];
        const tellende = siste?.signaturer.filter((s) => s.nySignaturKrevdAt === null) ?? [];
        const antallFørEndring = tellende.filter((s) => s.signertVersjon < r.innholdsVersjon).length;
        const s = beregnSignaturStatus(
          siste
            ? {
                rundeNr: siste.rundeNr,
                avsluttet: siste.avsluttetAt !== null,
                antallSignert: tellende.filter((x) => !x.bekreftetAvUserId).length,
                antallBekreftet: tellende.filter((x) => x.bekreftetAvUserId).length,
                antallSignertFørEndring: antallFørEndring,
                antallDeltakere: siste.antallDeltakere,
              }
            : null,
          r._count.signaturDeltakere,
        );
        return {
          checklistId: r.id,
          signert: s.signert,
          bekreftet: s.bekreftet,
          av: s.av,
          signertFørEndring: s.signertFørEndring,
          status: s.status,
        };
      });
    }),

  /**
   * Manko for gjeldende runde — lett SHA-KU-oppslag (0 nye klikk fra lista).
   * Åpen runde: aktive deltakere minus rundens signaturer. Avsluttet/ingen
   * runde: hele lista står som ikke-signerbar.
   */
  hentManko: protectedProcedure
    .input(dokumentRef)
    .query(async ({ ctx, input }) => {
      const { projectId } = await hentDokumentKontekst(ctx.prisma, input);
      await verifiserProsjektmedlem(ctx.userId, projectId);
      const filter = refFilter(input);

      const gjeldende = await ctx.prisma.signaturRunde.findFirst({
        where: filter,
        orderBy: { rundeNr: "desc" },
        select: {
          id: true,
          rundeNr: true,
          avsluttetAt: true,
          // Krevd-ny signaturer teller ikke som signert — deltakeren står i manko igjen.
          signaturer: { select: { deltakerId: true, nySignaturKrevdAt: true } },
        },
      });
      const aktive = await ctx.prisma.dokumentDeltaker.findMany({
        where: { ...filter, fjernetAt: null },
        select: deltakerVisning,
        orderBy: { lagtTilAt: "asc" },
      });

      const signertIds = new Set(
        (gjeldende?.signaturer ?? []).filter((s) => s.nySignaturKrevdAt === null).map((s) => s.deltakerId),
      );
      const manko = aktive
        .filter((d) => !signertIds.has(d.id))
        .map((d) => ({
          deltakerId: d.id,
          navn: d.user?.name ?? d.guestName ?? "Ukjent",
          firma: d.guestCompany ?? null,
          erGjest: !d.userId,
        }));

      return {
        rundeNr: gjeldende?.rundeNr ?? null,
        rundeAapen: gjeldende ? gjeldende.avsluttetAt === null : false,
        antallSignert: signertIds.size,
        antallAktive: aktive.length,
        manko,
      };
    }),

  /**
   * Start ny signaturrunde (ansvarlig). Første kall tar objektet i bruk (runde 1);
   * senere kall krever at gjeldende runde er avsluttet — gjenåpner innhold, nytt
   * signatursett, forrige runde består urørt.
   */
  startRunde: protectedProcedure
    .input(dokumentRef.and(z.object({ aarsak: z.string().max(500).optional() })))
    .mutation(async ({ ctx, input }) => {
      const { projectId, bestillerUserId } = await hentDokumentKontekst(ctx.prisma, input);
      await krevAnsvarlig(ctx.prisma, ctx.userId, projectId, bestillerUserId);
      const filter = refFilter(input);

      const siste = await ctx.prisma.signaturRunde.findFirst({
        where: filter,
        orderBy: { rundeNr: "desc" },
        select: { rundeNr: true, avsluttetAt: true },
      });
      if (siste && siste.avsluttetAt === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Avslutt gjeldende runde før du starter en ny",
        });
      }

      return ctx.prisma.signaturRunde.create({
        data: {
          ...filter,
          rundeNr: (siste?.rundeNr ?? 0) + 1,
          startetAv: ctx.userId,
          aarsak: input.aarsak ?? null,
        },
        select: { id: true, rundeNr: true },
      });
    }),

  /**
   * Avslutt runde (ansvarlig): låser innholdet + fryser antallDeltakere til
   * antall aktive nå (snapshot-prinsippet). Ingen klokke-lås.
   */
  avsluttRunde: protectedProcedure
    .input(z.object({ rundeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const runde = await ctx.prisma.signaturRunde.findUniqueOrThrow({
        where: { id: input.rundeId },
        select: { checklistId: true, taskId: true, avsluttetAt: true },
      });
      const ref: DokumentRef = {
        checklistId: runde.checklistId ?? undefined,
        taskId: runde.taskId ?? undefined,
      };
      const { projectId, bestillerUserId } = await hentDokumentKontekst(ctx.prisma, ref);
      await krevAnsvarlig(ctx.prisma, ctx.userId, projectId, bestillerUserId);
      if (runde.avsluttetAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Runden er allerede avsluttet" });
      }

      const antallDeltakere = await ctx.prisma.dokumentDeltaker.count({
        where: { ...refFilter(ref), fjernetAt: null },
      });

      return ctx.prisma.signaturRunde.update({
        where: { id: input.rundeId },
        data: { avsluttetAt: new Date(), avsluttetAv: ctx.userId, antallDeltakere },
        select: { id: true, avsluttetAt: true, antallDeltakere: true },
      });
    }),

  /**
   * Legg til deltaker (ansvarlig): prosjektmedlem (userId) eller gjest. Personen
   * vises umiddelbart som manko. Aldri auto — appen foreslår, ansvarlig legger til.
   */
  deltakerLeggTil: protectedProcedure
    .input(
      dokumentRef.and(
        z.union([
          z.object({ userId: z.string().uuid() }),
          z.object({
            guestName: z.string().min(1).max(200),
            guestCompany: z.string().max(200).optional(),
            guestPhone: z.string().max(30).optional(),
          }),
        ]),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const ref: DokumentRef = { checklistId: input.checklistId, taskId: input.taskId };
      const { projectId, bestillerUserId } = await hentDokumentKontekst(ctx.prisma, ref);
      await krevAnsvarlig(ctx.prisma, ctx.userId, projectId, bestillerUserId);
      const filter = refFilter(ref);

      if ("userId" in input) {
        // Prosjektmedlem — må være medlem, og ikke allerede aktiv deltaker.
        await verifiserProsjektmedlem(input.userId, projectId);
        const finnes = await ctx.prisma.dokumentDeltaker.findFirst({
          where: { ...filter, userId: input.userId, fjernetAt: null },
          select: { id: true },
        });
        if (finnes) {
          throw new TRPCError({ code: "CONFLICT", message: "Personen er allerede deltaker" });
        }
        return ctx.prisma.dokumentDeltaker.create({
          data: { ...filter, userId: input.userId, lagtTilAv: ctx.userId },
          select: { id: true },
        });
      }

      return ctx.prisma.dokumentDeltaker.create({
        data: {
          ...filter,
          guestName: input.guestName,
          guestCompany: input.guestCompany ?? null,
          guestPhone: input.guestPhone ?? null,
          lagtTilAv: ctx.userId,
        },
        select: { id: true },
      });
    }),

  /**
   * Fjern deltaker (ansvarlig): soft-fjern (fjernetAt) — historikk består, avgitte
   * signaturer slettes aldri. Telles ikke i manko etter fjerning.
   */
  deltakerFjern: protectedProcedure
    .input(z.object({ deltakerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deltaker = await ctx.prisma.dokumentDeltaker.findUniqueOrThrow({
        where: { id: input.deltakerId },
        select: { checklistId: true, taskId: true, fjernetAt: true },
      });
      const ref: DokumentRef = {
        checklistId: deltaker.checklistId ?? undefined,
        taskId: deltaker.taskId ?? undefined,
      };
      const { projectId, bestillerUserId } = await hentDokumentKontekst(ctx.prisma, ref);
      await krevAnsvarlig(ctx.prisma, ctx.userId, projectId, bestillerUserId);
      if (deltaker.fjernetAt) return { id: input.deltakerId }; // idempotent

      return ctx.prisma.dokumentDeltaker.update({
        where: { id: input.deltakerId },
        data: { fjernetAt: new Date(), fjernetAv: ctx.userId },
        select: { id: true },
      });
    }),

  /**
   * Signer egen rad (medlem) eller gjest-rad (ansvarlig, på egen enhet).
   * Kun gjeldende åpne runde. Identitet bor på deltakeren; signaturen bærer
   * HMS-kort, bilde og tidspunkt.
   */
  signer: protectedProcedure
    .input(
      z.object({
        deltakerId: z.string().uuid(),
        signaturbilde: z.string().min(1).optional(),
        hmsKortNr: hmsKortSchema.optional(),
        harIkkeHmsKort: z.boolean().default(false),
        // Klientens signaturTidspunktNaa() — lokal ISO-8601 med offset. Veggklokka
        // vises identisk på tvers av flater/tidssoner (samme form som signaturfeltet).
        signertTidspunkt: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const deltaker = await ctx.prisma.dokumentDeltaker.findUniqueOrThrow({
        where: { id: input.deltakerId },
        select: { checklistId: true, taskId: true, userId: true, fjernetAt: true },
      });
      if (deltaker.fjernetAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Deltakeren er fjernet fra lista" });
      }
      const ref: DokumentRef = {
        checklistId: deltaker.checklistId ?? undefined,
        taskId: deltaker.taskId ?? undefined,
      };
      const { projectId, bestillerUserId, innholdsVersjon } = await hentDokumentKontekst(ctx.prisma, ref);
      await verifiserProsjektmedlem(ctx.userId, projectId);

      // Gating: medlem signerer egen rad; gjest signeres av ansvarlig på egen enhet.
      if (deltaker.userId) {
        if (deltaker.userId !== ctx.userId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Du kan bare signere din egen rad" });
        }
      } else {
        await krevAnsvarlig(ctx.prisma, ctx.userId, projectId, bestillerUserId);
      }

      const gjeldende = await ctx.prisma.signaturRunde.findFirst({
        where: refFilter(ref),
        orderBy: { rundeNr: "desc" },
        select: { id: true, avsluttetAt: true },
      });
      if (!gjeldende) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ingen aktiv runde å signere i" });
      }
      if (gjeldende.avsluttetAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Runden er avsluttet — start en ny runde for å signere",
        });
      }

      const finnes = await ctx.prisma.dokumentSignatur.findUnique({
        where: { rundeId_deltakerId: { rundeId: gjeldende.id, deltakerId: input.deltakerId } },
        select: { id: true, nySignaturKrevdAt: true },
      });
      // Signaturen bærer versjonen den ble avgitt på (`signertVersjon`) → «signert
      // før endring» kan avgjøres senere. `bekreftetAvUserId` settes KUN for gjester
      // (deltaker.userId === null): da er dette en bekreftelse FRA ansvarlig, ikke en
      // signatur av gjesten (Kenneth-vedtak 2026-09-06). Egen rad → forblir null.
      const signaturData = {
        hmsKortNr: input.hmsKortNr ?? null,
        harIkkeHmsKort: input.harIkkeHmsKort,
        signaturbilde: input.signaturbilde ?? null,
        signertTidspunkt: input.signertTidspunkt ?? null,
        signertVersjon: innholdsVersjon,
        bekreftetAvUserId: deltaker.userId ? null : ctx.userId,
      };
      if (finnes) {
        // Re-signering er tillatt KUN når ansvarlig har krevd ny signatur (raden er
        // flyttet til manko). Da oppdateres den samme raden — unik [runde,deltaker]
        // hindrer to signaturer i én runde — og krevd-markøren nullstilles.
        if (!finnes.nySignaturKrevdAt) {
          throw new TRPCError({ code: "CONFLICT", message: "Allerede signert i denne runden" });
        }
        return ctx.prisma.dokumentSignatur.update({
          where: { id: finnes.id },
          data: { ...signaturData, nySignaturKrevdAt: null, nySignaturKrevdAv: null },
          select: { id: true, completedAt: true },
        });
      }

      return ctx.prisma.dokumentSignatur.create({
        data: { rundeId: gjeldende.id, deltakerId: input.deltakerId, ...signaturData },
        select: { id: true, completedAt: true },
      });
    }),

  /**
   * «Krev ny signatur» (ansvarlig): flytt signaturer som ble avgitt FØR en senere
   * innholdsendring tilbake til manko. Ikke-destruktivt — raden består (logg/PDF for
   * sin versjon), men `nySignaturKrevdAt` markerer at deltakeren må signere på nytt.
   * Nullstiller IKKE runden og treffer bare de N som signerte før endringen (skillet
   * mot «Start ny runde», som gjenåpner innholdet for ALLE). Menneskets kall.
   */
  krevNySignatur: protectedProcedure
    .input(dokumentRef)
    .mutation(async ({ ctx, input }) => {
      const { projectId, bestillerUserId, innholdsVersjon } = await hentDokumentKontekst(ctx.prisma, input);
      await krevAnsvarlig(ctx.prisma, ctx.userId, projectId, bestillerUserId);

      const gjeldende = await ctx.prisma.signaturRunde.findFirst({
        where: refFilter(input),
        orderBy: { rundeNr: "desc" },
        select: { id: true, avsluttetAt: true },
      });
      if (!gjeldende) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ingen aktiv runde" });
      }
      if (gjeldende.avsluttetAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Runden er avsluttet" });
      }

      // Kun de som signerte på en eldre versjon og ikke allerede er krevd på nytt.
      const resultat = await ctx.prisma.dokumentSignatur.updateMany({
        where: {
          rundeId: gjeldende.id,
          nySignaturKrevdAt: null,
          signertVersjon: { lt: innholdsVersjon },
        },
        data: { nySignaturKrevdAt: new Date(), nySignaturKrevdAv: ctx.userId },
      });
      return { antallKrevd: resultat.count };
    }),
});
