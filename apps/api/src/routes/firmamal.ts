/**
 * Firma-malarkiv (AM4, 2026-09-04) — `firmamal.*` tRPC-ruter.
 *
 * Firma-eid mal-bibliotek: `OrganizationTemplate` (+ `OrganizationTemplateObject`)
 * som nye prosjekter henter HMS-/sjekkliste-/oppgavemaler fra, samt en lånevei fra
 * SiteDoc-sentralarkivet (`BibliotekMal`). Datamodellen fantes fra før (steg 1 av
 * migrering-reporttemplate.md); denne runden bygger API + de fire additive kolonnene.
 *
 * Designlås (ordre AM4):
 *  - L5: kopi MED avstamning, aldri referanse. `ReportTemplate.organizationTemplateId`
 *    er avstamningspekeren; SetNull ved sletting av firmamalen håndteres av
 *    schema-FK-en (schema.prisma:1003 onDelete: SetNull) — ikke app-laget.
 *  - L6: versjonering er manuell. `versjonAvHovedmal` fryses ved henting; badge
 *    «X versjoner bak» = firmamal.version − versjonAvHovedmal (beregnes i UI, bolk 2).
 *  - L7: firma-admin (`OrganizationMember.firmaRoller`, via autoriserAdminForFirma)
 *    oppretter/redigerer/sletter/promoterer/låner. ALLE prosjektadmin kan hente ned.
 *  - L9: tre-liste-prinsippet — `fane`-filter skiller sjekkliste/oppgave/HMS.
 *
 * Zone-regelen (🔴 MALBYGGER.md): `config` (som bærer `config.zone`) kopieres VERBATIM
 * i begge retninger. Ingen felt-bygging fra bunnen som kunne tape zone → mobil fryser.
 * Unntak: laanFraSentralarkiv bygger objekter fra BibliotekMal.malInnhold og setter
 * `zone` eksplisitt (som bibliotek.ts importerMal).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@sitedoc/db";
import { router, protectedProcedure } from "../trpc/trpc";
import { autoriserAdminForFirma, verifiserAdmin } from "../trpc/tilgangskontroll";
import { finnLedigeMalVerdier } from "./mal";

// Faner (L9). Firmaarkivet blander aldri de tre kategoriene i én liste.
//  - oppgave: category="oppgave"
//  - hms:     domain="hms" (uansett category — HMS-avviksmaler er category="sjekkliste")
//  - sjekkliste: category="sjekkliste" OG domain≠"hms"
const FANER = ["sjekkliste", "oppgave", "hms"] as const;

function faneWhere(fane: (typeof FANER)[number]): Prisma.OrganizationTemplateWhereInput {
  switch (fane) {
    case "oppgave":
      return { category: "oppgave" };
    case "hms":
      return { domain: "hms" };
    case "sjekkliste":
      return { category: "sjekkliste", domain: { not: "hms" } };
  }
}

// Kilde-objekt slik det leses fra begge mal-tabellene (felles form).
type KildeObjekt = {
  id: string;
  parentId: string | null;
  type: string;
  label: string;
  config: Prisma.JsonValue;
  translations: Prisma.JsonValue;
  sortOrder: number;
  required: boolean;
};

/**
 * Dyp kopi av objekt-treet mellom ReportObject <-> OrganizationTemplateObject.
 * To-pass id-mapping (som mal.ts kopier): pass 1 oppretter uten parentId og bygger
 * gammel→ny id-map, pass 2 setter parentId. Bevarer treet uansett sortOrder, og
 * kopierer `config`/`translations` VERBATIM (zone-regelen).
 */
async function kopierObjektTre(
  kildeObjekter: KildeObjekt[],
  opprett: (data: {
    type: string;
    label: string;
    config: Prisma.InputJsonValue;
    translations: Prisma.InputJsonValue;
    sortOrder: number;
    required: boolean;
  }) => Promise<{ id: string }>,
  settParent: (id: string, parentId: string) => Promise<void>,
): Promise<void> {
  const idMap = new Map<string, string>();
  for (const obj of kildeObjekter) {
    const nytt = await opprett({
      type: obj.type,
      label: obj.label,
      config: (obj.config ?? {}) as Prisma.InputJsonValue,
      translations: (obj.translations ?? {}) as Prisma.InputJsonValue,
      sortOrder: obj.sortOrder,
      required: obj.required,
    });
    idMap.set(obj.id, nytt.id);
  }
  for (const obj of kildeObjekter) {
    if (!obj.parentId) continue;
    const nyId = idMap.get(obj.id);
    const nyParentId = idMap.get(obj.parentId);
    if (nyId && nyParentId) await settParent(nyId, nyParentId);
  }
}

export const firmamalRouter = router({
  /**
   * Firmaets maler, valgfritt filtrert per fane (L9). Bruk-teller = antall
   * prosjekt-kopier som fortsatt peker hit (`copiedTo` via organizationTemplateId).
   */
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        fane: z.enum(FANER).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      return ctx.prisma.organizationTemplate.findMany({
        where: {
          organizationId: input.organizationId,
          ...(input.fane ? faneWhere(input.fane) : {}),
        },
        include: { _count: { select: { objects: true, copiedTo: true } } },
        orderBy: { updatedAt: "desc" },
      });
    }),

  /** Én firmamal med hele objekt-treet (for redigering/preview i firma-modus). */
  hent: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mal = await ctx.prisma.organizationTemplate.findUniqueOrThrow({
        where: { id: input.id },
        include: { objects: { orderBy: { sortOrder: "asc" } } },
      });
      await autoriserAdminForFirma(ctx.userId, mal.organizationId);
      return mal;
    }),

  /**
   * Opprett en tom firmamal. Objekt-treet redigeres etterpå via MalBygger i
   * firma-modus (L8, bolk 2) — ingen parallell malbygger her.
   */
  opprett: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        name: z.string().min(1).max(200),
        category: z.enum(["sjekkliste", "oppgave"]),
        domain: z.enum(["bygg", "hms", "kvalitet"]).default("bygg"),
        subdomain: z.string().max(40).nullable().optional(),
        hmsSynlighet: z.enum(["privat", "apen"]).nullable().optional(),
        prefix: z.string().max(40).nullable().optional(),
        description: z.string().max(2000).nullable().optional(),
        subjects: z.array(z.string()).optional(),
        standardForNyeProsjekter: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);
      const mal = await ctx.prisma.organizationTemplate.create({
        data: {
          organizationId: input.organizationId,
          name: input.name.trim(),
          description: input.description ?? null,
          prefix: input.prefix?.trim() || null,
          category: input.category,
          domain: input.domain,
          subdomain: input.subdomain ?? null,
          hmsSynlighet: input.hmsSynlighet ?? null,
          subjects: (input.subjects ?? []) as Prisma.InputJsonValue,
          standardForNyeProsjekter: input.standardForNyeProsjekter ?? false,
        },
        select: { id: true },
      });
      return { id: mal.id };
    }),

  /** Oppdater firmamal-metadata (ikke objekt-treet — det eier MalBygger, L8). */
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        prefix: z.string().max(40).nullable().optional(),
        subdomain: z.string().max(40).nullable().optional(),
        hmsSynlighet: z.enum(["privat", "apen"]).nullable().optional(),
        subjects: z.array(z.string()).optional(),
        standardForNyeProsjekter: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mal = await ctx.prisma.organizationTemplate.findUniqueOrThrow({
        where: { id: input.id },
        select: { id: true, organizationId: true },
      });
      await autoriserAdminForFirma(ctx.userId, mal.organizationId);

      await ctx.prisma.organizationTemplate.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.prefix !== undefined ? { prefix: input.prefix?.trim() || null } : {}),
          ...(input.subdomain !== undefined ? { subdomain: input.subdomain } : {}),
          ...(input.hmsSynlighet !== undefined ? { hmsSynlighet: input.hmsSynlighet } : {}),
          ...(input.subjects !== undefined
            ? { subjects: input.subjects as Prisma.InputJsonValue }
            : {}),
          ...(input.standardForNyeProsjekter !== undefined
            ? { standardForNyeProsjekter: input.standardForNyeProsjekter }
            : {}),
          version: { increment: 1 },
        },
        select: { id: true },
      });
      return { id: input.id };
    }),

  /**
   * Slett en firmamal. Prosjekt-kopier beholder sin frosne struktur — FK-en
   * `report_templates.organization_template_id` er SetNull (schema:1003), så
   * avstamningspekeren nulles av DB-en, ikke app-laget. Objekt-treet cascader.
   */
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const mal = await ctx.prisma.organizationTemplate.findUniqueOrThrow({
        where: { id: input.id },
        select: { id: true, organizationId: true },
      });
      await autoriserAdminForFirma(ctx.userId, mal.organizationId);
      await ctx.prisma.organizationTemplate.delete({ where: { id: input.id } });
      return { slettet: true as const };
    }),

  /**
   * Promoter en prosjektmal opp til firmaarkivet (ReportTemplate → OrganizationTemplate).
   * Snapshot-kopi med objekter + translations; `promotedFromTemplateId` bevarer
   * opphavet. Kilden merkes `promotedToFirma=true` (badge «I firmaarkivet», bolk 2).
   * Målfirma = prosjektets eier-firma (`primaryOrganizationId`); firma-admin-gatet.
   */
  promoter: protectedProcedure
    .input(z.object({ templateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const kilde = await ctx.prisma.reportTemplate.findUniqueOrThrow({
        where: { id: input.templateId },
        include: {
          objects: { orderBy: { sortOrder: "asc" } },
          project: { select: { primaryOrganizationId: true } },
        },
      });

      const orgId = kilde.project.primaryOrganizationId;
      if (!orgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Prosjektet har ikke et eier-firma å promotere malen til",
        });
      }
      await autoriserAdminForFirma(ctx.userId, orgId);

      const nyId = await ctx.prisma.$transaction(async (tx) => {
        const nyMal = await tx.organizationTemplate.create({
          data: {
            organizationId: orgId,
            name: kilde.name,
            description: kilde.description,
            prefix: kilde.prefix,
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
            promotedFromTemplateId: kilde.id,
            version: 1,
          },
          select: { id: true },
        });

        await kopierObjektTre(
          kilde.objects,
          (data) =>
            tx.organizationTemplateObject.create({
              data: { templateId: nyMal.id, ...data },
              select: { id: true },
            }),
          (id, parentId) =>
            tx.organizationTemplateObject
              .update({ where: { id }, data: { parentId } })
              .then(() => undefined),
        );

        await tx.reportTemplate.update({
          where: { id: kilde.id },
          data: { promotedToFirma: true },
        });

        return nyMal.id;
      });

      return { id: nyId };
    }),

  /**
   * Hent en firmamal ned i et prosjekt (OrganizationTemplate → ReportTemplate).
   * Snapshot-kopi (L5): `organizationTemplateId` settes som avstamningspeker og
   * `versjonAvHovedmal` fryser firmamalens versjon (L6). Alle prosjektadmin kan
   * hente ned (L7). Firma-isolasjon: firmamalen må tilhøre et av prosjektets firmaer.
   */
  kopierTilProsjekt: protectedProcedure
    .input(
      z.object({
        organizationTemplateId: z.string().uuid(),
        projectId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.projectId);

      const firmamal = await ctx.prisma.organizationTemplate.findUniqueOrThrow({
        where: { id: input.organizationTemplateId },
        include: { objects: { orderBy: { sortOrder: "asc" } } },
      });

      // Firma-isolasjon: prosjektet må være koblet til firmamalens firma
      // (eier-firma eller part i prosjektet). Ellers lekker maler på tvers av firma.
      const prosjektOrgIder = new Set<string>();
      const prosjekt = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
        select: { primaryOrganizationId: true },
      });
      if (prosjekt.primaryOrganizationId) prosjektOrgIder.add(prosjekt.primaryOrganizationId);
      const koblinger = await ctx.prisma.projectOrganization.findMany({
        where: { projectId: input.projectId },
        select: { organizationId: true },
      });
      for (const k of koblinger) prosjektOrgIder.add(k.organizationId);

      if (!prosjektOrgIder.has(firmamal.organizationId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Firmamalen tilhører ikke dette prosjektets firma",
        });
      }

      const ledig = await finnLedigeMalVerdier(
        ctx.prisma,
        input.projectId,
        firmamal.category,
        firmamal.name,
        firmamal.prefix,
      );

      const nyId = await ctx.prisma.$transaction(async (tx) => {
        const nyMal = await tx.reportTemplate.create({
          data: {
            projectId: input.projectId,
            name: ledig.name,
            description: firmamal.description,
            prefix: ledig.prefix,
            category: firmamal.category,
            domain: firmamal.domain,
            subdomain: firmamal.subdomain,
            hmsSynlighet: firmamal.hmsSynlighet,
            subjects: (firmamal.subjects ?? []) as Prisma.InputJsonValue,
            showSubject: firmamal.showSubject,
            showLocation: firmamal.showLocation,
            showPriority: firmamal.showPriority,
            enableChangeLog: firmamal.enableChangeLog,
            kontrollomrade: firmamal.kontrollomrade,
            organizationTemplateId: firmamal.id, // avstamning (L5)
            versjonAvHovedmal: firmamal.version, // fryser versjon (L6)
            version: 1,
          },
          select: { id: true },
        });

        await kopierObjektTre(
          firmamal.objects,
          (data) =>
            tx.reportObject.create({
              data: { templateId: nyMal.id, ...data },
              select: { id: true },
            }),
          (id, parentId) =>
            tx.reportObject.update({ where: { id }, data: { parentId } }).then(() => undefined),
        );

        return nyMal.id;
      });

      return { id: nyId };
    }),

  /**
   * Lån en mal fra SiteDoc-sentralarkivet inn i firmaarkivet (BibliotekMal →
   * OrganizationTemplate). Fase 1-lånevei (L3): KUN sentralt→firma. Objekter bygges
   * fra `malInnhold` med eksplisitt zone (som bibliotek.ts importerMal).
   *
   * Avstamning (B4, Kenneth-vedtak 2026-09-04): STRUKTURERT peker
   * `laantFraBibliotekMalId` — spørrbar, ikke fritekst i description. SetNull-FK
   * (schema) beholder lånet om bibliotekmalen slettes.
   */
  laanFraSentralarkiv: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        bibliotekMalId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await autoriserAdminForFirma(ctx.userId, input.organizationId);

      const bibMal = await ctx.prisma.bibliotekMal.findUniqueOrThrow({
        where: { id: input.bibliotekMalId },
        include: { kapittel: { include: { standard: true } } },
      });

      const malInnhold = bibMal.malInnhold as Array<{
        label: string;
        type: string;
        zone: string;
        fase?: string;
        config?: Record<string, unknown>;
        sortOrder: number;
      }>;

      const nyId = await ctx.prisma.$transaction(async (tx) => {
        const nyMal = await tx.organizationTemplate.create({
          data: {
            organizationId: input.organizationId,
            name: bibMal.navn,
            // Beskrivelse = ren referanse-tekst. Avstamningen ligger i den
            // strukturerte pekeren under (B4), ikke gjemt i fritekst.
            description: `${bibMal.kapittel.standard.kode} ${bibMal.referanse}${
              bibMal.beskrivelse ? " — " + bibMal.beskrivelse : ""
            }`,
            category: bibMal.kategori,
            domain: bibMal.domene,
            laantFraBibliotekMalId: bibMal.id, // strukturert avstamning (B4)
          },
          select: { id: true },
        });

        if (Array.isArray(malInnhold) && malInnhold.length > 0) {
          const faser = [...new Set(malInnhold.map((f) => f.fase).filter(Boolean))];
          let sortIdx = 0;

          for (const fase of faser) {
            sortIdx++;
            await tx.organizationTemplateObject.create({
              data: {
                templateId: nyMal.id,
                type: "heading",
                label:
                  fase === "FØR"
                    ? "Kontroll FØR utførelse"
                    : fase === "UNDER"
                      ? "Kontroll UNDER utførelse"
                      : "Kontroll ETTER utførelse",
                sortOrder: sortIdx,
                config: { zone: "datafelter" },
              },
            });
            for (const f of malInnhold.filter((x) => x.fase === fase)) {
              sortIdx++;
              await tx.organizationTemplateObject.create({
                data: {
                  templateId: nyMal.id,
                  type: f.type,
                  label: f.label,
                  sortOrder: sortIdx,
                  config: { zone: f.zone ?? "datafelter", ...f.config },
                },
              });
            }
          }

          for (const f of malInnhold.filter((x) => !x.fase)) {
            sortIdx++;
            await tx.organizationTemplateObject.create({
              data: {
                templateId: nyMal.id,
                type: f.type,
                label: f.label,
                sortOrder: sortIdx,
                config: { zone: f.zone ?? "datafelter", ...f.config },
              },
            });
          }
        }

        return nyMal.id;
      });

      return { id: nyId, malNavn: bibMal.navn };
    }),
});
