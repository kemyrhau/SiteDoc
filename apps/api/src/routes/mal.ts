import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { reportObjectTypeSchema, templateZoneSchema, createTemplateSchema } from "@sitedoc/shared";
import { verifiserProsjektmedlem, verifiserAdmin, hentBrukersOpprettFlytMedlemskap } from "../trpc/tilgangskontroll";
import { IKKE_SLETTET, KUN_SLETTET } from "../utils/softDelete";
import { oversettMedMotor, hashTekst } from "../services/oversettelse-service";
import type { OversettelsesMotor } from "../services/oversettelse-service";

// Config-schema: aksepterer vilkårlig JSON for rapportobjekt-konfigurasjon
const configSchema = z.preprocess(
  (val) => val,
  z.record(z.string(), z.unknown()),
) as z.ZodType<Record<string, unknown>>;

// Subdomain ↔ category-mapping (vedtatt 2026-05-29).
// avvik+ruh bruker task-shape (oppgave); sja bruker checklist-shape.
// HMS-fanene i hms.ts er hardkodet til disse datakildene — feilkombinasjon
// gjør at dokumenter opprettes i feil tabell og forsvinner stille fra alle
// visninger (HMS-fanen ekskluderer feil tabell; Oppgaver/Sjekklister-fanen
// ekskluderer fordi domain="hms" filtreres bort der).
function valideerSubdomainCategory(
  subdomain: "avvik" | "sja" | "ruh" | null | undefined,
  category: "oppgave" | "sjekkliste" | "hms" | undefined,
): void {
  if (!subdomain || !category) return;
  // HMS er egen topp-nivå-type; subdomain (avvik/sja/ruh) bestemmer datatabellen
  // (task vs checklist), ikke category. Ingen shape-sjekk mot category nødvendig.
  if (category === "hms") return;
  const forventet: Record<"avvik" | "sja" | "ruh", "oppgave" | "sjekkliste"> = {
    avvik: "oppgave",
    ruh: "oppgave",
    sja: "sjekkliste",
  };
  if (category !== forventet[subdomain]) {
    throw new Error(
      "SJA bruker sjekkliste-format. Avvik og RUH bruker oppgave-format.",
    );
  }
}

// P4b pkt 0: eksplisitt (grunn) returtype for mal-lista så tRPC ikke dyp-
// infererer AppRouter-typen (unngår TS2589 i andre prosedyrer, f.eks.
// oppgave.opprett). opprettbar/opprettbareFlytIder er den delte opprett-regelen.
type MalListeElement = Prisma.ReportTemplateGetPayload<{
  include: {
    _count: { select: { objects: true; checklists: true; tasks: true } };
    dokumentflytMaler: { select: { dokumentflytId: true } };
  };
}> & { opprettbar: boolean; opprettbareFlytIder: string[]; harAktivLocation: boolean };

// Slett-vern (2026-08-10): tell mal-dokumenter — aktive og i papirkurv separat.
// Papirkurv (KUN_SLETTET) teller med: 90-dagers gjenoppretting ville ellers gjort
// en gjenopprettet oppgave/sjekkliste foreldreløs hvis malen var slettet.
async function tellMalDokumenter(
  prisma: typeof import("@sitedoc/db").prisma,
  templateId: string,
): Promise<{ aktive: number; iKurv: number }> {
  const [aktivOppg, aktivSjekk, kurvOppg, kurvSjekk] = await Promise.all([
    prisma.task.count({ where: { templateId, ...IKKE_SLETTET } }),
    prisma.checklist.count({ where: { templateId, ...IKKE_SLETTET } }),
    prisma.task.count({ where: { templateId, ...KUN_SLETTET } }),
    prisma.checklist.count({ where: { templateId, ...KUN_SLETTET } }),
  ]);
  return { aktive: aktivOppg + aktivSjekk, iKurv: kurvOppg + kurvSjekk };
}

// Mal-unikhet (2026-08-10): speiler de funksjonelle unik-indeksene (migrering
// 20260810120000). Normalisering lower(trim(...)) — SAMME som indeksens
// lower(btrim(...)) — så app-feilen stemmer med DB-sperren. Navn: på tvers av
// kategorier. Prefiks: kun der prefiks finnes og category<>'psi' (PSI bruker
// prefix som fast type-etikett, ikke doc-nr — eksempt fra sperren).
const normMal = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

async function sjekkMalUnikhet(
  prisma: typeof import("@sitedoc/db").prisma,
  args: { projectId: string; name: string; prefix?: string | null; category: string; ignorerId?: string },
): Promise<void> {
  const nyttNavn = normMal(args.name);
  const nyttPrefiks = normMal(args.prefix);
  const eksisterende = await prisma.reportTemplate.findMany({
    where: { projectId: args.projectId, ...(args.ignorerId ? { id: { not: args.ignorerId } } : {}) },
    select: { id: true, name: true, prefix: true, category: true },
  });
  const navnKonflikt = eksisterende.find((m) => normMal(m.name) === nyttNavn);
  if (navnKonflikt) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Malnavnet «${args.name.trim()}» er allerede i bruk i dette prosjektet.`,
    });
  }
  if (nyttPrefiks && args.category !== "psi") {
    const prefiksKonflikt = eksisterende.find(
      (m) => m.category !== "psi" && normMal(m.prefix) === nyttPrefiks,
    );
    if (prefiksKonflikt) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Prefikset «${args.prefix?.trim()}» er allerede i bruk av malen «${prefiksKonflikt.name}» i dette prosjektet.`,
      });
    }
  }
}

// Auto-generér ledig navn + prefiks (kopier/import — minst friksjon, sperren er
// backstop). Suffikser numerisk til ledig: «X (kopi)»→«X (kopi) 2», «BEF»→«BEF2».
export async function finnLedigeMalVerdier(
  prisma: typeof import("@sitedoc/db").prisma,
  projectId: string,
  category: string,
  ønsketNavn: string,
  ønsketPrefiks: string | null,
): Promise<{ name: string; prefix: string | null }> {
  const eksisterende = await prisma.reportTemplate.findMany({
    where: { projectId },
    select: { name: true, prefix: true, category: true },
  });
  const navnBrukt = new Set(eksisterende.map((m) => normMal(m.name)));
  const prefiksBrukt = new Set(
    eksisterende.filter((m) => m.category !== "psi").map((m) => normMal(m.prefix)).filter(Boolean),
  );

  const basisNavn = ønsketNavn.trim();
  let navn = basisNavn;
  for (let i = 2; navnBrukt.has(normMal(navn)); i++) navn = `${basisNavn} ${i}`;

  let prefiks = ønsketPrefiks?.trim() || null;
  if (prefiks && category !== "psi") {
    const basisPrefiks = prefiks;
    for (let i = 2; prefiksBrukt.has(normMal(prefiks)); i++) prefiks = `${basisPrefiks}${i}`;
  }
  return { name: navn, prefix: prefiks };
}

export const malRouter = router({
  // Hent alle maler for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<MalListeElement[]> => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const maler = await ctx.prisma.reportTemplate.findMany({
        where: { projectId: input.projectId },
        include: {
          _count: { select: { objects: true, checklists: { where: IKKE_SLETTET }, tasks: { where: IKKE_SLETTET } } },
          dokumentflytMaler: { select: { dokumentflytId: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      // P4b pkt 0: opprettbarhet som ADDITIV metadata (ikke hard-filter — mal-admin
      // trenger alle). DELT kilde med opprett-valideringen: en mal er opprettbar hvis
      // den ligger i ≥1 dokumentflyt der brukeren er registrator-medlem
      // (hentBrukersOpprettFlytMedlemskap — samme fn opprett-valideringen avviser på)
      // OG flyten har eier-faggruppe (bestiller kan utledes). HMS-maler er alltid
      // opprettbare (auto-rutes til HMS-gruppen, flyt-løse). En mal som ville feile
      // ved Opprett får opprettbar=false og skjules i velgerne (web + mobil).
      const opprettFlytIder = await hentBrukersOpprettFlytMedlemskap(ctx.userId, input.projectId);
      const flyterMedEierFaggruppe =
        opprettFlytIder.length > 0
          ? await ctx.prisma.dokumentflyt.findMany({
              where: { id: { in: opprettFlytIder }, faggruppeId: { not: null } },
              select: { id: true },
            })
          : [];
      const gyldigeFlytIder = new Set(flyterMedEierFaggruppe.map((f) => f.id));

      // Location-tvang (vedtatt 2026-08-19): en mal har «aktiv location» hvis den har
      // ≥1 report_object type='location' som IKKE er betinget (parentId=null OG ingen
      // config.conditionParentId) — da kreves posisjon (punkt på tegning) ved
      // opprettelse på mobil. Sone er irrelevant (begge soner rendres på mobil). Et
      // betinget location kan ikke garantere synlighet ved opprettelse → teller ikke.
      const malIds = maler.map((m) => m.id);
      const locationObjekter = malIds.length > 0
        ? await ctx.prisma.reportObject.findMany({
            where: { templateId: { in: malIds }, type: "location", parentId: null },
            select: { templateId: true, config: true },
          })
        : [];
      const aktivLocationMalIds = new Set(
        locationObjekter
          .filter((o) => {
            const c = o.config as { conditionParentId?: unknown } | null;
            return !(typeof c?.conditionParentId === "string" && c.conditionParentId.length > 0);
          })
          .map((o) => o.templateId),
      );

      return maler.map((mal) => {
        const erHms = mal.domain === "hms";
        const opprettbareFlytIder = erHms
          ? []
          : mal.dokumentflytMaler
              .map((dm) => dm.dokumentflytId)
              .filter((id) => gyldigeFlytIder.has(id));
        return {
          ...mal,
          opprettbar: erHms || opprettbareFlytIder.length > 0,
          opprettbareFlytIder,
          harAktivLocation: aktivLocationMalIds.has(mal.id),
        };
      });
    }),

  // Hent én mal med alle objekter
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mal = await ctx.prisma.reportTemplate.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          objects: { orderBy: { sortOrder: "asc" } },
          project: true,
          dokumentflytMaler: { select: { dokumentflytId: true } },
        },
      });
      await verifiserProsjektmedlem(ctx.userId, mal.projectId);
      return mal;
    }),

  // Klient-signal: kan innlogget bruker REDIGERE prosjektets maler? Speiler
  // mutasjonenes verifiserAdmin-gate (sitedoc_admin | prosjektadmin | firma-admin)
  // uten å kaste, så malbygger-/mal-liste-UI kan skjule opprett/rediger/slett for
  // vanlige medlemmer. Samme funksjon som gaten → UI og server kan ikke divergere
  // (manage_field og ProjectMember-only-sjekk gjør begge det). Query, ikke gatet
  // som admin: alle medlemmer må kunne spørre «har jeg lov?».
  kanRedigere: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        await verifiserAdmin(ctx.userId, input.projectId);
        return true;
      } catch {
        return false;
      }
    }),

  // Opprett ny mal
  opprett: protectedProcedure
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);
      valideerSubdomainCategory(input.subdomain, input.category);
      // Unikhet per prosjekt (navn på tvers, prefiks eks-PSI) — lesbar feil før DB-sperren.
      await sjekkMalUnikhet(ctx.prisma, {
        projectId: input.projectId,
        name: input.name,
        prefix: input.prefix,
        category: input.category,
      });
      const { workflowIds, ...malData } = input;

      return ctx.prisma.$transaction(async (tx) => {
        const mal = await tx.reportTemplate.create({ data: malData });
        if (workflowIds.length > 0) {
          await tx.dokumentflytMal.createMany({
            data: workflowIds.map((dokumentflytId) => ({
              dokumentflytId,
              templateId: mal.id,
            })),
            skipDuplicates: true,
          });
        }
        return mal;
      });
    }),

  // Oppdater mal (navn, beskrivelse, prefiks, type, fagområde, dokumentflyt-koblinger)
  oppdaterMal: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        prefix: z.string().max(20).optional(),
        category: z.enum(["oppgave", "sjekkliste", "hms"]).optional(),
        domain: z.enum(["bygg", "hms", "kvalitet"]).optional(),
        subdomain: z.enum(["avvik", "sja", "ruh"]).nullable().optional(),
        hmsSynlighet: z.enum(["privat", "apen"]).nullable().optional(),
        subjects: z.array(z.string().max(255)).optional(),
        showSubject: z.boolean().optional(),
        showFaggruppe: z.boolean().optional(),
        showLocation: z.boolean().optional(),
        showPriority: z.boolean().optional(),
        enableChangeLog: z.boolean().optional(),
        workflowIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, workflowIds, ...data } = input;
      const mal = await ctx.prisma.reportTemplate.findUniqueOrThrow({
        where: { id },
        select: { projectId: true, category: true, domain: true, subdomain: true, name: true, prefix: true },
      });
      await verifiserAdmin(ctx.userId, mal.projectId);

      // Subdomain ↔ category-validering: bruk effektiv tilstand etter
      // oppdatering (input-verdi hvis satt, ellers eksisterende verdi).
      const effektivSubdomain =
        input.subdomain !== undefined
          ? input.subdomain
          : (mal.subdomain as "avvik" | "sja" | "ruh" | null);
      const effektivCategory =
        input.category !== undefined
          ? input.category
          : (mal.category as "oppgave" | "sjekkliste" | "hms");
      valideerSubdomainCategory(effektivSubdomain, effektivCategory);

      // Konverterings-validering: type (category) eller domain kan ikke
      // endres hvis dokumenter eksisterer. Domain-skift uten dokument-sjekk
      // ville etterlatt eksisterende task/checklist med en domain-kopi som
      // ikke lenger matcher malen — stille forsvinning fra HMS-dashbord.
      const skifterCategory =
        input.category !== undefined && input.category !== mal.category;
      const skifterDomain =
        input.domain !== undefined && input.domain !== mal.domain;
      if (skifterCategory || skifterDomain) {
        const [taskAntall, checklistAntall] = await Promise.all([
          ctx.prisma.task.count({ where: { ...IKKE_SLETTET, templateId: id } }),
          ctx.prisma.checklist.count({ where: { ...IKKE_SLETTET, templateId: id } }),
        ]);
        const totalt = taskAntall + checklistAntall;
        if (totalt > 0) {
          throw new Error(
            `Kan ikke endre mal-type — det finnes ${totalt} eksisterende dokumenter knyttet til denne malen`,
          );
        }
      }

      // Unikhet (2026-08-10): sjekk ved endring av navn/prefiks. Effektive verdier,
      // ignorér malen selv. Speiler DB-sperren (navn på tvers, prefiks eks-PSI).
      if (input.name !== undefined || input.prefix !== undefined) {
        await sjekkMalUnikhet(ctx.prisma, {
          projectId: mal.projectId,
          name: input.name !== undefined ? input.name : mal.name,
          prefix: input.prefix !== undefined ? input.prefix : mal.prefix,
          category: effektivCategory,
          ignorerId: id,
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const oppdatert = await tx.reportTemplate.update({ where: { id }, data });
        if (workflowIds !== undefined) {
          await tx.dokumentflytMal.deleteMany({ where: { templateId: id } });
          if (workflowIds.length > 0) {
            await tx.dokumentflytMal.createMany({
              data: workflowIds.map((dokumentflytId) => ({
                dokumentflytId,
                templateId: id,
              })),
              skipDuplicates: true,
            });
          }
        }
        return oppdatert;
      });
    }),

  // Slett-vern precheck (klient bygger bilingual melding + skjuler slett-knapp).
  // Mutasjonen håndhever uansett — dette er kun for UX.
  slettbarhet: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mal = await ctx.prisma.reportTemplate.findUniqueOrThrow({ where: { id: input.id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, mal.projectId);
      const { aktive, iKurv } = await tellMalDokumenter(ctx.prisma, input.id);
      return { aktive, iKurv, kanSlettes: aktive === 0 && iKurv === 0 };
    }),

  // Slett mal — SLETT-VERN (2026-08-10): nekt hvis dokumenter finnes (aktive eller
  // i papirkurv). Lesbar, differensiert melding — for Task ville DB-en ellers ikke
  // engang kastet (SetNull→foreldreløs, nå Restrict-backstop via migrering).
  slettMal: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const mal = await ctx.prisma.reportTemplate.findUniqueOrThrow({ where: { id: input.id }, select: { projectId: true } });
      await verifiserAdmin(ctx.userId, mal.projectId);

      const { aktive, iKurv } = await tellMalDokumenter(ctx.prisma, input.id);
      if (aktive > 0 || iKurv > 0) {
        const melding =
          aktive > 0 && iKurv > 0
            ? `Malen har ${aktive} dokument${aktive === 1 ? "" : "er"} og ${iKurv} i papirkurven, og kan ikke slettes. Fjern dokumentene og tøm papirkurven først.`
            : aktive > 0
              ? `Malen har ${aktive} dokument${aktive === 1 ? "" : "er"} og kan ikke slettes.`
              : `Malen har ${iKurv} dokument${iKurv === 1 ? "" : "er"} i papirkurven. Tøm papirkurven først, så kan malen slettes.`;
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: melding });
      }
      return ctx.prisma.reportTemplate.delete({ where: { id: input.id } });
    }),

  // Kopier mal (dyp kopi av mal + alle rapportobjekter) innen samme prosjekt.
  // Bevarer objekt-treet (parentId) via to-pass id-mapping: pass 1 oppretter
  // alle objekter uten parentId, pass 2 setter parentId fra mappingen. To-pass
  // (ikke ett-pass som psi.ts) unngår at et barn med lavere sortOrder enn sin
  // forelder stille mister koblingen. Firma-lenker (organizationTemplateId,
  // promotedToFirma) kopieres IKKE — kopien er en fersk lokal mal.
  kopier: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const kilde = await ctx.prisma.reportTemplate.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          objects: { orderBy: { sortOrder: "asc" } },
          dokumentflytMaler: { select: { dokumentflytId: true } },
        },
      });
      await verifiserAdmin(ctx.userId, kilde.projectId);

      // Unikhet (2026-08-10): auto-generér ledig navn + prefiks. Kopier kopierte
      // før prefiks 1:1 → ville brutt (projectId, prefix)-sperren. Redigerbart etterpå.
      const ledig = await finnLedigeMalVerdier(
        ctx.prisma,
        kilde.projectId,
        kilde.category,
        `${kilde.name} (kopi)`,
        kilde.prefix,
      );

      // Lean returtype (select: { id }) + eksplisitt { id }-retur holder
      // tRPC-inferensen grunn — full reportTemplate-retur her tipper AppRouter
      // over TS2589-dybdegrensen (kjent fallgruve, se CLAUDE.md § Kodestil).
      const nyMalId = await ctx.prisma.$transaction(async (tx) => {
        const nyMal = await tx.reportTemplate.create({
          data: {
            projectId: kilde.projectId,
            name: ledig.name,
            description: kilde.description,
            prefix: ledig.prefix,
            category: kilde.category,
            domain: kilde.domain,
            subdomain: kilde.subdomain,
            hmsSynlighet: kilde.hmsSynlighet,
            subjects: (kilde.subjects ?? []) as Prisma.InputJsonValue,
            showSubject: kilde.showSubject,
            showFaggruppe: kilde.showFaggruppe,
            showLocation: kilde.showLocation,
            showPriority: kilde.showPriority,
            enableChangeLog: kilde.enableChangeLog,
            kontrollomrade: kilde.kontrollomrade,
            version: 1,
          },
          select: { id: true },
        });

        // Pass 1: opprett alle objekter uten parentId, bygg gammel→ny id-mapping
        const idMapping = new Map<string, string>();
        for (const obj of kilde.objects) {
          const nyttObj = await tx.reportObject.create({
            data: {
              templateId: nyMal.id,
              type: obj.type,
              label: obj.label,
              config: (obj.config ?? {}) as Prisma.InputJsonValue,
              translations: (obj.translations ?? {}) as Prisma.InputJsonValue,
              required: obj.required,
              sortOrder: obj.sortOrder,
            },
          });
          idMapping.set(obj.id, nyttObj.id);
        }

        // Pass 2: sett parentId fra mappingen (bevarer treet uansett rekkefølge)
        for (const obj of kilde.objects) {
          if (!obj.parentId) continue;
          const nyId = idMapping.get(obj.id);
          const nyParentId = idMapping.get(obj.parentId);
          if (nyId && nyParentId) {
            await tx.reportObject.update({
              where: { id: nyId },
              data: { parentId: nyParentId },
            });
          }
        }

        // Kopier dokumentflyt-koblinger
        if (kilde.dokumentflytMaler.length > 0) {
          await tx.dokumentflytMal.createMany({
            data: kilde.dokumentflytMaler.map((k) => ({
              dokumentflytId: k.dokumentflytId,
              templateId: nyMal.id,
            })),
            skipDuplicates: true,
          });
        }

        return nyMal.id;
      });

      return { id: nyMalId };
    }),

  // Legg til rapportobjekt i mal
  leggTilObjekt: protectedProcedure
    .input(
      z.object({
        templateId: z.string().uuid(),
        type: reportObjectTypeSchema,
        label: z.string().min(1),
        config: configSchema.default({}),
        sortOrder: z.number().int().min(0),
        required: z.boolean().default(false),
        parentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mal = await ctx.prisma.reportTemplate.findUniqueOrThrow({ where: { id: input.templateId }, select: { projectId: true } });
      await verifiserAdmin(ctx.userId, mal.projectId);
      const { parentId, ...rest } = input;
      return ctx.prisma.reportObject.create({
        data: {
          ...rest,
          config: rest.config as Prisma.InputJsonValue,
          ...(parentId !== undefined ? { parentId } : {}),
        },
      });
    }),

  // Oppdater et enkelt rapportobjekt
  oppdaterObjekt: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).optional(),
        required: z.boolean().optional(),
        config: configSchema.optional(),
        parentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const objekt = await ctx.prisma.reportObject.findUniqueOrThrow({ where: { id: input.id }, include: { template: { select: { projectId: true } } } });
      await verifiserAdmin(ctx.userId, objekt.template.projectId);
      const { id, config, parentId, ...rest } = input;
      return ctx.prisma.reportObject.update({
        where: { id },
        data: {
          ...rest,
          ...(config !== undefined
            ? { config: config as Prisma.InputJsonValue }
            : {}),
          ...(parentId !== undefined ? { parentId } : {}),
        },
      });
    }),

  // Oppdater rekkefølge, sone og parentId på objekter
  oppdaterRekkefølge: protectedProcedure
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
      const forsteObjekt = input.objekter[0];
      if (forsteObjekt) {
        const objekt = await ctx.prisma.reportObject.findUniqueOrThrow({ where: { id: forsteObjekt.id }, include: { template: { select: { projectId: true } } } });
        await verifiserAdmin(ctx.userId, objekt.template.projectId);
      }
      return ctx.prisma.$transaction(
        async (tx) => {
          const resultater = [];
          for (const obj of input.objekter) {
            const oppdatering: Record<string, unknown> = {
              sortOrder: obj.sortOrder,
            };

            // Oppdater parentId hvis angitt (inkludert null for å fjerne)
            if (obj.parentId !== undefined) {
              oppdatering.parentId = obj.parentId;
            }

            if (obj.zone) {
              const eksisterende = await tx.reportObject.findUniqueOrThrow({
                where: { id: obj.id },
              });
              const eksisterendeConfig =
                typeof eksisterende.config === "object" && eksisterende.config !== null
                  ? (eksisterende.config as Record<string, unknown>)
                  : {};
              oppdatering.config = { ...eksisterendeConfig, zone: obj.zone } as Prisma.InputJsonValue;
            }

            resultater.push(
              await tx.reportObject.update({
                where: { id: obj.id },
                data: oppdatering,
              }),
            );
          }
          return resultater;
        },
      );
    }),

  // Sjekk om et rapportobjekt (og evt. barn) har data i sjekklister/oppgaver
  sjekkObjektBruk: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const objekt = await ctx.prisma.reportObject.findUnique({
        where: { id: input.id },
        include: { template: { select: { projectId: true } } },
      });
      if (!objekt) return { sjekklister: [], oppgaver: [] };
      await verifiserProsjektmedlem(ctx.userId, objekt.template.projectId);

      // Hent alle objekter i malen for å finne etterkommere
      const alleObjekter = await ctx.prisma.reportObject.findMany({
        where: { templateId: objekt.templateId },
        select: { id: true, parentId: true },
      });

      // Samle alle IDer som vil bli slettet (objektet + alle etterkommere)
      const sletteIder = [input.id];
      function finnEtterkommere(parentId: string) {
        for (const o of alleObjekter) {
          if (o.parentId === parentId) {
            sletteIder.push(o.id);
            finnEtterkommere(o.id);
          }
        }
      }
      finnEtterkommere(input.id);

      // Hent sjekklister med data for noen av disse IDene (JSONB ?| operator)
      const sjekklisteIder = await ctx.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM checklists
        WHERE template_id = ${objekt.templateId}
        AND deleted_at IS NULL
        AND data IS NOT NULL
        AND data ?| ${sletteIder}
      `;

      // Hent oppgave-IDer med data for noen av disse IDene
      const oppgaveIder = await ctx.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM tasks
        WHERE template_id = ${objekt.templateId}
        AND deleted_at IS NULL
        AND data IS NOT NULL
        AND data ?| ${sletteIder}
      `;

      // Hent detaljer for berørte sjekklister
      const sjekklister = sjekklisteIder.length > 0
        ? await ctx.prisma.checklist.findMany({
            where: { ...IKKE_SLETTET, id: { in: sjekklisteIder.map((r) => r.id) } },
            select: {
              id: true,
              title: true,
              number: true,
              status: true,
              template: { select: { prefix: true, projectId: true } },
            },
          })
        : [];

      // Hent detaljer for berørte oppgaver
      const oppgaver = oppgaveIder.length > 0
        ? await ctx.prisma.task.findMany({
            where: { ...IKKE_SLETTET, id: { in: oppgaveIder.map((r) => r.id) } },
            select: {
              id: true,
              title: true,
              number: true,
              status: true,
              template: { select: { prefix: true, projectId: true } },
            },
          })
        : [];

      return { sjekklister, oppgaver };
    }),

  // Slett rapportobjekt
  slettObjekt: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const objekt = await ctx.prisma.reportObject.findUniqueOrThrow({ where: { id: input.id }, include: { template: { select: { projectId: true } } } });
      await verifiserAdmin(ctx.userId, objekt.template.projectId);

      // Slett-vern (2026-08-10): objekt (+ etterkommere) med data i sjekklister/
      // oppgaver kan ikke slettes — Task.data/Checklist.data (JSONB nøklet på
      // ReportObject.id) ville blitt uleselig. Server-guard; UI hadde bare
      // `sjekkObjektBruk` (skjuler knappen), ingen håndhevelse. Teller aktive OG
      // papirkurv (samme begrunnelse som slettMal).
      const alleObjekter = await ctx.prisma.reportObject.findMany({
        where: { templateId: objekt.templateId },
        select: { id: true, parentId: true },
      });
      const sletteIder = [input.id];
      const finnEtterkommere = (parentId: string) => {
        for (const o of alleObjekter) {
          if (o.parentId === parentId) {
            sletteIder.push(o.id);
            finnEtterkommere(o.id);
          }
        }
      };
      finnEtterkommere(input.id);
      const [sjekkMed, oppgMed] = await Promise.all([
        ctx.prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM checklists WHERE template_id = ${objekt.templateId} AND data IS NOT NULL AND data ?| ${sletteIder}`,
        ctx.prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM tasks WHERE template_id = ${objekt.templateId} AND data IS NOT NULL AND data ?| ${sletteIder}`,
      ]);
      const antall = Number(sjekkMed[0]?.n ?? 0) + Number(oppgMed[0]?.n ?? 0);
      if (antall > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Feltet brukes i ${antall} dokument${antall === 1 ? "" : "er"} og kan ikke slettes.`,
        });
      }
      return ctx.prisma.reportObject.delete({ where: { id: input.id } });
    }),

  // On-demand oversettelse av firmainnhold (feltlabels, hjelpetekst, valgalternativer)
  oversettFelter: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      tekster: z.array(z.string().min(1)).min(1).max(200),
      targetLang: z.string().min(2).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // Hent prosjektets kildespråk
      const prosjekt = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { sourceLanguage: true },
      });
      const sourceLang = prosjekt.sourceLanguage ?? "nb";

      // Ingen oversettelse nødvendig hvis samme språk
      if (sourceLang === input.targetLang) {
        return Object.fromEntries(input.tekster.map((t) => [t, t]));
      }

      // Sjekk TranslationCache
      const hashes = input.tekster.map((t) => hashTekst(t));
      const hashTilTekst = new Map(input.tekster.map((t, i) => [hashes[i]!, t]));
      const cached = await ctx.prisma.translationCache.findMany({
        where: {
          contentHash: { in: hashes },
          sourceLang,
          targetLang: input.targetLang,
        },
      });
      const cacheMap = new Map(cached.map((c) => [c.contentHash, c.targetText]));

      // Finn uncached tekster
      const manglendeHashes = hashes.filter((h) => !cacheMap.has(h));
      const manglendeTekster = manglendeHashes.map((h) => hashTilTekst.get(h)!);

      // Oversett manglende
      if (manglendeTekster.length > 0) {
        // Hent oversettelsesmotor fra prosjektets modul-config
        const modul = await ctx.prisma.projectModule.findUnique({
          where: { projectId_moduleSlug: { projectId: input.projectId, moduleSlug: "oversettelse" } },
        });
        const config = (modul?.config ?? {}) as { motor?: string; apiKey?: string };
        const motor = (config.motor ?? "opus-mt") as OversettelsesMotor;

        const oversatte = await oversettMedMotor(manglendeTekster, sourceLang, input.targetLang, motor, config.apiKey);

        // Lagre i cache
        const cacheData = manglendeTekster.map((tekst, i) => ({
          contentHash: hashTekst(tekst),
          sourceLang,
          targetLang: input.targetLang,
          sourceText: tekst,
          targetText: oversatte[i] ?? tekst,
        }));
        await ctx.prisma.translationCache.createMany({ data: cacheData, skipDuplicates: true });

        // Legg til i cacheMap
        for (let i = 0; i < manglendeTekster.length; i++) {
          cacheMap.set(hashTekst(manglendeTekster[i]!), oversatte[i] ?? manglendeTekster[i]!);
        }
      }

      // Bygg resultat: original → oversettelse
      const resultat: Record<string, string> = {};
      for (const tekst of input.tekster) {
        resultat[tekst] = cacheMap.get(hashTekst(tekst)) ?? tekst;
      }
      return resultat;
    }),
});
