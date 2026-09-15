import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { type PrismaClient, Prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { faseFraHeadingLabel, reportObjectTypeSchema, templateZoneSchema } from "@sitedoc/shared";
import { finnLedigeMalVerdier } from "./mal";
import { kopierObjektTre } from "./objektkopi";

// Config-schema (som firmamal.ts): vilkårlig JSON for rapportobjekt-konfigurasjon.
const configSchema = z.preprocess(
  (val) => val,
  z.record(z.string(), z.unknown()),
) as z.ZodType<Record<string, unknown>>;

/**
 * Sentralarkivet er SiteDocs eget, delt av alle kunder — redigering er kun
 * for sitedoc_admin (spec kontrollplan.md:584). Firma-/prosjektadmin har IKKE
 * tilgang; en retting her slår gjennom på alle framtidige importer.
 */
async function verifiserSiteDocAdmin(prisma: PrismaClient, userId: string): Promise<void> {
  const bruker = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (bruker?.role !== "sitedoc_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Kun SiteDoc-admin kan redigere sentralarkivet" });
  }
}

// Ett felt i en bibliotekmals malInnhold (JSON). Speiler seed-formen
// { label, type, zone, fase, config } + valgfri required/sortOrder som
// feltredigeringen (FeltKonfigurasjon) fører. importerMal leser label/type/
// zone/fase/config/sortOrder — alle bevares gjennom en redigering.
const feltSchema = z.object({
  label: z.string(),
  type: z.string().min(1),
  zone: z.string().optional(),
  fase: z.string().nullable().optional(),
  config: z.record(z.unknown()).optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const bibliotekRouter = router({
  /** Alle standarder med kapitler og maler */
  hentStandarder: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.bibliotekStandard.findMany({
        where: { aktiv: true },
        orderBy: { sortering: "asc" },
        include: {
          kapitler: {
            orderBy: { sortering: "asc" },
            include: {
              maler: {
                where: { aktiv: true },
                orderBy: { navn: "asc" },
                select: {
                  id: true,
                  navn: true,
                  referanse: true,
                  beskrivelse: true,
                  versjon: true,
                  verifisert: true,
                  // To skalarfelt for KLIENT-typefilter i «Hent fra arkiv»-modalen
                  // (ordre arkivmodal-typefilter, TILLEGG 3). SiteDoc-fanen filtreres på
                  // samme akse som firmaarkiv-fanen (`faneWhere`). Ikke serverfilter,
                  // ikke gating — kun signalet klienten trenger for å skille flatene.
                  kategori: true,
                  domene: true,
                },
              },
            },
          },
        },
      });
    }),

  /**
   * Feltlisten for ÉN sentralmal — for «inspiser før lån» (L1, AM4b).
   *
   * Vei C (ordre bibliotekmal-objekttabell TILLEGG 1, Krav 4): kilden er RADENE
   * (`BibliotekMalObjekt`), ikke den frosne `malInnhold`-JSON-en — ellers viser
   * forhåndsvisningen én ting og lånet (`firmamal.laanFraSentralarkiv`) en annen så
   * snart en rad endres i del 2. Nå leser begge samme rader.
   *
   * Lazy med vilje: `hentStandarder` selecter IKKE innhold, og skal ikke. Å laste
   * objektene for alle maler ved dialog-åpning skalerer med totalt antall felt i HELE
   * arkivet (regresjonen ordren skal hindre). Denne henter kun radene for den malen
   * brukeren faktisk åpner forhåndsvisningen på.
   *
   * Returkontrakten er uendret: felt UTEN heading-radene, i sortOrder-rekkefølge, med
   * `fase` for gruppering i UI. Fasen lever nå som heading-rader, så den rekonstrueres:
   * hvert felt arver fasen til nærmest foregående heading (samme gruppering som lånet gir).
   */
  hentMalInnhold: protectedProcedure
    .input(z.object({ bibliotekMalId: z.string() }))
    .query(async ({ ctx, input }) => {
      const mal = await ctx.prisma.bibliotekMal.findUniqueOrThrow({
        where: { id: input.bibliotekMalId },
        select: { id: true, navn: true, referanse: true },
      });
      const objekter = await ctx.prisma.bibliotekMalObjekt.findMany({
        where: { templateId: mal.id },
        orderBy: { sortOrder: "asc" },
      });
      let gjeldendeFase: string | null = null;
      const felter: { label: string; type: string; fase: string | null }[] = [];
      for (const o of objekter) {
        if (o.type === "heading") {
          gjeldendeFase = faseFraHeadingLabel(o.label);
          continue;
        }
        felter.push({ label: o.label, type: o.type, fase: gjeldendeFase });
      }
      return { id: mal.id, navn: mal.navn, referanse: mal.referanse, felter };
    }),

  /** Hvilke bibliotekmaler prosjektet har aktivert */
  hentProsjektValg: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.prosjektBibliotekValg.findMany({
        where: { prosjektId: input.projectId },
        select: {
          id: true,
          bibliotekMalId: true,
          sjekklisteMalId: true,
          aktivertDato: true,
          bibliotekMal: {
            select: {
              navn: true,
              referanse: true,
              kapittel: {
                select: {
                  kode: true,
                  navn: true,
                  standard: { select: { kode: true, navn: true } },
                },
              },
            },
          },
        },
      });
    }),

  /** Importer en bibliotekmal til prosjektet */
  importerMal: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      bibliotekMalId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // Sjekk om allerede importert
      const eksisterende = await ctx.prisma.prosjektBibliotekValg.findUnique({
        where: {
          prosjektId_bibliotekMalId: {
            prosjektId: input.projectId,
            bibliotekMalId: input.bibliotekMalId,
          },
        },
      });
      if (eksisterende) {
        throw new TRPCError({ code: "CONFLICT", message: "Malen er allerede importert til dette prosjektet" });
      }

      // Hent bibliotekmal
      const bibMal = await ctx.prisma.bibliotekMal.findUniqueOrThrow({
        where: { id: input.bibliotekMalId },
        include: { kapittel: { include: { standard: true } } },
      });

      // Vei C: objekt-treet leses fra RADENE (BibliotekMalObjekt), ikke fra `malInnhold`.
      // Overskriftene ligger som egne heading-rader og kopieres verbatim — ingen generering.
      const kildeObjekter = await ctx.prisma.bibliotekMalObjekt.findMany({
        where: { templateId: bibMal.id },
        orderBy: { sortOrder: "asc" },
      });

      // Unikhet (2026-08-10): auto-generér ledig navn + prefiks. Bibliotek-navn/
      // referanse-token kan kollidere med eksisterende prosjekt-mal → ville brutt
      // sperren. Auto-suffiks (som kopier); backstop er DB-indeksen.
      const ledig = await finnLedigeMalVerdier(
        ctx.prisma,
        input.projectId,
        bibMal.kategori,
        bibMal.navn,
        bibMal.referanse.split(/[\s\/]/)[0] ?? null,
      );

      // Opprett ReportTemplate (SjekklisteMal)
      const template = await ctx.prisma.reportTemplate.create({
        data: {
          projectId: input.projectId,
          name: ledig.name,
          description: `${bibMal.kapittel.standard.kode} ${bibMal.referanse}${bibMal.beskrivelse ? " — " + bibMal.beskrivelse : ""}`,
          category: bibMal.kategori,
          domain: bibMal.domene,
          prefix: ledig.prefix ?? undefined,
        },
      });

      // Kopiér objekt-treet verbatim fra radene til ReportObject (to-pass id-map for
      // parentId; sentralarkivet er flatt i dag, så pass 2 er tomt).
      await kopierObjektTre(
        kildeObjekter,
        (data) =>
          ctx.prisma.reportObject.create({
            data: { templateId: template.id, ...data },
            select: { id: true },
          }),
        (id, parentId) =>
          ctx.prisma.reportObject.update({ where: { id }, data: { parentId } }).then(() => undefined),
      );

      // Opprett ProsjektBibliotekValg
      await ctx.prisma.prosjektBibliotekValg.create({
        data: {
          prosjektId: input.projectId,
          bibliotekMalId: input.bibliotekMalId,
          sjekklisteMalId: template.id,
          aktivertAv: ctx.userId,
        },
      });

      return { sjekklisteMalId: template.id, malNavn: bibMal.navn };
    }),

  /** Fjern importert bibliotekmal fra prosjekt */
  fjernValg: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      valgId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const valg = await ctx.prisma.prosjektBibliotekValg.findUniqueOrThrow({
        where: { id: input.valgId },
      });
      if (valg.prosjektId !== input.projectId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Valget tilhører et annet prosjekt" });
      }

      await ctx.prisma.prosjektBibliotekValg.delete({ where: { id: input.valgId } });
      return { ok: true };
    }),

  /**
   * Full mal for redigering i /admin/bibliotek (sitedoc_admin). I motsetning til
   * `hentMalInnhold` (som stripper config og fase-overskrifter for «inspiser før
   * lån») returnerer denne RÅ malInnhold med config — feltredigeringen trenger alt.
   */
  hentMalRedigering: protectedProcedure
    .input(z.object({ bibliotekMalId: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);
      const mal = await ctx.prisma.bibliotekMal.findUniqueOrThrow({
        where: { id: input.bibliotekMalId },
        select: {
          id: true,
          navn: true,
          referanse: true,
          beskrivelse: true,
          verifisert: true,
          malInnhold: true,
          kapittel: {
            select: {
              kode: true,
              navn: true,
              standard: { select: { kode: true, navn: true } },
            },
          },
        },
      });
      return mal;
    }),

  /**
   * Rediger en eksisterende sentralmal (sitedoc_admin). Retteveien inn i arkivet.
   *
   * Rører KUN arkivmalen: navn/referanse/beskrivelse + hele malInnhold-lista
   * (felt-etikett, type, hjelpetekst, valgopsjoner, fase, rekkefølge). Kopierings-
   * modellen (spec:631) er enveis — allerede importerte firma-/prosjektmaler er
   * frosne snapshots og røres IKKE herfra.
   *
   * `verifisert` settes bevisst IKKE her: feltet betyr «fagkontrollert mot normen»,
   * en tekstretting er ikke en fagkontroll, og prod-gaten (seed-bibliotek.ts:645)
   * hviler på flagget. `aktiv`/`versjon`/`kategori`/`domene` er også utenfor scope.
   */
  oppdaterMal: protectedProcedure
    .input(z.object({
      bibliotekMalId: z.string(),
      navn: z.string().min(1),
      referanse: z.string().min(1),
      beskrivelse: z.string().nullable(),
      malInnhold: z.array(feltSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);

      // Kaster NOT_FOUND hvis malen er borte — klienten viser meldingen (ingen stille feil).
      await ctx.prisma.bibliotekMal.findUniqueOrThrow({
        where: { id: input.bibliotekMalId },
        select: { id: true },
      });

      // Normaliser sortOrder til array-rekkefølgen (innenfor hver fase gjelder
      // array-orden i importerMal; eksplisitt sortOrder holder hentMalInnhold enig).
      const malInnhold = input.malInnhold.map((f, i) => ({ ...f, sortOrder: i })) as unknown as Prisma.InputJsonValue;

      const oppdatert = await ctx.prisma.bibliotekMal.update({
        where: { id: input.bibliotekMalId },
        data: {
          navn: input.navn,
          referanse: input.referanse,
          // Tom beskrivelse lagres som null (DB skal aldri bære "" — defensivt uansett kaller).
          beskrivelse: input.beskrivelse || null,
          malInnhold,
        },
        select: { id: true, navn: true, referanse: true, beskrivelse: true, malInnhold: true },
      });
      return oppdatert;
    }),

  /* --- Vei C del 2 (ordre malbygger-sitedoc-niva): MalBygger på SiteDoc-nivå ----------
   * Speiler firmamal.ts sine objekt-prosedyrer FELT FOR FELT, men mot BibliotekMalObjekt-
   * RADENE (ikke den frosne `malInnhold`-JSON-en). «C fjerner spesialtilfellet»: sentralmaler
   * får samme redigeringsevne som firma/prosjekt. Gate: verifiserSiteDocAdmin (sentralarkivet
   * er SiteDocs eget, delt av alle kunder) — IKKE autoriserMalTilgang. INGEN objektlås og
   * INGEN slett-vern: ingen Checklist/Task peker på BibliotekMalObjekt (dokumentdata henger på
   * ReportObject i prosjekt-kopier), så treet er fritt redigerbart — som firmanivå. */

  /**
   * Én sentralmal med hele objekt-treet — for redigering i MalBygger på sitedoc-nivå.
   * Speiler firmamal.hent: rå objekt-rader i sortOrder, config verbatim. Mapper
   * BibliotekMal-feltnavn til MalBygger-formen (navn→name, beskrivelse→description,
   * kategori→category). `malId` er en cuid (BibliotekMal.id), derfor z.string() — ikke uuid.
   */
  hent: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);
      const mal = await ctx.prisma.bibliotekMal.findUniqueOrThrow({
        where: { id: input.id },
        include: { objekter: { orderBy: { sortOrder: "asc" } } },
      });
      return {
        id: mal.id,
        name: mal.navn,
        description: mal.beskrivelse,
        category: mal.kategori,
        objects: mal.objekter.map((o) => ({
          id: o.id,
          type: o.type,
          label: o.label,
          required: o.required,
          sortOrder: o.sortOrder,
          config: o.config,
          parentId: o.parentId,
        })),
      };
    }),

  /**
   * Oppdater sentralmal-metadata (MalBygger inline navn-redigering). BibliotekMal bærer
   * IKKE fastefelt-kolonnene (subjects/showSubject/showLocation/showPriority) som firma/
   * prosjekt har — de skjules derfor i MalBygger på sitedoc-nivå (meldt avvik, ingen
   * skjemaendring denne runden). Kun navn/beskrivelse endres her; `malInnhold` (frossen)
   * røres ikke. `referanse` og `verifisert` er utenfor scope (som oppdaterMal).
   */
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);
      await ctx.prisma.bibliotekMal.findUniqueOrThrow({
        where: { id: input.id },
        select: { id: true },
      });
      await ctx.prisma.bibliotekMal.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { navn: input.name.trim() } : {}),
          ...(input.description !== undefined ? { beskrivelse: input.description } : {}),
        },
        select: { id: true },
      });
      return { id: input.id };
    }),

  leggTilObjekt: protectedProcedure
    .input(
      z.object({
        templateId: z.string(),
        type: reportObjectTypeSchema,
        label: z.string().min(1),
        config: configSchema.default({}),
        sortOrder: z.number().int().min(0),
        required: z.boolean().default(false),
        parentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);
      // Ren NOT_FOUND ved ukjent mal i stedet for rå FK-feil.
      await ctx.prisma.bibliotekMal.findUniqueOrThrow({
        where: { id: input.templateId },
        select: { id: true },
      });
      const { parentId, ...rest } = input;
      // `translations` utelates → schema-default "{}" (tom, ikke NULL) — som firmanivå (Krav 1).
      return ctx.prisma.bibliotekMalObjekt.create({
        data: {
          ...rest,
          config: rest.config as Prisma.InputJsonValue,
          ...(parentId !== undefined ? { parentId } : {}),
        },
      });
    }),

  oppdaterObjekt: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        // Tom streng er en gyldig, ønsket verdi (navnløst felt) — som firmamal.oppdaterObjekt.
        label: z.string().optional(),
        required: z.boolean().optional(),
        config: configSchema.optional(),
        parentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);
      await ctx.prisma.bibliotekMalObjekt.findUniqueOrThrow({
        where: { id: input.id },
        select: { id: true },
      });
      const { id, config, parentId, ...rest } = input;
      return ctx.prisma.bibliotekMalObjekt.update({
        where: { id },
        data: {
          ...rest,
          ...(config !== undefined ? { config: config as Prisma.InputJsonValue } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
        },
      });
    }),

  oppdaterRekkefolge: protectedProcedure
    .input(
      z.object({
        objekter: z.array(
          z.object({
            id: z.string().uuid(),
            sortOrder: z.number().int().min(0),
            zone: templateZoneSchema.optional(),
            parentId: z.string().uuid().nullable().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);
      const forste = input.objekter[0];
      if (!forste) return [];
      return ctx.prisma.$transaction(async (tx) => {
        const resultater = [];
        for (const obj of input.objekter) {
          const oppdatering: Record<string, unknown> = { sortOrder: obj.sortOrder };
          if (obj.parentId !== undefined) oppdatering.parentId = obj.parentId;
          if (obj.zone) {
            const eksisterende = await tx.bibliotekMalObjekt.findUniqueOrThrow({
              where: { id: obj.id },
            });
            const eksisterendeConfig =
              typeof eksisterende.config === "object" && eksisterende.config !== null
                ? (eksisterende.config as Record<string, unknown>)
                : {};
            oppdatering.config = {
              ...eksisterendeConfig,
              zone: obj.zone,
            } as Prisma.InputJsonValue;
          }
          resultater.push(
            await tx.bibliotekMalObjekt.update({ where: { id: obj.id }, data: oppdatering }),
          );
        }
        return resultater;
      });
    }),

  slettObjekt: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserSiteDocAdmin(ctx.prisma, ctx.userId);
      await ctx.prisma.bibliotekMalObjekt.findUniqueOrThrow({
        where: { id: input.id },
        select: { id: true },
      });
      // Ingen slett-vern: sentralmal-objekter bærer ingen dokumentdata (som firmanivå).
      // CASCADE fjerner barn (schema BibliotekObjektHierarki onDelete: Cascade).
      return ctx.prisma.bibliotekMalObjekt.delete({ where: { id: input.id } });
    }),
});
