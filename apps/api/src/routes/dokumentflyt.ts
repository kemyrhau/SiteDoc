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
import { verifiserProsjektmedlem, verifiserAdmin } from "../trpc/tilgangskontroll";
import { sikreProsjektmedlemmer } from "../services/ansatt";
import { IKKE_SLETTET } from "../utils/softDelete";
import type { PrismaClient } from "@sitedoc/db";

/**
 * Teller IKKE-slettede dokumenter (sjekklister + oppgaver) bundet til en flyt. Delt av slett-vernet
 * OG ledd-vernet (fjernMedlem/oppdaterRoller): en flyt med aktive dokumenter kan verken SLETTES
 * eller TØMMES for ledd — begge etterlater dokumentene uten flytstruktur, i stillhet (samme skade,
 * ulike dører). Papirkurv (KUN_SLETTET) holdes utenfor per ordre. Godkjenning/KontrollplanPunkt
 * telles IKKE her (meldt som utvidelse, likt slett-vernet).
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

      // Ledd-vern (D, Kenneth-vedtak 2026-08-22): å FJERNE en rolle sletter DokumentflytMedlem for
      // det leddet → dokumentene i flyten mister leddet sitt, i stillhet (samme skade som å slette
      // flyten, som er vernet). Blokker rolle-fjerning når flyten har aktive dokumenter. Å LEGGE TIL
      // eller endre etiketter er trygt og forblir tillatt (derfor bare når fjernedeRoller > 0).
      if (fjernedeRoller.length > 0) {
        const antall = await tellFlytDokumenter(ctx.prisma, input.id);
        if (antall > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Flyten har ${antall} aktivt dokument${antall === 1 ? "" : "er"} som bruker leddene. Du kan ikke fjerne en rolle nå — flytt eller lukk dokumentene først.`,
          });
        }
        await ctx.prisma.dokumentflytMedlem.deleteMany({
          where: {
            dokumentflytId: input.id,
            rolle: { in: fjernedeRoller },
          },
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
      const { projectId: _projectId, ...data } = input;
      return ctx.prisma.dokumentflytMedlem.create({
        data,
        include: {
          faggruppe: { select: { id: true, name: true, color: true } },
          projectMember: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          group: { select: { id: true, name: true } },
        },
      });
    }),

  // Batch: legg firmaets ansatte (ev. en hel avdeling, ekspandert klient-side til
  // userIds) inn i en flyt-rolle. Sikrer ProjectMember for hver (delt helper med
  // medlem.leggTilEksisterendeMange) og binder personen til rollen. Admin-gatet.
  // Deaktiverte/ubrukbare avvises i sikreProsjektmedlemmer — de bindes aldri.
  leggTilAnsatteIRolle: protectedProcedure
    .input(addAnsatteIRolleSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      const flyt = await ctx.prisma.dokumentflyt.findFirstOrThrow({
        where: { id: input.dokumentflytId, projectId: input.projectId, ...IKKE_SLETTET },
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
      const projectMemberIds = [...res.projectMemberIdByUserId.values()];
      const alleredeBundet = new Set(
        (
          await ctx.prisma.dokumentflytMedlem.findMany({
            where: {
              dokumentflytId: input.dokumentflytId,
              rolle: input.rolle,
              steg: input.steg,
              projectMemberId: { in: projectMemberIds },
            },
            select: { projectMemberId: true },
          })
        ).map((m) => m.projectMemberId),
      );

      let bundet = 0;
      for (const pmId of projectMemberIds) {
        if (alleredeBundet.has(pmId)) continue;
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

  // Fjern medlem fra dokumentflyt
  fjernMedlem: protectedProcedure
    .input(removeDokumentflytMedlemSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      // Ledd-vern (D): å fjerne et flytmedlem tømmer leddet for det medlemmet → dokumentene mister
      // (deler av) leddet sitt, i stillhet. Blokker når flyten har aktive dokumenter. Hent medlemmets
      // flyt for å telle (input bærer bare medlem-id).
      const medlem = await ctx.prisma.dokumentflytMedlem.findUniqueOrThrow({
        where: { id: input.id },
        select: { dokumentflytId: true },
      });
      const antall = await tellFlytDokumenter(ctx.prisma, medlem.dokumentflytId);
      if (antall > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Flyten har ${antall} aktivt dokument${antall === 1 ? "" : "er"} som bruker leddene. Du kan ikke fjerne et medlem nå — flytt eller lukk dokumentene først.`,
        });
      }
      return ctx.prisma.dokumentflytMedlem.delete({ where: { id: input.id } });
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

      const medlem = await ctx.prisma.dokumentflytMedlem.findUniqueOrThrow({
        where: { id: input.id },
      });

      // Fjern hovedansvarlig fra andre i samme dokumentflyt+rolle+steg
      if (input.erHovedansvarlig) {
        await ctx.prisma.dokumentflytMedlem.updateMany({
          where: {
            dokumentflytId: medlem.dokumentflytId,
            rolle: medlem.rolle,
            steg: medlem.steg,
            erHovedansvarlig: true,
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

      const medlem = await ctx.prisma.dokumentflytMedlem.findUniqueOrThrow({
        where: { id: input.id },
      });

      // Fjern hovedansvarlig fra alle andre i samme dokumentflyt + rolle
      await ctx.prisma.dokumentflytMedlem.updateMany({
        where: {
          dokumentflytId: medlem.dokumentflytId,
          rolle: medlem.rolle,
          steg: medlem.steg,
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
      return ctx.prisma.dokumentflytMedlem.update({
        where: { id: input.id },
        data: { kanRedigere: input.kanRedigere },
      });
    }),
});
