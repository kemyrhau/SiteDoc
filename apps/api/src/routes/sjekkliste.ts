import { z } from "zod";
import type { Prisma } from "@sitedoc/db";
import { kanonisk, likForDiff } from "@sitedoc/pdf";
import { router, protectedProcedure } from "../trpc/trpc";
import { documentStatusSchema } from "@sitedoc/shared";
import { isValidStatusTransition, statusKreverBegrunnelse } from "@sitedoc/shared";
import { grenseNaadd } from "@sitedoc/shared";
import { beregnSkyggeFakta, hentPosisjonsLedd, hentFlytMedlemmer, beregnRuting, avledetStatus } from "../services/flytFakta";
import { koblePunktTilSjekkliste, verifiserTegningIProsjekt } from "../services/kontrollplanKobling";
import { TRPCError } from "@trpc/server";
import { signerBilder, signerDataRad, signerDataRader } from "../utils/vedleggSignering";
import {
  byggTilgangsFilter,
  verifiserFaggruppeTilhorighet,
  verifiserDokumentTilgang,
  verifiserRetningsrett,
  byggFlytBruker,
  verifiserHmsHandling,
  verifiserProsjektmedlem,
  hentBrukersOpprettFlytMedlemskap,
  hentBrukerTillatelser,
  hentBrukerProsjektTilgang,
  finnBrukersBoks,
  kanByttFlyt,
} from "../trpc/tilgangskontroll";
import { sendDokumentVarsling, hentMottakerEposter } from "../services/epost";
import { IKKE_SLETTET } from "../utils/softDelete";
import { erStandaloneProsjekt } from "../utils/prosjektGrense";
import { oversettFritekst } from "../services/oversettelse-service";
import { byggTransferSnapshot } from "../services/transfer-snapshot";
import { hentVaerHourly } from "../services/vaer";
import { resolverVentendeVaer, vaerFeltIder } from "../services/vaer-finalisering";

// Felttyper der verdi er fritekst som skal oversettes
const FRITEKST_TYPER = new Set(["text_field"]);

/**
 * Funn C (bilder i raden): sett `url` på ett vedlegg (matchet på `id`) hvor enn
 * det ligger i `Checklist.data` — topp-nivå ELLER repeater-/attachments-nestet.
 * Muterer `node` in place (kalleren jobber på en dyp kopi). Returnerer `true`
 * hvis minst ett vedlegg ble truffet.
 */
function settUrlPaaVedlegg(
  node: unknown,
  vedleggId: string,
  url: string,
  filnavn: string | undefined,
): boolean {
  if (Array.isArray(node)) {
    let endret = false;
    for (const n of node) {
      if (settUrlPaaVedlegg(n, vedleggId, url, filnavn)) endret = true;
    }
    return endret;
  }
  if (node !== null && typeof node === "object") {
    const o = node as Record<string, unknown>;
    let endret = false;
    if (o.id === vedleggId && typeof o.url === "string") {
      o.url = url;
      if (filnavn) o.filnavn = filnavn;
      endret = true;
    }
    for (const v of Object.values(o)) {
      if (settUrlPaaVedlegg(v, vedleggId, url, filnavn)) endret = true;
    }
    return endret;
  }
  return false;
}

// ---------- Dedikert HMS-løp (D1/D2) ----------

/**
 * Send HMS-varsel via delt e-postmekanikk (`sendDokumentVarsling`/
 * `hentMottakerEposter`). Brann-og-glem — kaster aldri (varsling skal ikke
 * blokkere handlingen).
 */
async function sendHmsVarsel(
  prisma: Parameters<typeof hentMottakerEposter>[0],
  opts: {
    dokumentId: string;
    tittel: string | null;
    nummer: number | null;
    prefix: string | null;
    projectId: string;
    prosjektNavn: string;
    avsenderId: string;
    recipientUserId?: string | null;
    recipientGroupId?: string | null;
    kommentar?: string;
  },
): Promise<void> {
  const eposter = await hentMottakerEposter(prisma, {
    recipientUserId: opts.recipientUserId ?? undefined,
    recipientGroupId: opts.recipientGroupId ?? undefined,
    ekskluderUserId: opts.avsenderId,
  });
  if (eposter.length === 0) return;
  const avsender = await prisma.user.findUnique({
    where: { id: opts.avsenderId },
    select: { name: true },
  });
  const nummer =
    opts.prefix && opts.nummer
      ? `${opts.prefix}-${String(opts.nummer).padStart(3, "0")}`
      : undefined;
  void sendDokumentVarsling({
    til: eposter,
    dokumentType: "sjekkliste",
    dokumentTittel: opts.tittel ?? "Uten tittel",
    dokumentNummer: nummer,
    prosjektNavn: opts.prosjektNavn,
    prosjektId: opts.projectId,
    dokumentId: opts.dokumentId,
    avsenderNavn: avsender?.name ?? "Ukjent",
    kommentar: opts.kommentar,
    erVideresending: false,
  });
}

/**
 * Hent HMS-sjekklisten med feltene HMS-mutasjonene trenger, og verifiser at
 * dokumentet faktisk er HMS (`domain="hms"`) — ellers hører det hjemme i den
 * generelle statusmaskinen (`endreStatus`), ikke i HMS-løpet.
 */
async function hentHmsSjekkliste(
  prisma: Parameters<typeof hentMottakerEposter>[0],
  id: string,
) {
  const sjekkliste = await prisma.checklist.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      status: true,
      title: true,
      number: true,
      bestillerUserId: true,
      recipientGroupId: true,
      dokumentflytId: true,
      aktivPosisjon: true,
      template: {
        select: {
          domain: true,
          projectId: true,
          prefix: true,
          project: { select: { name: true } },
        },
      },
    },
  });
  if (sjekkliste.template.domain !== "hms") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Dette er ikke et HMS-dokument",
    });
  }
  return sjekkliste;
}

export const sjekklisteRouter = router({
  // Hent alle sjekklister for et prosjekt (via mal)
  hentForProsjekt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: documentStatusSchema.optional(),
        byggeplassId: z.string().uuid().optional(),
        // Hvis utelatt: ekskluder HMS-dokumenter (de vises på egen HMS-side).
        // Eksplisitt verdi filtrerer på det domenet.
        domain: z.enum(["bygg", "hms", "kvalitet"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tilgangsFilter = await byggTilgangsFilter(ctx.userId, input.projectId);
      const templateDomainFilter = input.domain
        ? { domain: input.domain }
        : { domain: { not: "hms" } };

      const sjekklister = await ctx.prisma.checklist.findMany({
        where: {
          ...IKKE_SLETTET,
          template: { projectId: input.projectId, ...templateDomainFilter },
          ...(input.status ? { status: input.status } : {}),
          ...(input.byggeplassId ? { OR: [{ byggeplassId: input.byggeplassId }, { byggeplassId: null }] } : {}),
          ...(tilgangsFilter ?? {}),
        },
        include: {
          template: { include: { objects: { select: { id: true, label: true, type: true, config: true } } } },
          bestillerFaggruppe: true,
          utforerFaggruppe: true,
          bestiller: true,
          byggeplass: { select: { id: true, name: true, number: true } },
          drawing: { select: { id: true, name: true, floor: true } },
          recipientUser: { select: { id: true, name: true } },
          recipientGroup: { select: { id: true, name: true } },
          dokumentflyt: {
            select: {
              id: true,
              name: true,
              medlemmer: {
                select: {
                  id: true,
                  rolle: true,
                  steg: true,
                  // Fase 4 output-plumbing (read-only): posisjons-felt klienten trenger for
                  // byggPosisjonsLedd + ansvarsmerke-avledning + harBallenPosisjon.
                  klassifisering: true,
                  kanTerminereUtenBall: true,
                  erHovedansvarlig: true,
                  faggruppe: { select: { id: true, name: true } },
                  projectMember: { include: { user: { select: { id: true, name: true } } } },
                  group: { select: { id: true, name: true } },
                },
                orderBy: { steg: "asc" },
              },
            },
          },
          _count: { select: { images: true, transfers: true } },
          // Kontrollplan-kobling: klienten skiller «hører til kontrollplanen» fra
          // «kommer i tillegg» via denne relasjonen (ingen nytt felt — relasjonen finnes).
          kontrollplanPunkt: { select: { id: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
      // S1 Fase 1b: signér vedlegg-URL i data ved emisjon (liste-vei).
      return signerDataRader(sjekklister);
    }),

  // Hent én sjekkliste med alle detaljer
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: { include: { objects: { orderBy: { sortOrder: "asc" } }, project: { select: { sourceLanguage: true } } } },
          bestillerFaggruppe: true,
          utforerFaggruppe: true,
          bestiller: true,
          recipientGroup: { select: { id: true, name: true } },
          byggeplass: { select: { id: true, name: true } },
          drawing: { select: { id: true, name: true, drawingNumber: true, fileUrl: true, imageWidth: true, imageHeight: true } },
          images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] },
          transfers: {
            include: {
              sender: { select: { id: true, name: true } },
              recipientUser: { select: { id: true, name: true } },
              recipientGroup: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          changeLog: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      // Tilgangssjekk — hent projectId, domain og hmsSynlighet fra malen.
      // hmsSynlighet sendes inn slik at "apen" HMS-dokumenter er lesbare for alle
      // prosjektmedlemmer (lesing — mutations beholder streng tilgang).
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.bestillerFaggruppeId,
        sjekkliste.utforerFaggruppeId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
        sjekkliste.template.hmsSynlighet,
      );

      // Sett lestAvMottakerVed når mottaker åpner mens status er «sent»
      if (
        sjekkliste.status === "sent" &&
        sjekkliste.recipientUserId === ctx.userId &&
        !sjekkliste.lestAvMottakerVed
      ) {
        await ctx.prisma.checklist.update({
          where: { id: sjekkliste.id },
          data: { lestAvMottakerVed: new Date() },
        });
        sjekkliste.lestAvMottakerVed = new Date();
      }

      // S1 Fase 1b: signér vedlegg-URL i data + images-relasjonen ved emisjon
      // (detalj- + utskriftsvei leser bilde-URL herfra).
      return { ...signerDataRad(sjekkliste), images: signerBilder(sjekkliste.images) };
    }),

  // Opprett ny sjekkliste
  opprett: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        bestillerFaggruppeId: z.string().uuid().optional(),
        utforerFaggruppeId: z.string().uuid().optional(),
        title: z.string().max(255).optional(),
        dokumentflytId: z.string().uuid().optional(),
        subject: z.string().max(500).optional(),
        byggeplassId: z.string().uuid().optional(),
        drawingId: z.string().uuid().optional(),
        // Punkt-i-tegning (prosent 0–100) når sjekklisten opprettes fra en
        // plassering på tegning/kart — speiler oppgave.opprett-kontrakten.
        positionX: z.number().min(0).max(100).optional(),
        positionY: z.number().min(0).max(100).optional(),
        dueDate: z.string().datetime().optional(),
        // Kontrollplan: er dette settet, kobles den nye sjekklisten atomisk til
        // kontrollpunktet (fyller punkt.sjekklisteId, løfter planlagt→pagar) i samme
        // transaksjon. Én sjekkliste opprettet fra et startbart kontrollpunkt.
        // KontrollplanPunkt.id er cuid() (ikke uuid) — valider som fri string,
        // slik koblePunkt og alle andre punktId-referanser gjør. `.uuid()` her
        // avviste ethvert ekte punkt og brøt hele «Start»-veien (fanget av
        // skjermbilde-gaten 2026-08-14). Hjelperen validerer eksistens/prosjekt/mal.
        kontrollplanPunktId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Hent malen for å sjekke domain (HMS vs standard)
      const malForDomain = await ctx.prisma.reportTemplate.findUniqueOrThrow({
        where: { id: input.templateId },
        select: { domain: true, projectId: true },
      });
      const erHms = malForDomain.domain === "hms";

      // L1.5: kontrollplan-start med FORHÅNDSVALGT flyt på punktet (satt av admin via
      // settPunktFlyt). Er feltet satt, er flyten plan-autorisert: Start bruker den
      // direkte, uavhengig av hvem som trykker. Server utleder bestiller/utfører fra
      // flyten (stoler ikke på klienten) og hopper over registrator-/bestiller-
      // medlemssjekken. Tilgangsgulv: klikkeren må være prosjektmedlem. Er feltet null,
      // er alt uendret (dagens registrator-regel). Effektiv-variablene defaulter til
      // klientens input, så den vanlige opprett-veien er urørt.
      let effektivFlytId = input.dokumentflytId;
      let effektivBestiller = input.bestillerFaggruppeId;
      let effektivUtforer = input.utforerFaggruppeId;
      let planAutorisertFlyt = false;
      if (input.kontrollplanPunktId) {
        const startPunkt = await ctx.prisma.kontrollplanPunkt.findUniqueOrThrow({
          where: { id: input.kontrollplanPunktId },
          select: { dokumentflytId: true, faggruppeId: true, kontrollplan: { select: { projectId: true } } },
        });
        if (startPunkt.dokumentflytId) {
          planAutorisertFlyt = true;
          const flyt = await ctx.prisma.dokumentflyt.findUniqueOrThrow({
            where: { id: startPunkt.dokumentflytId },
            select: {
              faggruppeId: true,
              medlemmer: {
                where: { rolle: "utforer", periodeSlutt: null },
                select: { faggruppeId: true },
              },
            },
          });
          // Bestiller = flytens eier-faggruppe; utfører = flytens utfører-medlem-
          // faggruppe, fallback eier. settPunktFlyt garanterer at flyten har eier-
          // faggruppe og bruker malen, så effektivBestiller er aldri null her.
          effektivFlytId = startPunkt.dokumentflytId;
          effektivBestiller = flyt.faggruppeId ?? undefined;
          effektivUtforer = flyt.medlemmer[0]?.faggruppeId ?? flyt.faggruppeId ?? undefined;
          // L1.6: gulvet er IKKE lenger «prosjektmedlem» — klikkeren må tilhøre PUNKTETS
          // faggruppe. Planen sier allerede hvem som utfører kontrollen; det er grensen.
          // verifiserFaggruppeTilhorighet har admin-bypass og flyt-registrator-alternativ,
          // så en admin eller flyt-oppretter kan fortsatt starte. Lukker L1.5-hullet der
          // ethvert prosjektmedlem kunne starte et preset-punkt uten å tilhøre faggruppen.
          await verifiserFaggruppeTilhorighet(ctx.userId, startPunkt.faggruppeId);
        }
      }

      // HMS-sjekklister (SJA, RUH): auto-rut til HMS-gruppen, ingen faggruppe.
      // Speiler oppgave.opprett-mønsteret for HMS.
      let recipientGroupId: string | undefined;
      // F1b (HMS flyt-binding): server slår opp prosjektets HMS-flyt og binder
      // dokumentet til den (klienten sender fortsatt ikke dokumentflytId for HMS).
      let hmsFlytId: string | undefined;
      if (erHms) {
        // Klienten kan ikke binde HMS til en flyt manuelt — HMS auto-rutes. En
        // innsendt dokumentflytId er en config-feil; fail loud. (Serveren binder
        // selv til HMS-flyten nedenfor, F1b.)
        if (input.dokumentflytId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "HMS-sjekklister rutes automatisk til HMS-gruppen og kan ikke bindes til en dokumentflyt",
          });
        }
        await verifiserProsjektmedlem(ctx.userId, malForDomain.projectId);

        const hmsGruppe = await ctx.prisma.projectGroup.findFirst({
          where: {
            projectId: malForDomain.projectId,
            domains: { array_contains: ["hms"] },
          },
          select: { id: true },
        });
        if (!hmsGruppe) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "HMS-gruppe ikke konfigurert i dette prosjektet. Aktiver HMS-modulen på nytt under Oppsett → Moduler.",
          });
        }
        recipientGroupId = hmsGruppe.id;

        // F1b: bind HMS-dokumentet til prosjektets HMS-flyt (oppretter → HMS-gruppe,
        // 2 ledd). Flyten seedes ved modul-aktivering (modul.ts). Finnes den ikke
        // (gammelt prosjekt / modul aldri aktivert) → hmsFlytId undefined → dokumentet
        // forblir flyt-løst (dagens oppførsel), graceful degradering.
        const hmsFlytMal = await ctx.prisma.dokumentflytMal.findFirst({
          where: { templateId: input.templateId },
          select: { dokumentflytId: true },
        });
        hmsFlytId = hmsFlytMal?.dokumentflytId ?? undefined;
      } else {
        // Standard-gren (F1/B1): et dokument tilhører ALLTID nøyaktig én flyt.
        // dokumentflytId påkrevd her (ikke i Zod — HMS-grenen utelater den legitimt).
        // effektivFlytId = klientens flyt, ELLER punktets forhåndsvalgte flyt (L1.5).
        if (!effektivFlytId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Dokumentflyt er påkrevd for denne sjekklistetypen. Velg en flyt som bruker malen.",
          });
        }
        // Standard: faggrupper påkrevd
        if (!effektivBestiller || !effektivUtforer) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Bestiller- og utfører-faggruppe er påkrevd for denne sjekklistetypen",
          });
        }
        // Plan-autorisert flyt (L1.5): bestiller kommer fra flyten, ikke klikkerens
        // faggruppe — hopp over tilhørighetssjekken. Ellers: klikkeren må tilhøre bestiller.
        if (!planAutorisertFlyt) {
          await verifiserFaggruppeTilhorighet(ctx.userId, effektivBestiller);
        }

        const bruker = await ctx.prisma.user.findUniqueOrThrow({
          where: { id: ctx.userId },
          select: { role: true },
        });

        // F1/B2: server stoler ikke på klienten. Valider at (a) flyten har den valgte
        // malen og (b) brukeren er oppretter-medlem av flyten — dvs. medlem med
        // oppretter-rollen (lagret som "registrator"), ikke enhver rolle (Kenneth-vedtak
        // 2026-07-24). Ingen bypass: også sitedoc_admin og prosjektadmin må være
        // registrator-medlem av flyten for å opprette (F1-oppfølger, Kenneth-vedtak
        // 2026-07-24) — admin legger seg selv i en flyt som registrator ved behov.
        const flytHarMal = await ctx.prisma.dokumentflytMal.findFirst({
          where: { dokumentflytId: effektivFlytId, templateId: input.templateId },
          select: { id: true },
        });
        if (!flytHarMal) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Valgt dokumentflyt bruker ikke denne malen",
          });
        }
        // Registrator-gaten gjelder KUN klient-valgt flyt. Er flyten forhåndsvalgt på
        // punktet (L1.5), er den plan-autorisert av en admin — Start er da uavhengig av
        // om klikkeren er registrator. flytHarMal + mal-match (i koblingen) består uansett.
        if (!planAutorisertFlyt) {
          const flytIder = await hentBrukersOpprettFlytMedlemskap(ctx.userId, malForDomain.projectId);
          if (!flytIder.includes(effektivFlytId)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Du er ikke oppretter-medlem av valgt dokumentflyt",
            });
          }
        }

        // Gratis-grense (10 sjekklister per prosjekt) — interim-vedtak 2026-07-26:
        // gjelder KUN standalone-prosjekter (prøve); firma-tilknyttede er grenseløse,
        // sitedoc_admin har bypass. Delt beslutning i grenseNaadd (@sitedoc/shared),
        // delt standalone-oppslag i erStandaloneProsjekt — samme logikk som oppgave.opprett.
        // Soft-slettede teller ikke (IKKE_SLETTET), så papirkurv frigjør kvote.
        if (bruker.role !== "sitedoc_admin") {
          const faggruppe = await ctx.prisma.faggruppe.findUniqueOrThrow({
            where: { id: effektivBestiller },
            select: { projectId: true },
          });
          const [antall, standalone] = await Promise.all([
            ctx.prisma.checklist.count({
              where: { ...IKKE_SLETTET, bestillerFaggruppe: { projectId: faggruppe.projectId } },
            }),
            erStandaloneProsjekt(ctx.prisma, faggruppe.projectId),
          ]);
          if (
            grenseNaadd({
              erSitedocAdmin: false,
              erStandaloneProsjekt: standalone,
              antallEksisterende: antall,
            })
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              // Grensen treffer nå kun prøveprosjekter — teksten er sann for
              // mottakeren (en testbruker), ikke en betalende kunde.
              message:
                "Prøveprosjekter kan ha maks 10 sjekklister. Under et firma-abonnement er det ingen grense — kontakt SiteDoc.",
            });
          }
        }
      }

      const opprettet = await ctx.prisma.$transaction(async (tx) => {
        // Finn malens prefix, navn og prosjekt for autonummerering
        const mal = await tx.reportTemplate.findUniqueOrThrow({
          where: { id: input.templateId },
          select: { prefix: true, name: true, projectId: true },
        });

        let nummer: number | undefined;
        if (mal.prefix) {
          // Finn høyeste nummer for denne malen i prosjektet.
          // Bevisst UTEN deletedAt-guard: soft-slettede rader teller med, så et
          // gjenopprettet dokument aldri kolliderer i nummer med et nyopprettet (nummer-monotoni).
          const maks = await tx.checklist.aggregate({
            where: {
              templateId: input.templateId,
              number: { not: null },
            },
            _max: { number: true },
          });
          nummer = (maks._max.number ?? 0) + 1;
        }

        // Auto-generer tittel fra malnavn (nummer vises separat i Nr-kolonne)
        const tittel = input.title?.trim() || mal.name;

        // Finn hovedansvarlig fra dokumentflyt (utfører med erHovedansvarlig).
        // Default: HMS-grenens recipientGroupId (settes ovenfor for erHms). Overskrives
        // hvis dokumentflyt har egen hovedansvarlig.
        let recipientUserId: string | undefined;
        let endeligRecipientGroupId: string | undefined = recipientGroupId;
        if (effektivFlytId) {
          const hovedansvarlig = await tx.dokumentflytMedlem.findFirst({
            where: {
              dokumentflytId: effektivFlytId,
              rolle: "utforer",
              erHovedansvarlig: true,
            },
            include: {
              projectMember: { select: { userId: true } },
            },
          });
          if (hovedansvarlig?.projectMember?.userId) {
            recipientUserId = hovedansvarlig.projectMember.userId;
            endeligRecipientGroupId = undefined;
          } else if (hovedansvarlig?.groupId) {
            endeligRecipientGroupId = hovedansvarlig.groupId;
          }
        }

        const nySjekkliste = await tx.checklist.create({
          data: {
            templateId: input.templateId,
            bestillerFaggruppeId: effektivBestiller,
            utforerFaggruppeId: effektivUtforer,
            title: tittel,
            bestillerUserId: ctx.userId,
            eierUserId: ctx.userId,
            number: nummer,
            dokumentflytId: erHms ? hmsFlytId : effektivFlytId,
            subject: input.subject,
            byggeplassId: input.byggeplassId,
            drawingId: input.drawingId,
            positionX: input.positionX,
            positionY: input.positionY,
            dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
            // Spor 2 / 5a: HMS (SJA) opprettes nå som UTKAST (draft), ikke auto-sendt. Melder
            // eier innholdet og sender selv via hmsSendInn (→ Behandler-ledd + feltlås 5b).
            // Flyt-binding + recipientGroupId står; ballen ligger hos melder (Ledd 1) til «Send inn».
            // F3.2: status AVLEDES fra fakta (avledStatus = eneste skriver) — !sendt → draft.
            status: avledetStatus({ terminal: null, retning: null, sendt: false }),
            // HMS + standard starter begge hos oppretter/melder (Ledd 1), ikke sendt.
            sendt: false,
            aktivPosisjon: erHms ? (hmsFlytId ? 1 : undefined) : 1,
            recipientUserId,
            recipientGroupId: endeligRecipientGroupId,
          },
        });

        // Kontrollplan: koble atomisk til punktet (samme tx → all-eller-ingenting).
        // Validering (mal-match, ukoblet, race-guard) + status-løft + historikk i hjelperen.
        if (input.kontrollplanPunktId) {
          await koblePunktTilSjekkliste(tx, {
            punktId: input.kontrollplanPunktId,
            sjekklisteId: nySjekkliste.id,
            brukerId: ctx.userId,
            kilde: "startet",
          });
        }

        return nySjekkliste;
      });

      // Spor 2 / 5a: HMS (SJA) opprettes som utkast — INGEN varsel ved opprett. Behandler-leddet
      // (HMS-gruppen) varsles først når melder sender inn (sjekkliste.hmsSendInn). recipientGroupId
      // er allerede satt, så Send inn finner mottakeren uten nytt oppslag.

      // S1 Fase 1b: signér vedlegg-URL i data ved emisjon (tomt ved opprett → no-op,
      // men konsekvent — beskytter mot forhåndsutfylte maler med vedlegg).
      return signerDataRad(opprettet);
    }),

  // Oppdater sjekkliste-metadata (faggrupper, tittel etc.)
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().max(255).optional(),
        subject: z.string().max(500).nullable().optional(),
        bestillerFaggruppeId: z.string().uuid().optional(),
        utforerFaggruppeId: z.string().uuid().optional(),
        drawingId: z.string().uuid().nullable().optional(),
        byggeplassId: z.string().uuid().nullable().optional(),
        positionX: z.number().min(0).max(100).nullable().optional(),
        positionY: z.number().min(0).max(100).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: { select: { projectId: true, domain: true } },
          // 3b: koblet kontrollpunkt (om noen) — for å speile lokasjon dit.
          kontrollplanPunkt: { select: { id: true } },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.bestillerFaggruppeId,
        sjekkliste.utforerFaggruppeId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      // Faggruppe-endring kun tillatt i utkast-status
      if ((input.bestillerFaggruppeId || input.utforerFaggruppeId) && sjekkliste.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Faggrupper kan kun endres i utkast-status",
        });
      }

      // Lokasjon (tegning/pin) OG byggeplass er del av det et godkjent dokument påstår — HVOR
      // arbeidet ble utført er dokumentasjon. Endres de etter godkjenning, er dokumentet endret
      // etter levering uten spor — riktig vei er gjenåpne → rette → godkjenne på nytt.
      // `subject` (emne) er UNNTATT (Kenneth-vedtak 2026-08-29): det er en merkelapp for
      // gjenfinning, ikke dokumentasjon, og skal kunne settes/rettes også etter godkjenning —
      // endringsloggen viser hvem. Speiler oppgave.oppdater. Utskriften genereres på forespørsel
      // (arkiv.rendr, ingen lagret kopi), så «øyeblikksbilde» finnes ikke som teknisk størrelse.
      const rørerLaastFelt =
        input.drawingId !== undefined || input.positionX !== undefined ||
        input.positionY !== undefined || input.byggeplassId !== undefined;
      if (rørerLaastFelt && (sjekkliste.status === "approved" || sjekkliste.status === "closed")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sjekklisten er låst etter godkjenning. Gjenåpne den for å endre byggeplass eller lokasjon.",
        });
      }

      // Prosjektisolering: en tegning skrevet på sjekklista (og speilet til punktet under)
      // MÅ tilhøre sjekklistas prosjekt. Delt vakt med settPunktPlassering — samme felt, to
      // dører. Uten den kunne en fremmed drawingId skrives inn her (auth sjekker kun
      // sjekklistas eget prosjekt, ikke tegningens). `null` = fjern tegning, ingen sjekk.
      if (input.drawingId) {
        await verifiserTegningIProsjekt(ctx.prisma, input.drawingId, sjekkliste.template.projectId);
      }

      const { id, ...data } = input;
      const oppdatert = await ctx.prisma.checklist.update({
        where: { id },
        data,
      });

      // 3b: Er sjekklista koblet til et kontrollpunkt og «lokasjoner»-flyttingen rører
      // tegning/posisjon — speil samme plassering til punktet. Uten dette skrives
      // posisjonen kun til Checklist (som kontrollplan-tegningsoversikten IKKE leser),
      // så punkt-markøren forsvinner. Checklist-posisjonen beholdes (rendres i
      // sjekkliste-detalj/utskrift). Samme nullstill-regel som settPunktPlassering:
      // fjernes tegningen, tømmes posisjonen.
      const rørerLokasjon =
        input.drawingId !== undefined || input.positionX !== undefined || input.positionY !== undefined;
      if (rørerLokasjon && sjekkliste.kontrollplanPunkt) {
        // Trygt ved konstruksjon: skill «feltet er utelatt» (behold) fra «feltet er satt til
        // null» (tøm), likt Checklist.update over. `?? null` tømte tidligere en posisjon som
        // bare var utelatt. Fjernes tegningen (eksplisitt null), tømmes posisjonen med — en
        // pin uten tegning er meningsløs.
        const punktData: Prisma.KontrollplanPunktUncheckedUpdateInput =
          input.drawingId === null
            ? { drawingId: null, positionX: null, positionY: null }
            : {
                ...(input.drawingId !== undefined ? { drawingId: input.drawingId } : {}),
                ...(input.positionX !== undefined ? { positionX: input.positionX } : {}),
                ...(input.positionY !== undefined ? { positionY: input.positionY } : {}),
              };
        await ctx.prisma.kontrollplanPunkt.update({
          where: { id: sjekkliste.kontrollplanPunkt.id },
          data: punktData,
        });
      }

      return oppdatert;
    }),

  // Oppdater sjekklistedata (fylling av felter)
  oppdaterData: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tilgangssjekk + hent eksisterende data og mal-innstilling
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: {
            select: {
              projectId: true,
              domain: true,
              enableChangeLog: true,
              objects: { select: { id: true, label: true, type: true } },
            },
          },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.bestillerFaggruppeId,
        sjekkliste.utforerFaggruppeId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      // Guard (funn d): et finalisert dokument har frosset værsnapshot ved signering.
      // Vær-køen (VaerKoProvider) kan komme online ETTER finalisering og forsøke å synke
      // et snapshot — det skal aldri overskrive den finaliserte verdien. Slipp øvrige felt
      // igjennom, og drop vær-feltene stille (køen tror den synket → retryer ikke evig).
      let innData = input.data;
      if (sjekkliste.terminal != null) {
        const vaerIder = vaerFeltIder(sjekkliste.template.objects);
        if (vaerIder.size > 0 && Object.keys(innData).some((k) => vaerIder.has(k))) {
          innData = Object.fromEntries(
            Object.entries(innData).filter(([k]) => !vaerIder.has(k)),
          );
        }
      }

      // Generer endringslogg hvis aktivert på malen
      const endringsloggRader: {
        checklistId: string;
        userId: string;
        fieldId: string;
        fieldLabel: string;
        oldValue: string | null;
        newValue: string | null;
      }[] = [];

      if (sjekkliste.template.enableChangeLog) {
        const gammelData = (sjekkliste.data ?? {}) as Record<string, Record<string, unknown>>;
        const nyData = innData as Record<string, Record<string, unknown>>;
        const displayTyper = new Set(["heading", "subtitle"]);

        const objektMap = new Map(
          sjekkliste.template.objects
            .filter((o) => !displayTyper.has(o.type))
            .map((o) => [o.id, o.label]),
        );

        for (const [feltId, nyVerdi] of Object.entries(nyData)) {
          const label = objektMap.get(feltId);
          if (!label) continue;

          const gammelVerdi = gammelData[feltId];
          const gammelV = gammelVerdi?.verdi ?? null;
          const nyV = nyVerdi?.verdi ?? null;

          // Endring bestemmes av NORMALISERT innhold: lik verdi med ulik
          // nøkkelrekkefølge ELLER kun ulik signert-URL-query er IKKE en endring
          // (punkt 1 + rotårsak: auto-vær-lagring returnerer ferskt signerte
          // bilde-URL-er på urørte repeater-celler). Lagrer kanonisk original.
          // Selve sjekkliste-dataen lagres uendret (se `merged` under); dette
          // styrer kun changelog-radene + hva som regnes som endring.
          const gammelStr = gammelV != null ? kanonisk(gammelV) : null;
          const nyStr = nyV != null ? kanonisk(nyV) : null;

          if (!likForDiff(gammelV, nyV)) {
            endringsloggRader.push({
              checklistId: input.id,
              userId: ctx.userId,
              fieldId: feltId,
              fieldLabel: label,
              oldValue: gammelStr,
              newValue: nyStr,
            });
          }
        }
      }

      // Fritekst-oversettelse Lag 3: auto-oversett når brukerens språk != prosjektspråk
      const prosjekt = await ctx.prisma.project.findUnique({
        where: { id: sjekkliste.template.projectId },
        select: { sourceLanguage: true },
      });
      const bruker = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { language: true },
      });
      const prosjektSpraak = prosjekt?.sourceLanguage ?? "nb";
      const brukerSpraak = bruker?.language ?? "nb";

      if (brukerSpraak !== prosjektSpraak) {
        try {
          const data = innData as Record<string, Record<string, unknown>>;
          const objektTyper = new Map(sjekkliste.template.objects.map((o) => [o.id, o.type]));
          const teksterÅOversette: string[] = [];

          // Samle fritekst-verdier og kommentarer
          for (const [feltId, felt] of Object.entries(data)) {
            if (!felt || typeof felt !== "object") continue;
            // Ikke oversett hvis original allerede finnes (admin redigerer oversettelsen)
            if ((felt as Record<string, unknown>).original) continue;

            const type = objektTyper.get(feltId);
            // Tekstfelt-verdier
            if (type && FRITEKST_TYPER.has(type) && typeof felt.verdi === "string" && felt.verdi.trim()) {
              teksterÅOversette.push(felt.verdi);
            }
            // Kommentarer på alle felttyper
            if (typeof felt.kommentar === "string" && felt.kommentar.trim()) {
              teksterÅOversette.push(felt.kommentar);
            }
          }

          if (teksterÅOversette.length > 0) {
            const oversettMap = await oversettFritekst(
              ctx.prisma, teksterÅOversette, brukerSpraak, prosjektSpraak,
            );

            // Flytt originaler og sett oversettelser
            for (const [feltId, felt] of Object.entries(data)) {
              if (!felt || typeof felt !== "object" || (felt as Record<string, unknown>).original) continue;
              const type = objektTyper.get(feltId);
              const feltObj = felt as Record<string, unknown>;
              const harFritekstVerdi = type && FRITEKST_TYPER.has(type) && typeof feltObj.verdi === "string" && (feltObj.verdi as string).trim();
              const harKommentar = typeof feltObj.kommentar === "string" && (feltObj.kommentar as string).trim();

              if (harFritekstVerdi || harKommentar) {
                feltObj.original = {
                  spraak: brukerSpraak,
                  verdi: harFritekstVerdi ? feltObj.verdi : undefined,
                  kommentar: harKommentar ? feltObj.kommentar : undefined,
                };
                if (harFritekstVerdi) feltObj.verdi = oversettMap.get(feltObj.verdi as string) ?? feltObj.verdi;
                if (harKommentar) feltObj.kommentar = oversettMap.get(feltObj.kommentar as string) ?? feltObj.kommentar;
              }
            }
          }
        } catch (oversettFeil) {
          // Oversettelse er best-effort — lagring skal aldri feile pga. oversettelsesserver
          console.warn("Auto-oversettelse feilet, lagrer uten oversettelse:", oversettFeil);
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        // Feltvis merge: hent fersk data fra DB og merg kun innsendte felt
        const fersk = await tx.checklist.findUniqueOrThrow({
          where: { id: input.id },
          select: { data: true },
        });
        const eksisterende = (fersk.data ?? {}) as Record<string, unknown>;
        const merget = { ...eksisterende, ...innData };

        const oppdatert = await tx.checklist.update({
          where: { id: input.id },
          data: { data: merget as Prisma.InputJsonValue },
        });

        if (endringsloggRader.length > 0) {
          await tx.checklistChangeLog.createMany({ data: endringsloggRader });
        }

        // S1 Fase 1b: signér vedlegg-URL i data ved emisjon (data-redigering).
        return signerDataRad(oppdatert);
      });
    }),

  // Funn C (bilder i raden): punkt-patch av ÉN vedlegg-URL i Checklist.data.
  // Opplastingskøen kaller denne når et bilde er ferdig lastet opp, slik at
  // server-JSON-en får den varige `/uploads/privat/…`-URL-en — også når skjermen
  // er demontert (da når opplastings-callbacken aldri hooken, og korreksjonen ble
  // liggende kun i mobilens SQLite, som viskes ved reinstall). Rent additivt:
  // ingen skjemaendring, read-modify-write av ÉN URL. Mobil er skrevet slik at
  // den tåler at prosedyren ikke finnes ennå (eldre prod-API) — kallet er
  // best-effort og gater ikke sletting alene.
  settVedleggUrl: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        objektId: z.string().min(1),
        vedleggId: z.string().min(1),
        url: z.string().min(1),
        filnavn: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Aldri persistér en lokal enhets-URL (file://) på server — det er hele
      // feilklassen. Kun server-relative /uploads/-stier slipper inn.
      if (!input.url.startsWith("/uploads/")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "settVedleggUrl krever en server-URL (/uploads/…)",
        });
      }

      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: { select: { projectId: true, domain: true } },
        },
      });
      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.bestillerFaggruppeId,
        sjekkliste.utforerFaggruppeId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      return ctx.prisma.$transaction(async (tx) => {
        const fersk = await tx.checklist.findUniqueOrThrow({
          where: { id: input.id },
          select: { data: true },
        });
        // Dyp kopi — vi muterer og skriver tilbake i én transaksjon.
        const data = JSON.parse(JSON.stringify(fersk.data ?? {})) as Record<
          string,
          unknown
        >;

        // 1) Finnes vedlegget alt (topp-nivå eller repeater-nestet) — bytt URL-en.
        const erstattet = settUrlPaaVedlegg(
          data,
          input.vedleggId,
          input.url,
          input.filnavn,
        );

        // 2) Rakk klienten aldri å synke feltet (mobil utelater felt med lokal
        //    URL fra lagringen) — legg vedlegget til på topp-nivå under objektId.
        //    Repeater-nesting kan ikke gjenskapes her; slike bilder synkes når
        //    skjermen mountes igjen.
        if (!erstattet) {
          const raaFelt = data[input.objektId];
          const felt =
            raaFelt !== null && typeof raaFelt === "object"
              ? (raaFelt as Record<string, unknown>)
              : { verdi: null, kommentar: "" };
          const vedlegg = Array.isArray(felt.vedlegg)
            ? (felt.vedlegg as Array<Record<string, unknown>>)
            : [];
          vedlegg.push({
            id: input.vedleggId,
            type: "bilde",
            url: input.url,
            ...(input.filnavn ? { filnavn: input.filnavn } : {}),
          });
          felt.vedlegg = vedlegg;
          data[input.objektId] = felt;
        }

        await tx.checklist.update({
          where: { id: input.id },
          data: { data: data as Prisma.InputJsonValue },
        });
        return { ok: true, erstattet };
      });
    }),

  // Forbedre oversettelse: manuell redigering eller re-oversettelse med bedre motor
  forbedreOversettelse: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      feltId: z.string(),
      // Enten manuell tekst ELLER motor for re-oversettelse
      manuellVerdi: z.string().optional(),
      manuellKommentar: z.string().optional(),
      motor: z.enum(["opus-mt", "google", "deepl"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: { template: { select: { projectId: true, domain: true } } },
      });
      await verifiserDokumentTilgang(
        ctx.userId, sjekkliste.template.projectId,
        sjekkliste.bestillerFaggruppeId, sjekkliste.utforerFaggruppeId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      const data = (sjekkliste.data ?? {}) as Record<string, Record<string, unknown>>;
      const felt = data[input.feltId];
      if (!felt) throw new TRPCError({ code: "NOT_FOUND", message: "Felt ikke funnet" });

      const original = felt.original as { spraak: string; verdi?: string; kommentar?: string } | undefined;
      if (!original) throw new TRPCError({ code: "BAD_REQUEST", message: "Ingen original å forbedre" });

      if (input.motor) {
        // Re-oversett med valgt motor
        const prosjekt = await ctx.prisma.project.findUnique({
          where: { id: sjekkliste.template.projectId },
          select: { sourceLanguage: true },
        });
        const modul = await ctx.prisma.projectModule.findUnique({
          where: { projectId_moduleSlug: { projectId: sjekkliste.template.projectId, moduleSlug: "oversettelse" } },
        });
        const apiKey = (modul?.config as { apiKey?: string })?.apiKey;
        const prosjektSpraak = prosjekt?.sourceLanguage ?? "nb";

        const tekster: string[] = [];
        if (original.verdi) tekster.push(original.verdi);
        if (original.kommentar) tekster.push(original.kommentar);

        if (tekster.length > 0) {
          const { oversettMedMotor } = await import("../services/oversettelse-service");
          const oversatte = await oversettMedMotor(tekster, original.spraak, prosjektSpraak, input.motor, apiKey);
          let idx = 0;
          if (original.verdi) { felt.verdi = oversatte[idx++]; }
          if (original.kommentar) { felt.kommentar = oversatte[idx]; }
        }
      } else {
        // Manuell redigering
        if (input.manuellVerdi !== undefined) felt.verdi = input.manuellVerdi;
        if (input.manuellKommentar !== undefined) felt.kommentar = input.manuellKommentar;
      }

      return ctx.prisma.checklist.update({
        where: { id: input.id },
        data: { data: data as Prisma.InputJsonValue },
      });
    }),

  // Endre status (med overgangslogging)
  /**
   * Hent dokumentflyter brukeren kan flytte sjekklisten til.
   * Speil av oppgave.hentTilgjengeligeFlyter — samme shape, samme regler.
   */
  hentTilgjengeligeFlyter: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          templateId: true,
          dokumentflytId: true,
          recipientUserId: true,
          recipientGroupId: true,
          bestillerFaggruppeId: true,
          utforerFaggruppeId: true,
          template: { select: { domain: true, projectId: true, hmsSynlighet: true } },
        },
      });

      const projectId = sjekkliste.template.projectId;

      await verifiserDokumentTilgang(
        ctx.userId,
        projectId,
        sjekkliste.bestillerFaggruppeId,
        sjekkliste.utforerFaggruppeId,
        sjekkliste.template.domain,
        input.id,
        "checklist",
        sjekkliste.template.hmsSynlighet,
      );

      const tilgang = await hentBrukerProsjektTilgang(ctx.userId, projectId);

      const alleFlyter = await ctx.prisma.dokumentflyt.findMany({
        where: {
          projectId,
          ...(sjekkliste.templateId
            ? { maler: { some: { templateId: sjekkliste.templateId } } }
            : {}),
        },
        select: {
          id: true,
          name: true,
          faggruppe: { select: { id: true, name: true, color: true } },
          medlemmer: {
            select: {
              steg: true,
              rolle: true,
              erHovedansvarlig: true,
              projectMemberId: true,
              groupId: true,
              faggruppeId: true,
              projectMember: {
                select: { id: true, user: { select: { id: true, name: true } } },
              },
              group: { select: { id: true, name: true } },
              faggruppe: { select: { id: true, name: true } },
            },
            orderBy: { steg: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });

      const gjeldendeFlyt =
        alleFlyter.find((f) => f.id === sjekkliste.dokumentflytId) ?? null;

      const andre = alleFlyter
        .filter((f) => f.id !== sjekkliste.dokumentflytId)
        .map((f) => ({ flyt: f, boks: finnBrukersBoks(f, tilgang) }))
        .filter(
          (x): x is { flyt: typeof x.flyt; boks: NonNullable<typeof x.boks> } =>
            x.boks !== null,
        )
        .map((x) => ({
          id: x.flyt.id,
          name: x.flyt.name,
          faggruppe: x.flyt.faggruppe,
          brukersBoks: { steg: x.boks.steg, rolle: x.boks.rolle },
          medlemKilde: x.boks.kilde,
        }));

      const kanFlytte = kanByttFlyt(
        tilgang,
        {
          recipientUserId: sjekkliste.recipientUserId,
          recipientGroupId: sjekkliste.recipientGroupId,
        },
        andre.length > 0,
        ctx.userId,
      );

      return {
        gjeldende: gjeldendeFlyt
          ? {
              id: gjeldendeFlyt.id,
              name: gjeldendeFlyt.name,
              faggruppe: gjeldendeFlyt.faggruppe,
              medlemmer: gjeldendeFlyt.medlemmer,
              brukersBoks: finnBrukersBoks(gjeldendeFlyt, tilgang),
            }
          : null,
        andre: kanFlytte ? andre : [],
        kanFlytte,
      };
    }),

  endreStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nyStatus: z.union([documentStatusSchema, z.literal("forwarded")]),
        senderId: z.string().uuid().optional(), // Deprecated — bruker ctx.userId
        kommentar: z.string().optional(),
        recipientUserId: z.string().uuid().optional(),
        recipientGroupId: z.string().uuid().optional(),
        /** Ny dokumentflyt-ID ved videresending til annen faggruppe */
        dokumentflytId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: {
            select: {
              projectId: true,
              domain: true,
              prefix: true,
              project: { select: { name: true } },
              objects: { select: { id: true, type: true } },
            },
          },
          utforerFaggruppe: { select: { name: true } },
        },
      });

      const projectId = sjekkliste.template.projectId;

      // Tilgangssjekk
      await verifiserDokumentTilgang(
        ctx.userId,
        projectId,
        sjekkliste.bestillerFaggruppeId,
        sjekkliste.utforerFaggruppeId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      // F3.4: POSISJON-basert autorisasjon — rettigheten følger hvem som har ballen (se
      // verifiserRetningsrett). 1b B-gaten fjernet: HMS ruter nå via posisjon → null-medlem-
      // bestillerboksen (E1) er ikke lenger et autorisasjonsproblem. Medlemmer lastes her og
      // gjenbrukes av rutingen nedenfor.
      const flytMedlemmer = await hentFlytMedlemmer(ctx.prisma, sjekkliste.dokumentflytId);
      await verifiserRetningsrett(
        ctx.userId,
        projectId,
        flytMedlemmer,
        sjekkliste.aktivPosisjon,
        input.nyStatus,
        sjekkliste.status, // fra-status: skiller trekk tilbake (received→draft) fra gjenåpne (terminal→draft)
      );

      // Hjelpefunksjon for varsling (bruker input-mottaker eller besvar-mottaker)
      const varsle = async (erVideresending: boolean, overrideMottaker?: { recipientUserId?: string | null; recipientGroupId?: string | null }) => {
        const mottaker = overrideMottaker ?? { recipientUserId: input.recipientUserId, recipientGroupId: input.recipientGroupId };
        const eposter = await hentMottakerEposter(ctx.prisma, {
          recipientUserId: mottaker.recipientUserId ?? undefined,
          recipientGroupId: mottaker.recipientGroupId ?? undefined,
          ekskluderUserId: ctx.userId,
        });
        if (eposter.length === 0) return;
        const avsender = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
        const nummer = sjekkliste.template.prefix && sjekkliste.number
          ? `${sjekkliste.template.prefix}-${String(sjekkliste.number).padStart(3, "0")}`
          : undefined;
        void sendDokumentVarsling({
          til: eposter,
          dokumentType: "sjekkliste",
          dokumentTittel: sjekkliste.title ?? "Uten tittel",
          dokumentNummer: nummer,
          prosjektNavn: sjekkliste.template.project.name,
          prosjektId: projectId,
          dokumentId: sjekkliste.id,
          avsenderNavn: avsender?.name ?? "Ukjent",
          kommentar: input.kommentar,
          erVideresending,
        });
      };

      // Bygg snapshot for tidslinje-kontekst
      const snapshot = await byggTransferSnapshot({
        senderId: ctx.userId,
        projektId: projectId,
        dokumentStatus: sjekkliste.status,
        bestillerFaggruppeId: sjekkliste.bestillerFaggruppeId,
        utforerFaggruppeId: sjekkliste.utforerFaggruppeId,
        dokumentflytId: sjekkliste.dokumentflytId,
      });

      // Utled ny eier basert på mottaker:
      // Person → personen. Gruppe → gruppens hovedansvarlig. Fallback: beholder gjeldende.
      const utledNyEier = async (recipientUserId?: string | null, recipientGroupId?: string | null): Promise<string | undefined> => {
        if (recipientUserId) return recipientUserId;
        if (recipientGroupId && sjekkliste.dokumentflytId) {
          const gruppemedlem = await ctx.prisma.dokumentflytMedlem.findFirst({
            where: {
              dokumentflytId: sjekkliste.dokumentflytId,
              groupId: recipientGroupId,
              erHovedansvarlig: true,
            },
            include: { hovedansvarligPerson: { select: { userId: true } } },
          });
          if (gruppemedlem?.hovedansvarligPerson?.userId) {
            return gruppemedlem.hovedansvarligPerson.userId;
          }
        }
        return undefined; // Beholder gjeldende eier
      };

      // Videresending: bytt mottaker, evt. bytt dokumentflyt + faggruppe
      if (input.nyStatus === "forwarded") {
        // Sjekk om dokumentflyt/faggruppe endres
        let flytBytteData: { dokumentflytId: string; utforerFaggruppeId: string; nyFaggruppeNavn: string; nyFlytNavn: string } | null = null;
        if (input.dokumentflytId && input.dokumentflytId !== sjekkliste.dokumentflytId) {
          const nyFlyt = await ctx.prisma.dokumentflyt.findUniqueOrThrow({
            where: { id: input.dokumentflytId },
            include: { faggruppe: { select: { id: true, name: true } } },
          });
          if (!nyFlyt.faggruppeId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Dokumentflyten mangler faggruppe" });
          }
          flytBytteData = {
            dokumentflytId: input.dokumentflytId,
            utforerFaggruppeId: nyFlyt.faggruppeId,
            nyFaggruppeNavn: nyFlyt.faggruppe?.name ?? "Ukjent",
            nyFlytNavn: nyFlyt.name,
          };

          // Flyt-bytte-tilgang (BACKLOG: dokumentflyt send-modal redesign):
          // admin/registrator/sitedoc-admin + "har ballen"-bruker som er medlem
          // av mål-flyten (cross-flyt-medlem).
          const tilgang = await hentBrukerProsjektTilgang(ctx.userId, projectId);
          const malFlytTilhorighet = await ctx.prisma.dokumentflyt.findFirst({
            where: {
              id: input.dokumentflytId,
              projectId,
              medlemmer: {
                some: {
                  OR: [
                    { projectMemberId: tilgang.projectMemberId },
                    ...(tilgang.gruppeIder.size > 0
                      ? [{ groupId: { in: [...tilgang.gruppeIder] } }]
                      : []),
                    ...(tilgang.faggruppeIder.size > 0
                      ? [{ faggruppeId: { in: [...tilgang.faggruppeIder] } }]
                      : []),
                  ],
                },
              },
            },
            select: { id: true },
          });
          if (
            !kanByttFlyt(
              tilgang,
              {
                recipientUserId: sjekkliste.recipientUserId,
                recipientGroupId: sjekkliste.recipientGroupId,
              },
              malFlytTilhorighet !== null,
              ctx.userId,
            )
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Du har ikke tilgang til å bytte flyt på dette dokumentet",
            });
          }
        }

        // Auto-utled mottaker ved flyt-bytte fra erHovedansvarlig på utforer-
        // rollen i mål-flyten. Klient sender ikke mottaker ved flyt-bytte —
        // server styrer. Samme mønster som ved oppretting (sjekkliste.ts:200-209).
        let effektivRecipientUserId: string | null = input.recipientUserId ?? null;
        let effektivRecipientGroupId: string | null = input.recipientGroupId ?? null;
        if (flytBytteData) {
          const hovedansvarlig = await ctx.prisma.dokumentflytMedlem.findFirst({
            where: {
              dokumentflytId: flytBytteData.dokumentflytId,
              rolle: "utforer",
              erHovedansvarlig: true,
            },
            include: { projectMember: { select: { userId: true } } },
          });
          if (hovedansvarlig?.projectMember?.userId) {
            effektivRecipientUserId = hovedansvarlig.projectMember.userId;
            effektivRecipientGroupId = null;
          } else if (hovedansvarlig?.groupId) {
            effektivRecipientGroupId = hovedansvarlig.groupId;
            effektivRecipientUserId = null;
          }
        }

        if (!effektivRecipientUserId && !effektivRecipientGroupId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Videresending krever en mottaker" });
        }

        const gammelFaggruppeNavn = sjekkliste.utforerFaggruppe?.name ?? "Ukjent";

        const nyEier = await utledNyEier(effektivRecipientUserId, effektivRecipientGroupId);

        // F3.1: videresend endrer IKKE status — kun aktivPosisjon flyttes (retning=paatvers).
        // Ledd fra mål-flyten ved flyt-bytte, ellers gjeldende flyt.
        const forwardLedd = await hentPosisjonsLedd(
          ctx.prisma,
          flytBytteData?.dokumentflytId ?? sjekkliste.dokumentflytId,
        );
        const forwardFakta = beregnSkyggeFakta({
          effektivStatus: sjekkliste.status,
          nyStatusRaw: "forwarded",
          ledd: forwardLedd,
          recipientUserId: effektivRecipientUserId,
          recipientGroupId: effektivRecipientGroupId,
          bestillerUserId: sjekkliste.bestillerUserId,
        });

        const resultat = await ctx.prisma.$transaction(async (tx) => {
          const oppdatert = await tx.checklist.update({
            where: { id: input.id },
            data: {
              recipientUserId: effektivRecipientUserId,
              recipientGroupId: effektivRecipientGroupId,
              aktivPosisjon: forwardFakta.aktivPosisjon,
              retning: forwardFakta.retning,
              ...(nyEier ? { eierUserId: nyEier } : {}),
              ...(flytBytteData ? {
                dokumentflytId: flytBytteData.dokumentflytId,
                utforerFaggruppeId: flytBytteData.utforerFaggruppeId,
              } : {}),
            },
          });

          const kommentar = flytBytteData
            ? (input.kommentar ? `Videresendt til ${flytBytteData.nyFaggruppeNavn}: ${input.kommentar}` : `Videresendt fra ${gammelFaggruppeNavn} til ${flytBytteData.nyFaggruppeNavn}`)
            : (input.kommentar ? `Videresendt: ${input.kommentar}` : "Videresendt");

          await tx.documentTransfer.create({
            data: {
              checklistId: input.id,
              senderId: ctx.userId,
              fromStatus: sjekkliste.status,
              toStatus: sjekkliste.status,
              comment: kommentar,
              recipientUserId: effektivRecipientUserId,
              recipientGroupId: effektivRecipientGroupId,
              ...snapshot,
              ...(flytBytteData ? {
                recipientEnterpriseName: flytBytteData.nyFaggruppeNavn,
                dokumentflytName: flytBytteData.nyFlytNavn,
              } : {}),
            },
          });
          return oppdatert;
        });
        void varsle(true, {
          recipientUserId: effektivRecipientUserId,
          recipientGroupId: effektivRecipientGroupId,
        });
        return resultat;
      }

      if (!isValidStatusTransition(sjekkliste.status, input.nyStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ugyldig statusovergang fra "${sjekkliste.status}" til "${input.nyStatus}"`,
        });
      }

      // P2 (Kenneth-vedtak 2026-07-21): Besvar/Send tilbake/Avvis krever ikke-tom
      // begrunnelse (statusKreverBegrunnelse — delt kilde, samme regel som klienten).
      if (statusKreverBegrunnelse(input.nyStatus) && !input.kommentar?.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Begrunnelse er påkrevd for denne handlingen",
        });
      }

      // Funn D (2026-08-04, Tolkning A): den gamle tom-besvarelse-guarden (krevde minst ett
      // utfylt svar-felt for `responded`) er fjernet. Under Tolkning A teller en kommentar/
      // begrunnelse/vedlegg/tegning som gyldig besvarelse — og `responded` krever ALLTID en
      // ikke-tom begrunnelse (statusKreverBegrunnelse-guarden over). Guarden var derfor både
      // (a) feil (blokkerte gyldig kommentar-only-besvarelse, Kenneths funn) og (b) subsumert:
      // en `responded` som passerer begrunnelse-guarden har alltid innhold. «Helt tom» avvises
      // fortsatt — av begrunnelse-guarden («Begrunnelse er påkrevd»). Se inbox-cowork Funn D.

      // Auto-mottatt: sent → received umiddelbart
      const effektivStatus = input.nyStatus === "sent" ? "received" : input.nyStatus;

      // F3.3: POSISJON-basert ruting (Tolkning A, fabel-bindende). Send→nesteLedd (forover),
      // Besvar→forrigeBallLedd (retur bakover). Gjenbruker flytMedlemmer fra authz-steget.
      // § 2.4: draft-overgang (gjenåpne/trekk-tilbake) trenger handleren for gjenapnePosisjon.
      const aapner = input.nyStatus === "draft" ? await byggFlytBruker(ctx.userId, projectId) : null;
      const ruting = beregnRuting({
        nyStatus: input.nyStatus,
        effektivStatus,
        medlemmer: flytMedlemmer,
        naaPos: sjekkliste.aktivPosisjon,
        bestillerUserId: sjekkliste.bestillerUserId,
        fraStatus: sjekkliste.status,
        aapner,
      });
      const nyMottaker = ruting.mottaker; // null = behold gjeldende (E2/E3 no-op, terminal, E5)

      // Ny eier følger ny mottaker (person direkte, gruppe → hovedansvarlig).
      let eierOppdatering: { eierUserId: string } | Record<string, never> = {};
      if (nyMottaker) {
        const nyEier = await utledNyEier(nyMottaker.recipientUserId, nyMottaker.recipientGroupId);
        if (nyEier) eierOppdatering = { eierUserId: nyEier };
      }

      // Funn d: fryser dokumentet nå (terminal-transisjon), løs ventende vær-snapshot
      // for det LAGREDE befaringstidspunktet (archive-vær), ikke finaliseringstidspunktet.
      // Henting skjer FØR transaksjonen — aldri nettverk-I/O inne i en DB-transaksjon.
      const finaliserer = ruting.terminal != null && sjekkliste.terminal == null;
      const vaerOppdatering = finaliserer
        ? await resolverVentendeVaer(
            (sjekkliste.data ?? {}) as Record<string, { verdi?: unknown; kommentar?: string; vedlegg?: unknown[] }>,
            sjekkliste.template.objects,
            hentVaerHourly,
          )
        : null;

      const resultat = await ctx.prisma.$transaction(async (tx) => {
        const oppdatert = await tx.checklist.update({
          where: { id: input.id },
          data: {
            status: ruting.status,
            aktivPosisjon: ruting.aktivPosisjon,
            retning: ruting.retning,
            terminal: ruting.terminal,
            sendt: ruting.sendt,
            ...(vaerOppdatering ? { data: vaerOppdatering as Prisma.InputJsonValue } : {}),
            ...eierOppdatering,
            ...(nyMottaker ? {
              recipientUserId: nyMottaker.recipientUserId,
              recipientGroupId: nyMottaker.recipientGroupId,
            } : {}),
          },
        });

        await tx.documentTransfer.create({
          data: {
            checklistId: input.id,
            senderId: ctx.userId,
            fromStatus: sjekkliste.status,
            toStatus: input.nyStatus,
            comment: input.kommentar,
            ...(nyMottaker ? {
              recipientUserId: nyMottaker.recipientUserId,
              recipientGroupId: nyMottaker.recipientGroupId,
            } : {}),
            ...snapshot,
          },
        });

        if (input.nyStatus === "sent") {
          await tx.documentTransfer.create({
            data: {
              checklistId: input.id,
              senderId: ctx.userId,
              fromStatus: "sent",
              toStatus: "received",
              ...snapshot,
            },
          });
        }

        return oppdatert;
      });

      // Varsle ny mottaker (posisjon-utledet) ved send/besvar; terminal varsles som før.
      if (nyMottaker) {
        void varsle(false, nyMottaker);
      } else if (["approved", "rejected", "dismissed"].includes(input.nyStatus)) {
        void varsle(false);
      }

      return resultat;
    }),

  // ---------- Dedikert HMS-løp (D1/D2) ----------
  // HMS er et selvstendig løp ved siden av dokumentflyten — egen tilstandsmaskin
  // (sent → responded → closed, + gjenåpne) og egen autorisasjon
  // (verifiserHmsHandling), atskilt fra flytens posisjons-baserte autorisasjon.

  /**
   * Besvar HMS-sak med obligatorisk begrunnelse (HMS-admin).
   * Tilstand: sent | responded → responded.
   */
  hmsBesvar: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        begrunnelse: z.string().trim().min(1, "Begrunnelse er påkrevd"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await hentHmsSjekkliste(ctx.prisma, input.id);
      await verifiserHmsHandling(
        ctx.userId,
        {
          bestillerUserId: sjekkliste.bestillerUserId,
          status: sjekkliste.status,
          projectId: sjekkliste.template.projectId,
        },
        "besvar",
      );

      // F3.3: HMS-besvar ruter via posisjon (forrigeBallLedd → Ledd 1 oppretter, E1 null-medlem→bestiller).
      const hmsMedlemmer = await hentFlytMedlemmer(ctx.prisma, sjekkliste.dokumentflytId);
      const hmsRuting = beregnRuting({
        nyStatus: "responded",
        effektivStatus: "responded",
        medlemmer: hmsMedlemmer,
        naaPos: sjekkliste.aktivPosisjon,
        bestillerUserId: sjekkliste.bestillerUserId,
      });

      const resultat = await ctx.prisma.$transaction(async (tx) => {
        const oppdatert = await tx.checklist.update({
          where: { id: input.id },
          data: {
            status: hmsRuting.status,
            aktivPosisjon: hmsRuting.aktivPosisjon,
            retning: hmsRuting.retning,
            terminal: hmsRuting.terminal,
            sendt: hmsRuting.sendt,
            ...(hmsRuting.mottaker
              ? { recipientUserId: hmsRuting.mottaker.recipientUserId, recipientGroupId: hmsRuting.mottaker.recipientGroupId }
              : {}),
          },
        });
        await tx.documentTransfer.create({
          data: {
            checklistId: input.id,
            senderId: ctx.userId,
            fromStatus: sjekkliste.status,
            toStatus: "responded",
            comment: input.begrunnelse,
          },
        });
        return oppdatert;
      });

      // Varsle oppretteren om svaret.
      await sendHmsVarsel(ctx.prisma, {
        dokumentId: sjekkliste.id,
        tittel: sjekkliste.title,
        nummer: sjekkliste.number,
        prefix: sjekkliste.template.prefix,
        projectId: sjekkliste.template.projectId,
        prosjektNavn: sjekkliste.template.project.name,
        avsenderId: ctx.userId,
        recipientUserId: sjekkliste.bestillerUserId,
        kommentar: input.begrunnelse,
      });

      return resultat;
    }),

  /**
   * Lukk besvart HMS-sak (HMS-admin). Tilstand: responded → closed (terminal).
   */
  hmsLukk: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        kommentar: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await hentHmsSjekkliste(ctx.prisma, input.id);
      await verifiserHmsHandling(
        ctx.userId,
        {
          bestillerUserId: sjekkliste.bestillerUserId,
          status: sjekkliste.status,
          projectId: sjekkliste.template.projectId,
        },
        "lukk",
      );

      const resultat = await ctx.prisma.$transaction(async (tx) => {
        const oppdatert = await tx.checklist.update({
          where: { id: input.id },
          // F3.1/3.2: HMS-lukk → terminal lukket; status avledes (→ closed). aktivPosisjon uendret.
          data: { status: avledetStatus({ retning: "frem", terminal: "lukket", sendt: true }), terminal: "lukket", sendt: true },
        });
        await tx.documentTransfer.create({
          data: {
            checklistId: input.id,
            senderId: ctx.userId,
            fromStatus: sjekkliste.status,
            toStatus: "closed",
            comment: input.kommentar?.trim() || undefined,
          },
        });
        return oppdatert;
      });

      await sendHmsVarsel(ctx.prisma, {
        dokumentId: sjekkliste.id,
        tittel: sjekkliste.title,
        nummer: sjekkliste.number,
        prefix: sjekkliste.template.prefix,
        projectId: sjekkliste.template.projectId,
        prosjektNavn: sjekkliste.template.project.name,
        avsenderId: ctx.userId,
        recipientUserId: sjekkliste.bestillerUserId,
        kommentar: input.kommentar?.trim() || undefined,
      });

      return resultat;
    }),

  /**
   * Gjenåpne lukket HMS-sak (HMS-admin). Tilstand: closed → responded.
   */
  hmsGjenapne: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        kommentar: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await hentHmsSjekkliste(ctx.prisma, input.id);
      await verifiserHmsHandling(
        ctx.userId,
        {
          bestillerUserId: sjekkliste.bestillerUserId,
          status: sjekkliste.status,
          projectId: sjekkliste.template.projectId,
        },
        "gjenapne",
      );

      // F3.3: HMS-gjenåpne ruter via posisjon (terminal nulles, ball tilbake mot oppretter/Ledd 1).
      const hmsMedlemmer = await hentFlytMedlemmer(ctx.prisma, sjekkliste.dokumentflytId);
      const hmsRuting = beregnRuting({
        nyStatus: "responded",
        effektivStatus: "responded",
        medlemmer: hmsMedlemmer,
        naaPos: sjekkliste.aktivPosisjon,
        bestillerUserId: sjekkliste.bestillerUserId,
      });

      const resultat = await ctx.prisma.$transaction(async (tx) => {
        const oppdatert = await tx.checklist.update({
          where: { id: input.id },
          data: {
            status: hmsRuting.status,
            aktivPosisjon: hmsRuting.aktivPosisjon,
            retning: hmsRuting.retning,
            terminal: null,
            sendt: hmsRuting.sendt,
            ...(hmsRuting.mottaker
              ? { recipientUserId: hmsRuting.mottaker.recipientUserId, recipientGroupId: hmsRuting.mottaker.recipientGroupId }
              : {}),
          },
        });
        await tx.documentTransfer.create({
          data: {
            checklistId: input.id,
            senderId: ctx.userId,
            fromStatus: sjekkliste.status,
            toStatus: "responded",
            comment: input.kommentar?.trim() || "Gjenåpnet",
          },
        });
        return oppdatert;
      });

      await sendHmsVarsel(ctx.prisma, {
        dokumentId: sjekkliste.id,
        tittel: sjekkliste.title,
        nummer: sjekkliste.number,
        prefix: sjekkliste.template.prefix,
        projectId: sjekkliste.template.projectId,
        prosjektNavn: sjekkliste.template.project.name,
        avsenderId: ctx.userId,
        recipientUserId: sjekkliste.bestillerUserId,
        kommentar: input.kommentar?.trim() || undefined,
      });

      return resultat;
    }),

  /**
   * Tilføy informasjon til HMS-sak (kun oppretter). Alltid append — det sendte
   * redigeres aldri. Endrer IKKE tilstand (dialog fortsetter der den er).
   * Tilstand: sent | responded. Varsler HMS-gruppen.
   */
  hmsTilfoyInformasjon: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        kommentar: z.string().trim().min(1, "Skriv en melding"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await hentHmsSjekkliste(ctx.prisma, input.id);
      await verifiserHmsHandling(
        ctx.userId,
        {
          bestillerUserId: sjekkliste.bestillerUserId,
          status: sjekkliste.status,
          projectId: sjekkliste.template.projectId,
        },
        "tilfoyInformasjon",
      );

      // Append som transfer-rad uten statusendring (fromStatus === toStatus).
      const transfer = await ctx.prisma.documentTransfer.create({
        data: {
          checklistId: input.id,
          senderId: ctx.userId,
          fromStatus: sjekkliste.status,
          toStatus: sjekkliste.status,
          comment: input.kommentar,
        },
      });

      // Varsle HMS-gruppen (HMS-admin). recipientGroupId settes ved opprett.
      if (sjekkliste.recipientGroupId) {
        await sendHmsVarsel(ctx.prisma, {
          dokumentId: sjekkliste.id,
          tittel: sjekkliste.title,
          nummer: sjekkliste.number,
          prefix: sjekkliste.template.prefix,
          projectId: sjekkliste.template.projectId,
          prosjektNavn: sjekkliste.template.project.name,
          avsenderId: ctx.userId,
          recipientGroupId: sjekkliste.recipientGroupId,
          kommentar: input.kommentar,
        });
      }

      return transfer;
    }),

  /**
   * Send inn HMS-utkast (SJA) / send tilbake til behandler etter Returner (melder). Spor 2 / 5a.
   * Speiler oppgave.hmsSendInn. Melder fyller ut som utkast (draft) og sender selv → ballen går
   * til Behandler-ledd (Ledd 2 = HMS-gruppe) og feltene låses (5b). Samme handling brukes når
   * behandler har returnert saken (responded, ball hos melder). Tilstand: draft | responded →
   * received. Migrerings-fri. Transfer-raden gir SPORet (draft→received vs responded→received).
   */
  hmsSendInn: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await hentHmsSjekkliste(ctx.prisma, input.id);
      await verifiserHmsHandling(
        ctx.userId,
        {
          bestillerUserId: sjekkliste.bestillerUserId,
          status: sjekkliste.status,
          projectId: sjekkliste.template.projectId,
        },
        "sendInn",
      );

      const erRetur = sjekkliste.status === "responded";

      const resultat = await ctx.prisma.$transaction(async (tx) => {
        const oppdatert = await tx.checklist.update({
          where: { id: input.id },
          data: {
            status: avledetStatus({ terminal: null, retning: null, sendt: true }),
            sendt: true,
            aktivPosisjon: sjekkliste.dokumentflytId ? 2 : sjekkliste.aktivPosisjon,
            retning: null,
            terminal: null,
          },
        });
        await tx.documentTransfer.create({
          data: {
            checklistId: input.id,
            senderId: ctx.userId,
            fromStatus: sjekkliste.status,
            toStatus: "received",
            comment: erRetur ? "Revidert og sendt tilbake til behandler" : "Sendt inn til behandling",
          },
        });
        return oppdatert;
      });

      // Varsle Behandler-ledd (HMS-gruppen) — saken er nå live hos behandler.
      if (sjekkliste.recipientGroupId) {
        await sendHmsVarsel(ctx.prisma, {
          dokumentId: sjekkliste.id,
          tittel: sjekkliste.title,
          nummer: sjekkliste.number,
          prefix: sjekkliste.template.prefix,
          projectId: sjekkliste.template.projectId,
          prosjektNavn: sjekkliste.template.project.name,
          avsenderId: ctx.userId,
          recipientGroupId: sjekkliste.recipientGroupId,
        });
      }

      return resultat;
    }),

  // Slett sjekkliste (myk — legges i papirkurv, kan gjenopprettes i 90 dager).
  // Blokkeres hvis tilknyttede (ikke-slettede) oppgaver finnes.
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: { select: { projectId: true, domain: true } },
          _count: { select: { tasks: { where: IKKE_SLETTET } } },
        },
      });

      await verifiserDokumentTilgang(
        ctx.userId,
        sjekkliste.template.projectId,
        sjekkliste.bestillerFaggruppeId,
        sjekkliste.utforerFaggruppeId,
        sjekkliste.template.domain,
        sjekkliste.id,
        "checklist",
      );

      // Slettevakt (Lukk-som-slette-port, Kenneth-vedtak 2026-08-21): kun `draft`
      // ELLER `closed`. Alt annet må gjennom Lukk først (to-stegs sletting). Gammel
      // «avbrutt»-status (`cancelled`) er uoppnåelig og tatt ut. Meldingen sier hva
      // brukeren KAN gjøre, ikke bare hva som er forbudt.
      if (sjekkliste.status !== "draft" && sjekkliste.status !== "closed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lukk dokumentet først, så kan det slettes",
        });
      }

      if (sjekkliste._count.tasks > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Kan ikke slette sjekklisten fordi den har ${sjekkliste._count.tasks} tilknyttede oppgaver`,
        });
      }

      // Myk slett: behold transfers/images/relasjoner intakt så Gjenopprett gir
      // tilbake et komplett dokument. Ekte delete() skjer kun via «Slett endelig»
      // (papirkurv-routeren) eller 90-dagers sweep.
      await ctx.prisma.checklist.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), deletedById: ctx.userId },
      });
      return { success: true };
    }),

  // Bytt eier av sjekkliste — kun prosjekteier eller registrator/admin
  byttEier: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        nyEierUserId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          template: { select: { projectId: true } },
        },
      });

      const projectId = sjekkliste.template.projectId;

      // Sjekk at bruker er admin eller registrator
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { role: true },
      });
      const medlem = await ctx.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: ctx.userId, projectId } },
      });
      const erAdmin = bruker.role === "sitedoc_admin" || medlem?.role === "admin";

      if (!erAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Kun prosjekteier eller admin kan bytte eier",
        });
      }

      // Valider at ny eier tilhører samme faggruppe (kun relevant når sjekklisten
      // er knyttet til en faggruppe — HMS-sjekklister har null bestillerFaggruppeId)
      const nyEierMedlem = sjekkliste.bestillerFaggruppeId
        ? await ctx.prisma.projectMember.findFirst({
            where: {
              userId: input.nyEierUserId,
              projectId,
              faggruppeKoblinger: { some: { faggruppeId: sjekkliste.bestillerFaggruppeId } },
            },
          })
        : await ctx.prisma.projectMember.findFirst({
            where: { userId: input.nyEierUserId, projectId },
          });

      if (!nyEierMedlem) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ny eier må tilhøre samme faggruppe som dokumentet",
        });
      }

      return ctx.prisma.checklist.update({
        where: { id: input.id },
        data: { eierUserId: input.nyEierUserId },
      });
    }),

  // Flytt sjekkliste til en annen dokumentflyt (Sentralbord)
  // @deprecated — Bruk endreStatus med nyStatus="forwarded" + dokumentflytId i stedet. Beholdes for bakoverkompatibilitet
  flytt: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        nyDokumentflytId: z.string().uuid(),
        /** Ny mottaker utledet fra ny dokumentflyt */
        recipientUserId: z.string().uuid().optional(),
        recipientGroupId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verifiser admin eller registrator
      const tillatelser = await hentBrukerTillatelser(ctx.userId, input.projectId);
      const erRegistrator = tillatelser.has("create_checklists") || tillatelser.has("create_tasks");

      const bruker = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true, name: true } });
      const medlem = await ctx.prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: ctx.userId, projectId: input.projectId } },
      });
      const erProjektAdmin = bruker?.role === "sitedoc_admin" || medlem?.role === "admin";

      if (!erProjektAdmin && !erRegistrator) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kun admin og registratorer kan flytte dokumenter" });
      }

      // Hent sjekklisten
      const sjekkliste = await ctx.prisma.checklist.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          utforerFaggruppe: { select: { name: true } },
        },
      });

      // Verifiser status
      const tillattStatus = ["draft", "sent", "received", "in_progress"];
      if (!tillattStatus.includes(sjekkliste.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kan ikke flytte dokumenter med status: " + sjekkliste.status });
      }

      // Hent ny dokumentflyt
      const nyFlyt = await ctx.prisma.dokumentflyt.findUniqueOrThrow({
        where: { id: input.nyDokumentflytId },
        include: { faggruppe: { select: { id: true, name: true } } },
      });

      if (!nyFlyt.faggruppeId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Dokumentflyten mangler faggruppe" });
      }

      const gammelFaggruppeNavn = sjekkliste.utforerFaggruppe?.name ?? "Ukjent";
      const nyFaggruppeNavn = nyFlyt.faggruppe?.name ?? "Ukjent";
      const brukerNavn = bruker?.name ?? "Ukjent";

      return ctx.prisma.$transaction(async (tx) => {
        await tx.checklist.update({
          where: { id: input.id },
          data: {
            dokumentflytId: input.nyDokumentflytId,
            utforerFaggruppeId: nyFlyt.faggruppeId!,
            recipientUserId: input.recipientUserId ?? null,
          },
        });

        await tx.documentTransfer.create({
          data: {
            checklistId: input.id,
            senderId: ctx.userId,
            recipientUserId: input.recipientUserId,
            recipientGroupId: input.recipientGroupId,
            fromStatus: sjekkliste.status,
            toStatus: sjekkliste.status,
            comment: `Flyttet av ${brukerNavn} fra ${gammelFaggruppeNavn} til ${nyFaggruppeNavn}`,
            senderEnterpriseName: gammelFaggruppeNavn,
            recipientEnterpriseName: nyFaggruppeNavn,
            dokumentflytName: nyFlyt.name,
            senderRolle: "registrator",
          },
        });

        return { success: true };
      });
    }),
});
