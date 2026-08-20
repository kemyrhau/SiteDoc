import { z } from "zod";
import { type Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem, verifiserAdmin } from "../trpc/tilgangskontroll";
import { koblePunktTilSjekkliste } from "../services/kontrollplanKobling";
import { IKKE_SLETTET } from "../utils/softDelete";

// L1.5: en forhåndsvalgt flyt må høre til prosjektet, bruke punktets mal, og ha en
// eier-faggruppe (bestiller utledes fra den ved Start). Uten disse ville bypass-veien
// i sjekkliste.opprett fått en ugyldig flyt. Delt av settPunktFlyt + settFlytForMal.
async function validerFlytForMal(
  prisma: Prisma.TransactionClient,
  args: { dokumentflytId: string; projectId: string; sjekklisteMalId: string },
): Promise<void> {
  const flyt = await prisma.dokumentflyt.findUnique({
    where: { id: args.dokumentflytId },
    select: {
      projectId: true,
      faggruppeId: true,
      maler: { where: { templateId: args.sjekklisteMalId }, select: { id: true } },
    },
  });
  if (!flyt || flyt.projectId !== args.projectId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Dokumentflyten hører ikke til dette prosjektet." });
  }
  if (flyt.maler.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Dokumentflyten bruker ikke malen dette punktet kontrollerer." });
  }
  if (!flyt.faggruppeId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Dokumentflyten mangler eier-faggruppe og kan ikke forhåndsvelges. Sett en eier-faggruppe på flyten først.",
    });
  }
}

// L1.6: ved planoppsett bindes punktets flyt automatisk NÅR malen ligger i nøyaktig én
// kvalifiserende flyt (samme kriterium som validerFlytForMal: i prosjektet, inneholder
// malen, har eier-faggruppe). 0 eller ≥2 kandidater → null; da velger admin ved reell
// tvetydighet. Kjøres KUN ved OPPRETTELSE av punktet — aldri som opprydding senere — så et
// felt en admin bevisst har tømt aldri settes tilbake av automatikken.
async function finnEntydigFlytForMal(
  prisma: Prisma.TransactionClient,
  args: { projectId: string; sjekklisteMalId: string },
): Promise<string | null> {
  const kandidater = await prisma.dokumentflyt.findMany({
    where: {
      projectId: args.projectId,
      faggruppeId: { not: null },
      maler: { some: { templateId: args.sjekklisteMalId } },
    },
    select: { id: true },
    take: 2, // trenger bare å skille 0 / 1 / ≥2
  });
  const [entydig] = kandidater;
  return kandidater.length === 1 && entydig ? entydig.id : null;
}

// Felles includes for kontrollplan-spørringer
const punktIncludes = {
  sjekklisteMal: { select: { id: true, name: true, prefix: true, kontrollomrade: true } },
  faggruppe: { select: { id: true, name: true, color: true } },
  omrade: { select: { id: true, navn: true, type: true } },
  // L1.6: sjekklistens FAKTISKE flyt (dokumentflyt) — for det ærlige feltet i dialogen:
  // er punktet startet, vises flyten dokumentet faktisk ligger i (read-only), ikke punktets
  // preset som ikke ville flyttet det eksisterende dokumentet.
  sjekkliste: { select: { id: true, status: true, dokumentflytId: true, dokumentflyt: { select: { id: true, name: true } } } },
  // L1.5: forhåndsvalgt flyt på punktet (satt av admin). Klienten bruker den til å
  // starte direkte (0 klikk) og til å vise hvilken flyt punktet er bundet til.
  dokumentflyt: { select: { id: true, name: true } },
  // L2: tegningsplassering — hvilken tegning punktet ligger på (for «Vis på tegning»).
  drawing: { select: { id: true, name: true } },
  avhengerAv: { select: { id: true, status: true, sjekklisteMal: { select: { name: true } }, omrade: { select: { navn: true } } } },
} as const;

export const kontrollplanRouter = router({
  // Hent kontrollplan for en byggeplass (med punkter og milepeler)
  hentForByggeplass: protectedProcedure
    .input(z.object({ byggeplassId: z.string() }))
    .query(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.byggeplassId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return ctx.prisma.kontrollplan.findUnique({
        where: { projectId_byggeplassId: { projectId: byggeplass.projectId, byggeplassId: input.byggeplassId } },
        include: {
          punkter: {
            where: { arkivert: false },
            include: punktIncludes,
            orderBy: { opprettet: "asc" },
          },
          milepeler: { orderBy: { sortering: "asc" } },
        },
      });
    }),

  // Andre byggeplasser i samme prosjekt som HAR ikke-arkiverte kontrollpunkter.
  // Brukes av mobil for å skille «ingen punkter på prosjektet» fra «ingen punkter
  // på DENNE byggeplassen — de ligger på X» + hopp dit. Tar byggeplassId (utleder
  // prosjektet selv), så mobil-skjermen slipper å kjenne projectId.
  andreByggeplasserMedPunkter: protectedProcedure
    .input(z.object({ byggeplassId: z.string() }))
    .query(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.byggeplassId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      const planer = await ctx.prisma.kontrollplan.findMany({
        where: {
          projectId: byggeplass.projectId,
          byggeplassId: { not: input.byggeplassId },
        },
        select: {
          byggeplassId: true,
          byggeplass: { select: { name: true } },
          _count: { select: { punkter: { where: { arkivert: false } } } },
        },
      });
      return planer
        .filter((p) => p._count.punkter > 0)
        .map((p) => ({ byggeplassId: p.byggeplassId, navn: p.byggeplass.name, antall: p._count.punkter }))
        .sort((a, b) => b.antall - a.antall);
    }),

  // Opprett eller hent kontrollplan for byggeplass
  opprettEllerHent: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      byggeplassId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({
        where: { id: input.byggeplassId },
        select: { name: true },
      });
      return ctx.prisma.kontrollplan.upsert({
        where: { projectId_byggeplassId: { projectId: input.projectId, byggeplassId: input.byggeplassId } },
        create: {
          projectId: input.projectId,
          byggeplassId: input.byggeplassId,
          navn: `Kontrollplan — ${byggeplass.name}`,
        },
        update: {},
        include: {
          punkter: {
            where: { arkivert: false },
            include: punktIncludes,
            orderBy: { opprettet: "asc" },
          },
          milepeler: { orderBy: { sortering: "asc" } },
        },
      });
    }),

  // Bulk-opprett punkter (flervalg av områder med individuelle frister).
  // Ved fremdriftsplan-import bærer hvert punkt rad-identitet (importTaskUid/importWbs),
  // og første kall i en import sender `importKilde` som oppretter importhendelsen —
  // returnert `importKildeId` gjenbrukes av påfølgende kall i samme import.
  opprettPunkter: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      sjekklisteMalId: z.string().uuid(),
      faggruppeId: z.string().uuid(),
      milepelId: z.string().nullish(),
      punkter: z.array(z.object({
        omradeId: z.string().nullish(),
        fristUke: z.number().int().min(1).max(53).nullish(),
        fristAar: z.number().int().min(2024).max(2100).nullish(),
        importTaskUid: z.number().int().nullish(),
        importWbs: z.string().nullish(),
        importNavn: z.string().nullish(),
      })).min(1),
      // Import-opprinnelse: sett `importKilde` på første kall (oppretter raden),
      // eller `importKildeId` på påfølgende kall (peker til allerede opprettet rad).
      importKilde: z.object({
        filnavn: z.string(),
        antallParsedeRader: z.number().int().min(0),
        hoppetOver: z.array(z.object({
          uid: z.number().int(),
          navn: z.string(),
          wbs: z.string().nullable(),
        })),
      }).nullish(),
      importKildeId: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);

      // L1.6: alle punktene i kallet deler samme mal → én oppslag. Entydig flyt bindes
      // ved opprettelse; ellers null (Start viser feilmeldingen, admin setter flyten).
      const autoFlytId = await finnEntydigFlytForMal(ctx.prisma, {
        projectId: kontrollplan.projectId,
        sjekklisteMalId: input.sjekklisteMalId,
      });

      // Opprett importhendelsen på første kall i en import (påfølgende gruppe-kall
      // gjenbruker importKildeId). Ligger utenfor punkt-transaksjonen: feiler
      // punkt-innsettingen (mest sannsynlig duplikat-import der unik-guarden slår
      // til) står importraden igjen UTEN tilknyttede punkter.
      // TODO (del 2): når revisjon leser hoppetOver, filtrer bort importrader uten
      // punkter — ellers undertrykker en hoppetOver-liste fra en import som aldri
      // gikk gjennom rader brukeren aldri faktisk valgte bort (han blir ikke spurt).
      let importKildeId = input.importKildeId ?? null;
      if (input.importKilde) {
        const imp = await ctx.prisma.kontrollplanImport.create({
          data: {
            kontrollplanId: input.kontrollplanId,
            filnavn: input.importKilde.filnavn,
            antallParsedeRader: input.importKilde.antallParsedeRader,
            importertAvId: ctx.userId,
            hoppetOver: input.importKilde.hoppetOver,
          },
        });
        importKildeId = imp.id;
      }

      // Batchet transaksjon (én pipelinet round-trip) — ikke N sekvensielle inserts.
      // include kreves for punktIncludes, som createMany ikke støtter.
      const opprettet = await ctx.prisma.$transaction(
        input.punkter.map((p) =>
          ctx.prisma.kontrollplanPunkt.create({
            data: {
              kontrollplanId: input.kontrollplanId,
              sjekklisteMalId: input.sjekklisteMalId,
              faggruppeId: input.faggruppeId,
              dokumentflytId: autoFlytId ?? undefined, // L1.6: entydig flyt auto-bundet
              milepelId: input.milepelId ?? undefined,
              omradeId: p.omradeId ?? undefined,
              fristUke: p.fristUke ?? undefined,
              fristAar: p.fristAar ?? undefined,
              importTaskUid: p.importTaskUid ?? undefined,
              importWbs: p.importWbs ?? undefined,
              importNavn: p.importNavn ?? undefined,
              importKildeId: importKildeId ?? undefined,
            },
            include: punktIncludes,
          })
        )
      );

      // Logg historikk for alle punkter
      await ctx.prisma.kontrollplanHistorikk.createMany({
        data: opprettet.map((punkt) => ({
          punktId: punkt.id,
          brukerId: ctx.userId,
          handling: "opprettet",
        })),
      });

      return { punkter: opprettet, importKildeId };
    }),

  // Grunnlag for revisjons-diff (del 2): eksisterende import-styrte punkter +
  // siste import med tilknyttede punkter (for hoppetOver + forrige-fil-metadata).
  hentRevisjonsgrunnlag: protectedProcedure
    .input(z.object({ kontrollplanId: z.string() }))
    .query(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);

      const punkter = await ctx.prisma.kontrollplanPunkt.findMany({
        where: { kontrollplanId: input.kontrollplanId, arkivert: false, importTaskUid: { not: null } },
        select: {
          id: true,
          importTaskUid: true,
          importWbs: true,
          importNavn: true,
          sjekklisteMalId: true,
          faggruppeId: true,
          milepelId: true,
          fristUke: true,
          fristAar: true,
          status: true,
          sjekklisteMal: { select: { name: true, prefix: true, kontrollomrade: true } },
          faggruppe: { select: { name: true, color: true } },
          milepel: { select: { navn: true } },
          sjekkliste: { select: { id: true, status: true } },
        },
      });

      // Siste import med minst ett tilknyttet punkt. Tomme importrader (feilet/
      // duplikat-import — importraden opprettes utenfor punkt-transaksjonen, se
      // opprettPunkter) skal ikke bidra med hoppetOver, ellers undertrykkes rader
      // brukeren aldri valgte bort. TODO (del 2) fra opprettPunkter, anvendt her.
      const importer = await ctx.prisma.kontrollplanImport.findMany({
        where: { kontrollplanId: input.kontrollplanId },
        orderBy: { importert: "desc" },
        select: {
          filnavn: true,
          importert: true,
          hoppetOver: true,
          _count: { select: { punkter: true } },
        },
      });
      const sisteImport = importer.find((i) => i._count.punkter > 0) ?? null;

      return {
        punkter,
        sisteImport: sisteImport
          ? {
              filnavn: sisteImport.filnavn,
              importert: sisteImport.importert,
              // Konkret form ved grensen — Prisma JsonValue er dypt rekursiv og gir
              // TS2589 hos klienten hvis den lekker gjennom tRPC-inferensen.
              hoppetOver: sisteImport.hoppetOver as unknown as { uid: number; navn: string; wbs: string | null }[],
            }
          : null,
      };
    }),

  // Anvend en revisjon (del 2). Skriver mange endringer på én gang: frist-
  // oppdateringer, nye punkter, arkivering, og levende rad-identitet (importNavn +
  // uid-oppgradering ved bekreftet antatt-samme). Tre krav:
  //  1. ÉN transaksjon — alt eller ingenting (halvveis anvendt revisjon er verre enn ingen).
  //  2. Hver substansielle endring logges i KontrollplanHistorikk (ikke bare «anvendt»).
  //  3. Frist oppdateres KUN på planlagt/pagar — utførte/godkjente røres aldri.
  anvendRevisjon: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      filnavn: z.string(),
      antallParsedeRader: z.number().int().min(0),
      // Levende identitet: alle UID-matchede + bekreftede antatt-samme. Oppdateres
      // ubetinget (navn alltid, uid ved antatt-oppgradering). Ikke logget — bokføring.
      identitetsOppdateringer: z.array(z.object({
        punktId: z.string(),
        nyImportTaskUid: z.number().int(),
        nyImportNavn: z.string(),
      })).default([]),
      // Frist-endringer å anvende (valgte sikre + bekreftede antatt). Logges.
      fristOppdateringer: z.array(z.object({
        punktId: z.string(),
        nyFristUke: z.number().int().min(1).max(53).nullable(),
        nyFristAar: z.number().int().min(2024).max(2100).nullable(),
      })).default([]),
      nyePunkter: z.array(z.object({
        sjekklisteMalId: z.string().uuid(),
        faggruppeId: z.string().uuid(),
        importTaskUid: z.number().int(),
        importWbs: z.string().nullable(),
        importNavn: z.string(),
        fristUke: z.number().int().min(1).max(53).nullable(),
        fristAar: z.number().int().min(2024).max(2100).nullable(),
      })).default([]),
      arkiverPunktIds: z.array(z.string()).default([]),
      hoppetOver: z.array(z.object({
        uid: z.number().int(),
        navn: z.string(),
        wbs: z.string().nullable(),
      })).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);

      const kommentar = `Revidert fra fremdriftsplan ${input.filnavn}`;
      const fristMap = new Map(input.fristOppdateringer.map((f) => [f.punktId, f]));

      await ctx.prisma.$transaction(async (tx) => {
        // Ny importhendelse for revisjonen (nye punkter knyttes hit, hoppetOver lagres).
        const imp = await tx.kontrollplanImport.create({
          data: {
            kontrollplanId: input.kontrollplanId,
            filnavn: input.filnavn,
            antallParsedeRader: input.antallParsedeRader,
            importertAvId: ctx.userId,
            hoppetOver: input.hoppetOver,
          },
        });

        // Identitet + frist på eksisterende punkter.
        for (const idn of input.identitetsOppdateringer) {
          const punkt = await tx.kontrollplanPunkt.findUniqueOrThrow({
            where: { id: idn.punktId },
            select: { status: true, kontrollplanId: true },
          });
          if (punkt.kontrollplanId !== input.kontrollplanId) continue; // prosjekt-/plan-isolasjon
          const frist = fristMap.get(idn.punktId);
          const settFrist = frist && (punkt.status === "planlagt" || punkt.status === "pagar");
          await tx.kontrollplanPunkt.update({
            where: { id: idn.punktId },
            data: {
              importTaskUid: idn.nyImportTaskUid,
              importNavn: idn.nyImportNavn,
              importKildeId: imp.id,
              ...(settFrist ? { fristUke: frist!.nyFristUke ?? undefined, fristAar: frist!.nyFristAar ?? undefined } : {}),
            },
          });
          if (settFrist) {
            await tx.kontrollplanHistorikk.create({
              data: { punktId: idn.punktId, brukerId: ctx.userId, handling: "endret", kommentar },
            });
          }
        }

        // Nye punkter. L1.6: auto-bind entydig flyt per mal (cache — nyePunkter kan
        // blande maler, men samme mal gir samme svar, så vi slår opp én gang hver).
        const flytCache = new Map<string, string | null>();
        for (const p of input.nyePunkter) {
          let autoFlytId = flytCache.get(p.sjekklisteMalId);
          if (autoFlytId === undefined) {
            autoFlytId = await finnEntydigFlytForMal(tx, {
              projectId: kontrollplan.projectId,
              sjekklisteMalId: p.sjekklisteMalId,
            });
            flytCache.set(p.sjekklisteMalId, autoFlytId);
          }
          const nytt = await tx.kontrollplanPunkt.create({
            data: {
              kontrollplanId: input.kontrollplanId,
              sjekklisteMalId: p.sjekklisteMalId,
              faggruppeId: p.faggruppeId,
              dokumentflytId: autoFlytId ?? undefined, // L1.6: entydig flyt auto-bundet
              importTaskUid: p.importTaskUid,
              importWbs: p.importWbs ?? undefined,
              importNavn: p.importNavn,
              importKildeId: imp.id,
              fristUke: p.fristUke ?? undefined,
              fristAar: p.fristAar ?? undefined,
            },
          });
          await tx.kontrollplanHistorikk.create({
            data: { punktId: nytt.id, brukerId: ctx.userId, handling: "opprettet", kommentar },
          });
        }

        // Arkivering (aldri auto-slett; sjekklister/utført arbeid røres ikke).
        for (const punktId of input.arkiverPunktIds) {
          const punkt = await tx.kontrollplanPunkt.findUniqueOrThrow({
            where: { id: punktId },
            select: { kontrollplanId: true },
          });
          if (punkt.kontrollplanId !== input.kontrollplanId) continue;
          await tx.kontrollplanPunkt.update({
            where: { id: punktId },
            data: { arkivert: true, arkivertDato: new Date() },
          });
          await tx.kontrollplanHistorikk.create({
            data: { punktId, brukerId: ctx.userId, handling: "arkivert", kommentar },
          });
        }
      });

      return {
        antallFrister: input.fristOppdateringer.length,
        antallNye: input.nyePunkter.length,
        antallArkivert: input.arkiverPunktIds.length,
      };
    }),

  // Oppdater et punkt (frist, faggruppe, status, milepæl, avhengighet)
  oppdaterPunkt: protectedProcedure
    .input(z.object({
      punktId: z.string(),
      sjekklisteMalId: z.string().uuid().optional(),
      faggruppeId: z.string().uuid().optional(),
      fristUke: z.number().int().min(1).max(53).nullish(),
      fristAar: z.number().int().min(2024).max(2100).nullish(),
      status: z.enum(["planlagt", "pagar", "utfort", "godkjent"]).optional(),
      milepelId: z.string().nullable().optional(),
      avhengerAvId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const punkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        include: { kontrollplan: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, punkt.kontrollplan.projectId);

      // Valider statusovergang
      if (input.status) {
        const gyldige: Record<string, string[]> = {
          planlagt: ["pagar"],
          pagar: ["utfort", "planlagt"],
          utfort: ["godkjent", "pagar"],
          godkjent: [],
        };
        if (!gyldige[punkt.status]?.includes(input.status)) {
          throw new Error(`Ugyldig statusovergang: ${punkt.status} → ${input.status}`);
        }
      }

      const { punktId, status, ...data } = input;
      const oppdatert = await ctx.prisma.kontrollplanPunkt.update({
        where: { id: punktId },
        data: {
          ...data,
          ...(status ? { status } : {}),
          ...(data.milepelId === null ? { milepelId: null } : {}),
          ...(data.avhengerAvId === null ? { avhengerAvId: null } : {}),
        },
        include: punktIncludes,
      });

      // Logg historikk
      const handling = status
        ? status === "pagar" ? "startet" : status === "utfort" ? "utfort" : status === "godkjent" ? "godkjent" : "endret"
        : "endret";
      await ctx.prisma.kontrollplanHistorikk.create({
        data: {
          punktId,
          brukerId: ctx.userId,
          handling,
        },
      });

      return oppdatert;
    }),

  // Slett punkt (kun planlagt)
  slettPunkt: protectedProcedure
    .input(z.object({ punktId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const punkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        include: { kontrollplan: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, punkt.kontrollplan.projectId);
      if (punkt.status !== "planlagt") {
        throw new Error("Kun planlagte punkter kan slettes");
      }
      return ctx.prisma.kontrollplanPunkt.delete({ where: { id: input.punktId } });
    }),

  // Koble en EKSISTERENDE sjekkliste til et kontrollpunkt (fyller punkt.sjekklisteId).
  // «Start» oppretter en ny sjekkliste via sjekkliste.opprett(kontrollplanPunktId) — denne
  // dekker det motsatte: sjekklister som ble laget FØR koblingen fantes (foreldreløse),
  // slik at en plan der arbeidet er gjort teller det umiddelbart. Malen må matche punktet.
  koblePunkt: protectedProcedure
    .input(z.object({ punktId: z.string(), sjekklisteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const punkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        include: { kontrollplan: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, punkt.kontrollplan.projectId);
      return ctx.prisma.$transaction(async (tx) => {
        await koblePunktTilSjekkliste(tx, {
          punktId: input.punktId,
          sjekklisteId: input.sjekklisteId,
          brukerId: ctx.userId,
          kilde: "koblet",
        });
        return tx.kontrollplanPunkt.findUniqueOrThrow({
          where: { id: input.punktId },
          include: punktIncludes,
        });
      });
    }),

  // Kandidat-sjekklister for «Koble eksisterende» på et punkt: samme mal (kobling krever
  // mal-match) og ennå ikke koblet til noe kontrollpunkt. Malen er prosjekt-spesifikk, så
  // templateId-filteret gir også riktig prosjekt-scope.
  hentKoblbareSjekklister: protectedProcedure
    .input(z.object({ punktId: z.string() }))
    .query(async ({ ctx, input }) => {
      const punkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        include: { kontrollplan: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, punkt.kontrollplan.projectId);
      return ctx.prisma.checklist.findMany({
        where: {
          ...IKKE_SLETTET,
          templateId: punkt.sjekklisteMalId,
          kontrollplanPunkt: { is: null },
        },
        select: {
          id: true,
          title: true,
          number: true,
          status: true,
          createdAt: true,
          byggeplass: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // L1.5: sett/tøm forhåndsvalgt dokumentflyt på ETT punkt. Admin-gated (verifiserAdmin
  // = prosjektadmin/firmaadmin/sitedoc_admin) — IKKE bare prosjektmedlem. Ellers kunne
  // enhver sette en flyt og så starte med registrator-bypass (auth-hullet cowork fanget):
  // settingen ER autorisasjonen, så den må kreve mer enn medlemskap.
  settPunktFlyt: protectedProcedure
    .input(z.object({ punktId: z.string(), dokumentflytId: z.string().uuid().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const punkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        select: { sjekklisteMalId: true, kontrollplan: { select: { projectId: true } } },
      });
      await verifiserAdmin(ctx.userId, punkt.kontrollplan.projectId);
      if (input.dokumentflytId) {
        await validerFlytForMal(ctx.prisma, {
          dokumentflytId: input.dokumentflytId,
          projectId: punkt.kontrollplan.projectId,
          sjekklisteMalId: punkt.sjekklisteMalId,
        });
      }
      await ctx.prisma.kontrollplanPunkt.update({
        where: { id: input.punktId },
        data: { dokumentflytId: input.dokumentflytId },
      });
      return ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        include: punktIncludes,
      });
    }),

  // L1.5 bulk: sett flyt på ALLE ikke-arkiverte punkter med samme mal i planen. En
  // importert fremdriftsplan gir mange punkter fra samme mal, og å sette flyt per punkt
  // blir uutholdelig. Hopper over punkter som alt har en ANNEN flyt (bevisst valg) — de
  // telles i hoppetOver, overskrives ikke stille (cowork-krav 2). Idempotent for samme
  // flyt. Klienten viser «sett på N punkter» fra allerede-lastede data før kall (krav 1).
  settFlytForMal: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      sjekklisteMalId: z.string().uuid(),
      dokumentflytId: z.string().uuid().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true },
      });
      await verifiserAdmin(ctx.userId, plan.projectId);
      const basis = {
        kontrollplanId: input.kontrollplanId,
        sjekklisteMalId: input.sjekklisteMalId,
        arkivert: false,
      };
      if (input.dokumentflytId === null) {
        // Tøm preset på alle punkter med malen (tilbake til registrator-regelen).
        const r = await ctx.prisma.kontrollplanPunkt.updateMany({ where: basis, data: { dokumentflytId: null } });
        return { oppdatert: r.count, hoppetOver: 0 };
      }
      await validerFlytForMal(ctx.prisma, {
        dokumentflytId: input.dokumentflytId,
        projectId: plan.projectId,
        sjekklisteMalId: input.sjekklisteMalId,
      });
      const [total, oppdatert] = await ctx.prisma.$transaction([
        ctx.prisma.kontrollplanPunkt.count({ where: basis }),
        ctx.prisma.kontrollplanPunkt.updateMany({
          where: { ...basis, OR: [{ dokumentflytId: null }, { dokumentflytId: input.dokumentflytId }] },
          data: { dokumentflytId: input.dokumentflytId },
        }),
      ]);
      return { oppdatert: oppdatert.count, hoppetOver: total - oppdatert.count };
    }),

  // L2: kontrollpunkt-markører for én tegning. Speiler oppgave.hentForTegning — kun
  // punkter plassert på tegningen (positionX/Y satt). Tilstandsfeltene (status, sjekkliste,
  // frist, varselUkerFor) lar klienten farge markøren med avledPunktTilstand — samme
  // fargemodell som liste/rutenett, så tegningen aldri drifter fra dem.
  hentForTegning: protectedProcedure
    .input(z.object({ drawingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const drawing = await ctx.prisma.drawing.findUniqueOrThrow({
        where: { id: input.drawingId },
        select: { byggeplass: { select: { projectId: true } } },
      });
      if (!drawing.byggeplass) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tegningen er ikke tilknyttet en lokasjon" });
      }
      await verifiserProsjektmedlem(ctx.userId, drawing.byggeplass.projectId);
      return ctx.prisma.kontrollplanPunkt.findMany({
        where: { drawingId: input.drawingId, positionX: { not: null }, positionY: { not: null }, arkivert: false },
        select: {
          id: true,
          positionX: true,
          positionY: true,
          status: true,
          fristUke: true,
          fristAar: true,
          varselUkerFor: true,
          sjekkliste: { select: { id: true, status: true } },
          sjekklisteMal: { select: { prefix: true, name: true } },
        },
      });
    }),

  // L2: sett/tøm plassering av et punkt på en tegning. Plan-redigering (prosjektmedlem),
  // IKKE admin — plassering er ikke en auth-sensitiv bypass slik flytvalget var. Posisjon
  // er prosent (0-100) av bilde-containeren, samme koordinatmodell som oppgave/sjekkliste.
  settPunktPlassering: protectedProcedure
    .input(z.object({
      punktId: z.string(),
      drawingId: z.string().uuid().nullable(),
      positionX: z.number().min(0).max(100).nullable(),
      positionY: z.number().min(0).max(100).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const punkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        select: { kontrollplan: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, punkt.kontrollplan.projectId);
      // Prosjektisolering: tegningen må høre til samme prosjekt som punktet.
      if (input.drawingId) {
        const drawing = await ctx.prisma.drawing.findUnique({
          where: { id: input.drawingId },
          select: { byggeplass: { select: { projectId: true } } },
        });
        if (!drawing?.byggeplass || drawing.byggeplass.projectId !== punkt.kontrollplan.projectId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Tegningen hører til et annet prosjekt enn kontrollpunktet." });
        }
      }
      // Fjernes tegningen, tømmes også posisjonen (drawingId null → posisjon meningsløs).
      await ctx.prisma.kontrollplanPunkt.update({
        where: { id: input.punktId },
        data: input.drawingId
          ? { drawingId: input.drawingId, positionX: input.positionX, positionY: input.positionY }
          : { drawingId: null, positionX: null, positionY: null },
      });
      return ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({ where: { id: input.punktId }, include: punktIncludes });
    }),

  // Opprett milepæl
  opprettMilepel: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      navn: z.string().min(1),
      maalUke: z.number().int().min(1).max(53),
      maalAar: z.number().int().min(2024).max(2100),
    }))
    .mutation(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);
      const maks = await ctx.prisma.milepel.aggregate({
        where: { kontrollplanId: input.kontrollplanId },
        _max: { sortering: true },
      });
      return ctx.prisma.milepel.create({
        data: {
          ...input,
          sortering: (maks._max.sortering ?? 0) + 1,
        },
      });
    }),

  // Oppdater milepæl
  oppdaterMilepel: protectedProcedure
    .input(z.object({
      milepelId: z.string(),
      navn: z.string().min(1).optional(),
      maalUke: z.number().int().min(1).max(53).optional(),
      maalAar: z.number().int().min(2024).max(2100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const milepel = await ctx.prisma.milepel.findUniqueOrThrow({
        where: { id: input.milepelId },
        include: { kontrollplan: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, milepel.kontrollplan.projectId);
      const { milepelId, ...data } = input;
      return ctx.prisma.milepel.update({ where: { id: milepelId }, data });
    }),

  // Slett milepæl (kun hvis ingen punkter tilknyttet)
  slettMilepel: protectedProcedure
    .input(z.object({ milepelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const milepel = await ctx.prisma.milepel.findUniqueOrThrow({
        where: { id: input.milepelId },
        include: {
          kontrollplan: { select: { projectId: true } },
          _count: { select: { punkter: true } },
        },
      });
      await verifiserProsjektmedlem(ctx.userId, milepel.kontrollplan.projectId);
      if (milepel._count.punkter > 0) {
        throw new Error("Kan ikke slette milepæl med tilknyttede punkter");
      }
      return ctx.prisma.milepel.delete({ where: { id: input.milepelId } });
    }),

  // Oppdater kontrollplan-status (livssyklus)
  oppdaterStatus: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      status: z.enum(["utkast", "aktiv", "godkjent", "arkivert"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true, status: true },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);

      const gyldige: Record<string, string[]> = {
        utkast: ["aktiv"],
        aktiv: ["godkjent"],
        godkjent: ["arkivert"],
        arkivert: [],
      };
      if (!gyldige[kontrollplan.status]?.includes(input.status)) {
        throw new Error(`Ugyldig statusovergang: ${kontrollplan.status} → ${input.status}`);
      }

      return ctx.prisma.kontrollplan.update({
        where: { id: input.kontrollplanId },
        data: {
          status: input.status,
          ...(input.status === "godkjent" ? { godkjentDato: new Date(), godkjentAvId: ctx.userId } : {}),
        },
      });
    }),

  // Skyv frister for et område +/- N uker
  skyvOmrade: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      omradeId: z.string(),
      antallUker: z.number().int(), // positiv = fremover, negativ = bakover
    }))
    .mutation(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);

      // Hent alle punkter for dette området i denne kontrollplanen
      const punkter = await ctx.prisma.kontrollplanPunkt.findMany({
        where: { kontrollplanId: input.kontrollplanId, omradeId: input.omradeId },
      });

      // Skyv frist kun for planlagte og pågående punkter (ikke utført/godkjent)
      const oppdateringer = punkter
        .filter((p) => p.fristUke !== null && p.fristAar !== null && (p.status === "planlagt" || p.status === "pagar"))
        .map((p) => {
          let nyUke = (p.fristUke ?? 0) + input.antallUker;
          let nyAar = p.fristAar ?? new Date().getFullYear();
          // Håndter uke-overflyt
          while (nyUke > 52) { nyUke -= 52; nyAar++; }
          while (nyUke < 1) { nyUke += 52; nyAar--; }
          return ctx.prisma.kontrollplanPunkt.update({
            where: { id: p.id },
            data: { fristUke: nyUke, fristAar: nyAar },
          });
        });

      await ctx.prisma.$transaction(oppdateringer);

      // Logg historikk
      await ctx.prisma.kontrollplanHistorikk.createMany({
        data: punkter.map((p) => ({
          punktId: p.id,
          brukerId: ctx.userId,
          handling: "endret",
          kommentar: `Frist forskjøvet ${input.antallUker > 0 ? "+" : ""}${input.antallUker} uker (område-skyv)`,
        })),
      });

      return { antallOppdatert: oppdateringer.length };
    }),

  // Kopier punkter fra ett sett områder til et annet (f.eks. etasje 3 → etasje 4)
  kopierPunkter: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      kildeOmradeIder: z.array(z.string()).min(1),
      maalOmradeIder: z.array(z.string()).min(1),
      fristForskyvningUker: z.number().int().default(0), // skyv frister +N uker
    }))
    .mutation(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        select: { projectId: true },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);

      // Hent alle punkter fra kilde-områdene
      const kildePunkter = await ctx.prisma.kontrollplanPunkt.findMany({
        where: { kontrollplanId: input.kontrollplanId, omradeId: { in: input.kildeOmradeIder } },
      });

      // Opprett kopier for hvert mål-område
      const nyePunkter = [];
      for (const maalOmradeId of input.maalOmradeIder) {
        for (const kilde of kildePunkter) {
          let fristUke = kilde.fristUke;
          let fristAar = kilde.fristAar;
          if (fristUke !== null && fristAar !== null && input.fristForskyvningUker !== 0) {
            fristUke += input.fristForskyvningUker;
            while (fristUke > 52) { fristUke -= 52; fristAar++; }
            while (fristUke < 1) { fristUke += 52; fristAar--; }
          }
          nyePunkter.push({
            kontrollplanId: input.kontrollplanId,
            sjekklisteMalId: kilde.sjekklisteMalId,
            faggruppeId: kilde.faggruppeId,
            // L1.6: kopien arver kildens flyt-binding (auto-satt ELLER admin-valgt) —
            // riktigere enn å re-derivere, som kunne avvike fra et bevisst valg på kilden.
            dokumentflytId: kilde.dokumentflytId,
            milepelId: kilde.milepelId,
            omradeId: maalOmradeId,
            fristUke,
            fristAar,
            varselUkerFor: kilde.varselUkerFor,
          });
        }
      }

      // Filtrer ut duplikater (eksisterende kontrollplan_id+omrade_id+mal_id)
      const eksisterende = await ctx.prisma.kontrollplanPunkt.findMany({
        where: { kontrollplanId: input.kontrollplanId, omradeId: { in: input.maalOmradeIder } },
        select: { omradeId: true, sjekklisteMalId: true },
      });
      const eksisterendeSet = new Set(eksisterende.map((e) => `${e.omradeId}:${e.sjekklisteMalId}`));
      const unikePunkter = nyePunkter.filter((p) => !eksisterendeSet.has(`${p.omradeId}:${p.sjekklisteMalId}`));

      if (unikePunkter.length === 0) return { antallOpprettet: 0 };

      await ctx.prisma.kontrollplanPunkt.createMany({ data: unikePunkter });

      return { antallOpprettet: unikePunkter.length };
    }),

  // Kaskade-fristflytting — finn og skyv alle nedstrøms avhengigheter
  skyvKaskade: protectedProcedure
    .input(z.object({
      punktId: z.string(),
      antallUker: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      const startPunkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        include: { kontrollplan: { select: { projectId: true, id: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, startPunkt.kontrollplan.projectId);

      // Finn alle punkter i kontrollplanen
      const allePunkter = await ctx.prisma.kontrollplanPunkt.findMany({
        where: { kontrollplanId: startPunkt.kontrollplan.id },
      });

      // Traverser avhengighetsgrafen rekursivt for å finne alle nedstrøms punkter
      const berort = new Set<string>();
      function finnNedstroms(punktId: string) {
        for (const p of allePunkter) {
          if (p.avhengerAvId === punktId && !berort.has(p.id)) {
            berort.add(p.id);
            finnNedstroms(p.id);
          }
        }
      }
      berort.add(input.punktId);
      finnNedstroms(input.punktId);

      // Skyv frist for alle berørte punkter (kun planlagt/pågår)
      const oppdateringer = allePunkter
        .filter((p) => berort.has(p.id) && p.fristUke !== null && p.fristAar !== null && (p.status === "planlagt" || p.status === "pagar"))
        .map((p) => {
          let nyUke = (p.fristUke ?? 0) + input.antallUker;
          let nyAar = p.fristAar ?? new Date().getFullYear();
          while (nyUke > 52) { nyUke -= 52; nyAar++; }
          while (nyUke < 1) { nyUke += 52; nyAar--; }
          return ctx.prisma.kontrollplanPunkt.update({
            where: { id: p.id },
            data: { fristUke: nyUke, fristAar: nyAar },
          });
        });

      await ctx.prisma.$transaction(oppdateringer);

      // Logg historikk
      await ctx.prisma.kontrollplanHistorikk.createMany({
        data: [...berort].map((pid) => ({
          punktId: pid,
          brukerId: ctx.userId,
          handling: "endret",
          kommentar: `Kaskade-flytt ${input.antallUker > 0 ? "+" : ""}${input.antallUker} uker fra punkt ${input.punktId}`,
        })),
      });

      return { antallBerort: berort.size, antallOppdatert: oppdateringer.length };
    }),

  // Forhåndsvisning kaskade — finn berørte punkter uten å endre
  hentKaskadeBerort: protectedProcedure
    .input(z.object({ punktId: z.string() }))
    .query(async ({ ctx, input }) => {
      const startPunkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        include: { kontrollplan: { select: { projectId: true, id: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, startPunkt.kontrollplan.projectId);

      const allePunkter = await ctx.prisma.kontrollplanPunkt.findMany({
        where: { kontrollplanId: startPunkt.kontrollplan.id },
        include: {
          sjekklisteMal: { select: { name: true } },
          omrade: { select: { navn: true } },
        },
      });

      const berort: string[] = [];
      function finnNedstroms(punktId: string) {
        for (const p of allePunkter) {
          if (p.avhengerAvId === punktId && !berort.includes(p.id)) {
            berort.push(p.id);
            finnNedstroms(p.id);
          }
        }
      }
      finnNedstroms(input.punktId);

      return allePunkter
        .filter((p) => berort.includes(p.id))
        .map((p) => ({
          id: p.id,
          malNavn: p.sjekklisteMal.name,
          omradeNavn: p.omrade?.navn ?? "—",
          fristUke: p.fristUke,
          fristAar: p.fristAar,
          status: p.status,
        }));
    }),

  // Hent historikk for et punkt
  hentHistorikk: protectedProcedure
    .input(z.object({ punktId: z.string() }))
    .query(async ({ ctx, input }) => {
      const punkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
        where: { id: input.punktId },
        include: { kontrollplan: { select: { projectId: true } } },
      });
      await verifiserProsjektmedlem(ctx.userId, punkt.kontrollplan.projectId);
      return ctx.prisma.kontrollplanHistorikk.findMany({
        where: { punktId: input.punktId },
        include: { bruker: { select: { name: true } } },
        orderBy: { tidspunkt: "desc" },
      });
    }),

  // Hent sluttrapport-data (SAK10 §14-7)
  hentSluttrapportData: protectedProcedure
    .input(z.object({
      kontrollplanId: z.string(),
      kontrollomrade: z.string().nullable(),
    }))
    .query(async ({ ctx, input }) => {
      const kontrollplan = await ctx.prisma.kontrollplan.findUniqueOrThrow({
        where: { id: input.kontrollplanId },
        include: {
          project: {
            select: {
              name: true,
              projectNumber: true,
              externalProjectNumber: true,
              internalProjectNumber: true,
              visSiteDocNummer: true,
              utskriftsinnstillinger: true,
            },
          },
          byggeplass: { select: { name: true } },
          punkter: {
            include: {
              sjekklisteMal: { select: { name: true, kontrollomrade: true } },
              faggruppe: { select: { name: true } },
              omrade: { select: { navn: true } },
              historikk: {
                where: { handling: { in: ["avvist", "godkjent"] } },
                select: { handling: true, kommentar: true, tidspunkt: true },
                orderBy: { tidspunkt: "desc" },
              },
            },
            orderBy: { opprettet: "asc" },
          },
        },
      });
      await verifiserProsjektmedlem(ctx.userId, kontrollplan.projectId);

      const punkter = input.kontrollomrade
        ? kontrollplan.punkter.filter((p) => p.sjekklisteMal.kontrollomrade === input.kontrollomrade)
        : kontrollplan.punkter;

      return {
        kontrollplanNavn: kontrollplan.navn,
        byggeplassNavn: kontrollplan.byggeplass.name,
        kontrollomrade: input.kontrollomrade,
        // Prosjektreferansen bygges av utskriftsgeneratoren via den delte
        // fallback-kjeden (eksternt → internt → SD), lik sjekkliste-/oppgave-
        // utskrift — ikke SD hardkodet. Se terminologi.md § Tre prosjektnumre.
        prosjekt: {
          name: kontrollplan.project.name,
          projectNumber: kontrollplan.project.projectNumber,
          externalProjectNumber: kontrollplan.project.externalProjectNumber,
          internalProjectNumber: kontrollplan.project.internalProjectNumber,
          visSiteDocNummer: kontrollplan.project.visSiteDocNummer,
        },
        innstillinger:
          (kontrollplan.project.utskriftsinnstillinger as {
            eksternProsjektnummer?: boolean;
          } | null) ?? null,
        punkter: punkter.map((p) => ({
          omradeNavn: p.omrade?.navn ?? "—",
          malNavn: p.sjekklisteMal.name,
          status: p.status,
          faggruppe: p.faggruppe.name,
          godkjentDato: p.historikk.find((h) => h.handling === "godkjent")?.tidspunkt?.toISOString() ?? null,
          avvikKommentarer: p.historikk.filter((h) => h.handling === "avvist" && h.kommentar).map((h) => h.kommentar!),
        })),
      };
    }),

  // Hent kontrollplan-status for alle byggeplasser (modul-kort)
  hentStatusForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const byggeplasser = await ctx.prisma.byggeplass.findMany({
        where: { projectId: input.projectId },
        select: {
          id: true,
          name: true,
          kontrollplaner: {
            select: {
              id: true,
              status: true,
              _count: { select: { punkter: true } },
            },
          },
        },
        orderBy: { number: "asc" },
      });
      return byggeplasser.map((b) => ({
        id: b.id,
        name: b.name,
        kontrollplan: b.kontrollplaner[0] ?? null,
      }));
    }),
});
