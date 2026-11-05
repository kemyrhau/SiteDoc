import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  createDokumentflytSchema,
  updateDokumentflytSchema,
  addDokumentflytMedlemSchema,
  addAnsatteIRolleSchema,
  removeDokumentflytMedlemSchema,
  oppdaterRollerSchema,
} from "@sitedoc/shared";
import { verifiserProsjektmedlem, verifiserAdmin, aktivtMedlemWhere } from "../trpc/tilgangskontroll";
import { sikreProsjektmedlemmer, aktivAnsattIFirmaWhere } from "../services/ansatt";
import {
  FLYTMEDLEM_SELECT,
  avsluttFlytmedlem,
  finnApneDokumenterHosMedlem,
  hentGjenvarendeILeddet,
  pekerFor,
  tellAndreBindingerILeddet,
  tellApneDokumenterPaaSteg,
} from "../services/flytFjerning";
import { IKKE_SLETTET } from "../utils/softDelete";
import type { PrismaClient, Prisma } from "@sitedoc/db";

/**
 * Teller IKKE-slettede dokumenter (sjekklister + oppgaver) bundet til en flyt — slett-vernet: en
 * flyt med dokumenter kan ikke SLETTES (de ville stått uten flytstruktur, i stillhet). Papirkurv
 * (KUN_SLETTET) holdes utenfor per ordre. Godkjenning/KontrollplanPunkt telles IKKE her (meldt som
 * utvidelse). Ledd-vernet (oppdaterRoller) teller i stedet åpne dokumenter på stegene som
 * forsvinner (`tellApneDokumenterPaaSteg`); person-fjerning har ingen sperre (L1, B1).
 */
async function tellFlytDokumenter(prisma: PrismaClient, dokumentflytId: string): Promise<number> {
  const [sjekklister, oppgaver] = await Promise.all([
    prisma.checklist.count({ where: { dokumentflytId, ...IKKE_SLETTET } }),
    prisma.task.count({ where: { dokumentflytId, ...IKKE_SLETTET } }),
  ]);
  return sjekklister + oppgaver;
}

/**
 * E (Kenneth-vedtak 2026-08-22): en dokumentflyt MÅ ha Registrator i FØRSTE ledd — det er den som
 * OPPRETTER dokumentet. Uten registrator først kan ingen starte et dokument i flyten, og den er
 * ubrukelig (før: ingen validering → man kunne sette Godkjenner som første boks). Boksene rendres i
 * `roller`-array-rekkefølge (DynamiskFlyt), så første ledd = `roller[0]`. Kastes ved lagring.
 */
function validerRegistratorForst(roller: Array<{ rolle: string }>): void {
  if (roller.length === 0 || roller[0]?.rolle !== "registrator") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Første ledd i flyten må være Registrator — det er den som oppretter dokumentet. Sett Registrator som første rolle.",
    });
  }
}

const dokumentflytInclude = {
  faggruppe: { select: { id: true, name: true, color: true } },
  medlemmer: {
    // Avsluttede medlemskap (periodeSlutt satt) vises ikke i oppsettet — historikken er loggen.
    where: aktivtMedlemWhere,
    include: {
      faggruppe: { select: { id: true, name: true, color: true } },
      projectMember: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      group: { select: { id: true, name: true } },
      hovedansvarligPerson: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { steg: "asc" as const },
  },
  maler: {
    include: { template: { select: { id: true, name: true, category: true } } },
  },
} as const;

/**
 * ADMIN-GATE på flyt-konfigurasjon (Kenneth-vedtak 2026-08-22, fabel-verifisert).
 *
 * ALLE mutasjoner her konfigurerer dokumentflyten — opprett/oppdater/roller/medlemmer/
 * hovedansvarlig/slett — og krever derfor prosjektadmin eller høyere. De bruker `verifiserAdmin`
 * (ikke `verifiserProsjektmedlem`), som dekker sitedoc_admin → prosjektadmin
 * (`ProjectMember.role="admin"`) → **firmaadmin** i én. Firmaadmin-grenen er IKKE valgfri:
 * firmaadmin har INGEN ProjectMember-rad, så en håndrullet `medlem.role`-sjekk ville avvist ham
 * (samme felle som `verifiserRetningsrett`). Bruk hjelperen, aldri en egen sjekk.
 *
 * UNNTAK: `hentForProsjekt` (lese) står på medlem-nivå — alle må se flytene sine.
 */
export const dokumentflytRouter = router({
  // Hent alle dokumentflyter for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Lese-gaten BLIR STÅENDE på medlem-nivå: alle må se flytene sine (kun mutasjonene admin-gates).
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.dokumentflyt.findMany({
        where: { projectId: input.projectId },
        include: dokumentflytInclude,
        orderBy: { name: "asc" },
      });
    }),

  // Opprett ny dokumentflyt
  opprett: protectedProcedure
    .input(createDokumentflytSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      // `data` bærer name/faggruppeId/bundet videre til create (bundet defaulter til fri i schema).
      const { templateIds, medlemmer, roller, ...data } = input;
      // Default: ny dokumentflyt starter med Registrator som eneste rolle.
      // Bruker legger til Bestiller/Utfører/Godkjenner via «+ Legg til rolle».
      // UI kan overstyre ved å sende eksplisitt roller-array i input.
      const startRoller = roller && roller.length > 0
        ? roller
        : [{ rolle: "registrator" as const }];
      validerRegistratorForst(startRoller); // E: registrator i første ledd (default oppfyller det)
      return ctx.prisma.dokumentflyt.create({
        data: {
          ...data,
          roller: startRoller,
          maler: {
            create: templateIds.map((templateId) => ({ templateId })),
          },
          medlemmer: {
            create: medlemmer.map((m) => ({
              faggruppeId: m.faggruppeId,
              projectMemberId: m.projectMemberId,
              groupId: m.groupId,
              rolle: m.rolle,
              steg: m.steg,
            })),
          },
        },
        include: dokumentflytInclude,
      });
    }),

  // Oppdater dokumentflyt — navn og/eller maltilknytninger
  oppdater: protectedProcedure
    .input(updateDokumentflytSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      // `data` bærer name/bundet videre til update — bundet kan slås av/på begge veier her.
      const { id, projectId: _projectId, templateIds, ...data } = input;

      if (Object.keys(data).length > 0) {
        await ctx.prisma.dokumentflyt.update({ where: { id }, data });
      }

      // Erstatt maltilknytninger hvis gitt
      if (templateIds !== undefined) {
        await ctx.prisma.dokumentflytMal.deleteMany({ where: { dokumentflytId: id } });
        if (templateIds.length > 0) {
          await ctx.prisma.dokumentflytMal.createMany({
            data: templateIds.map((templateId) => ({ dokumentflytId: id, templateId })),
          });
        }
      }

      return ctx.prisma.dokumentflyt.findUniqueOrThrow({
        where: { id },
        include: dokumentflytInclude,
      });
    }),

  // Oppdater roller-konfigurasjon (legg til/fjern roller, endre labels)
  oppdaterRoller: protectedProcedure
    .input(oppdaterRollerSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      validerRegistratorForst(input.roller); // E: registrator må stå i første ledd

      const eksisterende = await ctx.prisma.dokumentflyt.findUniqueOrThrow({
        where: { id: input.id },
        select: { roller: true },
      });

      // Finn roller som ble fjernet
      const nyeRolleNavn: Set<string> = new Set(input.roller.map((r) => r.rolle));
      const gamleRoller = (eksisterende.roller as Array<{ rolle: string }>) ?? [];
      const fjernedeRoller = gamleRoller
        .map((r) => r.rolle)
        .filter((rolle) => !nyeRolleNavn.has(rolle));

      // Ledd-vern (D, Kenneth-vedtak 2026-08-22; B2 2026-11-05): et ledd som forsvinner kan ikke
      // rutes — et dokument som står der ville miste leddet sitt. Sperren teller derfor bare ÅPNE
      // dokumenter som står på de fjernede stegene (ikke alle i flyten). Medlemmene avsluttes mykt
      // (periodeSlutt), ikke slettes. Å LEGGE TIL eller endre etiketter er alltid tillatt.
      if (fjernedeRoller.length > 0) {
        const berorte = await ctx.prisma.dokumentflytMedlem.findMany({
          where: { dokumentflytId: input.id, rolle: { in: fjernedeRoller }, ...aktivtMedlemWhere },
          select: { steg: true, groupId: true, projectMember: { select: { userId: true } } },
        });
        // Steg = medlemmenes steg + rollens posisjon i rekka (ledd uten medlemmer har bare posisjonen).
        const steg = new Set<number>(berorte.map((m) => m.steg));
        gamleRoller.forEach((r, i) => {
          if (fjernedeRoller.includes(r.rolle)) steg.add(i + 1);
        });
        const antall = await tellApneDokumenterPaaSteg(ctx.prisma, {
          dokumentflytId: input.id,
          steg: [...steg],
          userIder: berorte.flatMap((m) => (m.projectMember?.userId ? [m.projectMember.userId] : [])),
          groupIder: berorte.flatMap((m) => (m.groupId ? [m.groupId] : [])),
        });
        if (antall > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${antall} åpn${antall === 1 ? "t dokument står" : "e dokumenter står"} på leddet du vil fjerne. Send dem videre eller lukk dem først.`,
          });
        }
        await ctx.prisma.dokumentflytMedlem.updateMany({
          where: {
            dokumentflytId: input.id,
            rolle: { in: fjernedeRoller },
            ...aktivtMedlemWhere,
          },
          data: { periodeSlutt: new Date() },
        });
      }

      return ctx.prisma.dokumentflyt.update({
        where: { id: input.id },
        data: { roller: input.roller },
        include: dokumentflytInclude,
      });
    }),

  // Slett dokumentflyt
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Admin-gate — begrunnelse i router-doccen øverst. Sletting rører alle dokumenter i flyten.
      await verifiserAdmin(ctx.userId, input.projectId);

      // Slett-vern (Kenneth-bestilling 2026-08-22): `Checklist`/`Task`/`Godkjenning`/
      // `KontrollplanPunkt` → `Dokumentflyt` er alle `onDelete: SetNull` (schema:1084/1150/1211/
      // 2099). Uten denne vakten ville sletting stille NULLSTILT flyt-id på ALLE dokumentene i
      // flyten — de ble flyt-løse uten spor (prod: 1 av 16 sjekklister ER flyt-løs, kan være dette).
      // Vi teller IKKE-slettede sjekklister + oppgaver (papirkurv-rader holdes utenfor per ordre —
      // de ville uansett fått SetNull ved en senere hard-sletting). App-guard med lesbar melding;
      // en `onDelete: Restrict`-DB-backstop er meldt som eget spor (jf. ReportTemplate schema:1144).
      const antall = await tellFlytDokumenter(ctx.prisma, input.id);
      if (antall > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Flyten har ${antall} dokument${antall === 1 ? "" : "er"} og kan ikke slettes. Flytt eller lukk dem først.`,
        });
      }

      return ctx.prisma.dokumentflyt.delete({ where: { id: input.id } });
    }),

  // Legg til medlem (faggruppe eller person) i dokumentflyt
  leggTilMedlem: protectedProcedure
    .input(addDokumentflytMedlemSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      const { projectId, ...data } = input;
      const include = {
        faggruppe: { select: { id: true, name: true, color: true } },
        projectMember: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        group: { select: { id: true, name: true } },
      } as const;
      // En person må være aktivt prosjektmedlem — et avsluttet medlem bindes ikke inn (L2b).
      if (data.projectMemberId) {
        const pm = await ctx.prisma.projectMember.findFirst({
          where: { id: data.projectMemberId, projectId, ...aktivtMedlemWhere },
          select: { id: true },
        });
        if (!pm) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Personen er ikke medlem av prosjektet" });
        }
      }
      // Gjenlegging av en fjernet binding gjenåpner raden (unik-nøkkelen står) i stedet for ny rad.
      const avsluttet = await ctx.prisma.dokumentflytMedlem.findFirst({
        where: {
          dokumentflytId: data.dokumentflytId,
          dokumentflyt: { projectId },
          faggruppeId: data.faggruppeId ?? null,
          projectMemberId: data.projectMemberId ?? null,
          groupId: data.groupId ?? null,
          rolle: data.rolle,
          steg: data.steg,
          periodeSlutt: { not: null },
        },
        select: { id: true },
      });
      if (avsluttet) {
        return ctx.prisma.dokumentflytMedlem.update({
          where: { id: avsluttet.id },
          data: {
            periodeSlutt: null,
            kanRedigere: data.kanRedigere,
            låsesEtterPasseringer: data.låsesEtterPasseringer ?? null,
          },
          include,
        });
      }
      return ctx.prisma.dokumentflytMedlem.create({ data, include });
    }),

  // Batch: legg firmaets ansatte (ev. en hel avdeling, ekspandert klient-side til
  // userIds) inn i en flyt-rolle. Sikrer ProjectMember for hver (delt helper med
  // medlem.leggTilEksisterendeMange) og binder personen til rollen. Admin-gatet.
  // Deaktiverte/ubrukbare avvises i sikreProsjektmedlemmer — de bindes aldri.
  // Ansattvelger-modalen i flyt-kontekst: LIST alle aktive ansatte i eier-firmaet,
  // MERK dem som alt står i en rolle i DENNE flyten — ikke skjul dem (Kenneth-vedtak
  // 2026-08-28). Skiller seg fra medlem.hentLedigeFirmaBrukere, som filtrerer bort alle
  // prosjektmedlemmer (riktig for prosjektmedlem-flaten, feil for flyt-flaten der samme
  // person gjerne skal kunne stå i to roller). Merket er scopet PER FLYT: i en annen
  // dokumentflyt er personen umerket og fritt tilgjengelig.
  hentFirmaBrukereForFlyt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), dokumentflytId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      const flyt = await ctx.prisma.dokumentflyt.findFirstOrThrow({
        where: { id: input.dokumentflytId, projectId: input.projectId },
        select: { id: true, project: { select: { primaryOrganizationId: true } } },
      });
      const orgId = flyt.project?.primaryOrganizationId;
      if (!orgId) return [];

      // Alle aktive, brukbare ansatte — INGEN notIn: vi skjuler ingen.
      const ansatte = await ctx.prisma.organizationMember.findMany({
        where: aktivAnsattIFirmaWhere(orgId),
        select: {
          avdelingId: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { user: { name: "asc" } },
      });

      // Rollemerker per bruker — kun denne flytens medlemmer (per flyt, ikke prosjekt).
      const flytMedlemmer = await ctx.prisma.dokumentflytMedlem.findMany({
        where: {
          dokumentflytId: input.dokumentflytId,
          projectMember: { userId: { not: null } },
          ...aktivtMedlemWhere,
        },
        select: { rolle: true, projectMember: { select: { userId: true } } },
      });
      const rollerByUser = new Map<string, Set<string>>();
      for (const m of flytMedlemmer) {
        const uid = m.projectMember?.userId;
        if (!uid) continue;
        if (!rollerByUser.has(uid)) rollerByUser.set(uid, new Set());
        rollerByUser.get(uid)!.add(m.rolle);
      }

      return ansatte.map((m) => ({
        ...m.user,
        avdelingId: m.avdelingId,
        flytRoller: [...(rollerByUser.get(m.user.id) ?? [])],
      }));
    }),

  leggTilAnsatteIRolle: protectedProcedure
    .input(addAnsatteIRolleSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      // Dokumentflyt er IKKE soft-deletet (kun Checklist/Task har deletedAt) — derfor
      // ingen IKKE_SLETTET her; det ville gitt Prisma «Unknown argument deletedAt».
      const flyt = await ctx.prisma.dokumentflyt.findFirstOrThrow({
        where: { id: input.dokumentflytId, projectId: input.projectId },
        select: { id: true, project: { select: { primaryOrganizationId: true } } },
      });
      const orgId = flyt.project?.primaryOrganizationId;
      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Prosjektet har ikke et eier-firma å hente ansatte fra",
        });
      }

      const res = await sikreProsjektmedlemmer(ctx.prisma, {
        projectId: input.projectId,
        organizationId: orgId,
        userIds: input.userIds,
      });

      // Bind hver gyldig person til rollen — hopp over dem som allerede står i
      // nøyaktig denne rollen på dette steget (idempotent, ingen duplikat-ledd).
      // En avsluttet binding gjenåpnes (unik-nøkkelen står igjen etter myk fjerning).
      const projectMemberIds = [...res.projectMemberIdByUserId.values()];
      const eksisterende = await ctx.prisma.dokumentflytMedlem.findMany({
        where: {
          dokumentflytId: input.dokumentflytId,
          rolle: input.rolle,
          steg: input.steg,
          projectMemberId: { in: projectMemberIds },
        },
        select: { id: true, projectMemberId: true, periodeSlutt: true },
      });
      const alleredeBundet = new Set(
        eksisterende.filter((m) => m.periodeSlutt === null).map((m) => m.projectMemberId),
      );
      const avsluttet = new Map(
        eksisterende.filter((m) => m.periodeSlutt !== null).map((m) => [m.projectMemberId, m.id]),
      );

      let bundet = 0;
      for (const pmId of projectMemberIds) {
        if (alleredeBundet.has(pmId)) continue;
        const gjenapneId = avsluttet.get(pmId);
        if (gjenapneId) {
          await ctx.prisma.dokumentflytMedlem.update({
            where: { id: gjenapneId },
            data: { periodeSlutt: null },
          });
          bundet += 1;
          continue;
        }
        await ctx.prisma.dokumentflytMedlem.create({
          data: {
            dokumentflytId: input.dokumentflytId,
            projectMemberId: pmId,
            rolle: input.rolle,
            steg: input.steg,
          },
        });
        bundet += 1;
      }

      return {
        bundet,
        alleredeIRollen: alleredeBundet.size,
        lagtTilSomMedlem: res.lagtTil,
        ugyldige: res.ugyldige.length,
      };
    }),

  // Forhåndsvisning til bekreftelsesmodalen: hvor mange åpne dokumenter har ballen hos medlemmet,
  // og hvem andre står i leddet (kandidater til ny hovedansvarlig).
  forhandsvisFjerning: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      const medlem = await hentAktivtFlytmedlem(ctx.prisma, input.id, input.projectId);
      const [dokumenter, gjenvarende] = await Promise.all([
        finnApneDokumenterHosMedlem(ctx.prisma, await pekerFor(ctx.prisma, medlem)),
        hentGjenvarendeILeddet(ctx.prisma, medlem),
      ]);
      return {
        antallApne: dokumenter.sjekklister.length + dokumenter.oppgaver.length,
        gjenvarende: gjenvarende.map((m) => ({
          projectMemberId: m.projectMemberId,
          navn: m.navn,
          erHovedansvarlig: m.erHovedansvarlig,
        })),
        andreILeddet: gjenvarende.length + (await tellAndreBindingerILeddet(ctx.prisma, medlem)),
      };
    }),

  // Fjern medlem fra dokumentflyt — myk avslutning (L1, B1/B7/B10). Raden står med periodeSlutt,
  // så loggen og en senere gjenlegging (gjenåpning) har den. Ballen på åpne dokumenter hos
  // medlemmet flyttes til leddets nye hovedansvarlig, eller til leddet selv når det blir tomt.
  fjernMedlem: protectedProcedure
    .input(removeDokumentflytMedlemSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      const medlem = await hentAktivtFlytmedlem(ctx.prisma, input.id, input.projectId);

      const peker = await pekerFor(ctx.prisma, medlem);

      // Ny hovedansvarlig: oppgitt (må være medlem av prosjektet), ellers — bare når den som
      // fjernes var hovedansvarlig eller har åpne dokumenter — første gjenværende person i
      // leddet. `null` = ingen erstatter; leddets hovedansvarlig røres da ikke.
      let nyPmId: string | null;
      if (input.nyHovedansvarligPmId !== undefined) {
        nyPmId = input.nyHovedansvarligPmId;
      } else {
        const apne = await finnApneDokumenterHosMedlem(ctx.prisma, peker);
        const trengerNy = medlem.erHovedansvarlig || apne.sjekklister.length + apne.oppgaver.length > 0;
        nyPmId = trengerNy
          ? (await hentGjenvarendeILeddet(ctx.prisma, medlem))[0]?.projectMemberId ?? null
          : null;
      }
      let nyUserId: string | null = null;
      if (nyPmId) {
        const ny = await ctx.prisma.projectMember.findFirst({
          where: { id: nyPmId, projectId: input.projectId, ...aktivtMedlemWhere },
          select: { userId: true },
        });
        if (!ny) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ny hovedansvarlig er ikke medlem av prosjektet" });
        }
        if (nyPmId === medlem.projectMemberId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Velg en annen enn den som fjernes" });
        }
        nyUserId = ny.userId;
      }

      const aktor = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });

      return ctx.prisma.$transaction(async (tx) => {
        const { fjernet, dokumentIder } = await avsluttFlytmedlem(
          tx,
          medlem,
          peker,
          nyPmId && nyUserId ? { pmId: nyPmId, userId: nyUserId } : null,
        );

        await tx.activity.create({
          data: {
            actorUserId: ctx.userId,
            actorNavnSnapshot: aktor?.name ?? null,
            projectId: input.projectId,
            targetType: "dokumentflyt_medlem",
            targetId: medlem.id,
            action: "flytmedlem_avsluttet",
            payload: {
              dokumentflytId: medlem.dokumentflytId,
              medlemId: medlem.id,
              userId: medlem.projectMember?.userId ?? null,
              groupId: medlem.groupId,
              nyHovedansvarligPmId: nyPmId,
              dokumentIder,
            },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          },
        });

        return fjernet;
      });
    }),

  // Sett/fjern hovedansvarlig for et medlem
  settHovedansvarlig: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        erHovedansvarlig: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      // L2 M1: avsluttet rad (periodeSlutt satt) eller rad i annet prosjekt → NOT_FOUND.
      const medlem = await hentAktivtFlytmedlem(ctx.prisma, input.id, input.projectId);

      // Fjern hovedansvarlig fra andre i samme dokumentflyt+rolle+steg
      if (input.erHovedansvarlig) {
        await ctx.prisma.dokumentflytMedlem.updateMany({
          where: {
            dokumentflytId: medlem.dokumentflytId,
            rolle: medlem.rolle,
            steg: medlem.steg,
            erHovedansvarlig: true,
            ...aktivtMedlemWhere,
          },
          data: { erHovedansvarlig: false },
        });
      }

      return ctx.prisma.dokumentflytMedlem.update({
        where: { id: input.id },
        data: { erHovedansvarlig: input.erHovedansvarlig },
      });
    }),

  // Sett hovedansvarlig person innenfor en gruppe (uten å opprette nye rader)
  settGruppeHovedansvarlig: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(), // DokumentflytMedlem-id (gruppe-raden)
        projectId: z.string().uuid(),
        hovedansvarligPersonId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      // L2 M1: avsluttet rad (periodeSlutt satt) eller rad i annet prosjekt → NOT_FOUND.
      const medlem = await hentAktivtFlytmedlem(ctx.prisma, input.id, input.projectId);

      // Fjern hovedansvarlig fra alle andre i samme dokumentflyt + rolle
      await ctx.prisma.dokumentflytMedlem.updateMany({
        where: {
          dokumentflytId: medlem.dokumentflytId,
          rolle: medlem.rolle,
          steg: medlem.steg,
          ...aktivtMedlemWhere,
        },
        data: {
          erHovedansvarlig: false,
          hovedansvarligPersonId: null,
        },
      });

      // Sett ny hovedansvarlig på denne gruppe-raden
      if (input.hovedansvarligPersonId) {
        return ctx.prisma.dokumentflytMedlem.update({
          where: { id: input.id },
          data: {
            erHovedansvarlig: true,
            hovedansvarligPersonId: input.hovedansvarligPersonId,
          },
        });
      }

      return ctx.prisma.dokumentflytMedlem.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  // Sett kanRedigere for et flytmedlem
  settKanRedigere: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        kanRedigere: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      await hentAktivtFlytmedlem(ctx.prisma, input.id, input.projectId);
      return ctx.prisma.dokumentflytMedlem.update({
        where: { id: input.id },
        data: { kanRedigere: input.kanRedigere },
      });
    }),
});

type Db = PrismaClient | Prisma.TransactionClient;

/** Aktivt flytmedlem, scopet til prosjektet via flyten (ellers NOT_FOUND). */
async function hentAktivtFlytmedlem(db: Db, id: string, projectId: string) {
  const medlem = await db.dokumentflytMedlem.findFirst({
    where: { id, dokumentflyt: { projectId }, ...aktivtMedlemWhere },
    select: FLYTMEDLEM_SELECT,
  });
  if (!medlem) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Flytmedlemmet finnes ikke (eller er allerede fjernet)" });
  }
  return medlem;
}
