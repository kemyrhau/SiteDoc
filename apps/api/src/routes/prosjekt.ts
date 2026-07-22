import { z } from "zod";
import { router, protectedProcedure, opprettProsjektProcedure } from "../trpc/trpc";
import { createProjectSchema, STANDARD_PROJECT_GROUPS, PROSJEKT_MODULER, STANDARD_FAGGRUPPER, STANDARD_DOKUMENTFLYTER } from "@sitedoc/shared";
import { generateProjectNumber } from "@sitedoc/shared";
import type { Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";
import {
  verifiserProsjektmedlem,
  verifiserAdmin,
  hentBrukersOrg,
} from "../trpc/tilgangskontroll";
import { hentAktiveFirmamoduler } from "../services/firmamodul";

export const prosjektRouter = router({
  // Hent prosjekter der innlogget bruker er medlem — uavhengig av rolle.
  // B1 (2026-05-07): «Mine prosjekter»-scope skal alltid være medlemskaps-
  // basert, også for sitedoc_admin og company_admin. hentAlle beholder
  // admin-bypass for «Alle prosjekter»-scope.
  // organizationId-input snevrer videre til prosjekter med matchende
  // primaryOrganizationId (brukes når sitedoc_admin har firma valgt).
  hentMine: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: Prisma.ProjectWhereInput = {
        members: { some: { userId: ctx.userId } },
        ...(input?.organizationId
          ? { primaryOrganizationId: input.organizationId }
          : {}),
      };
      return ctx.prisma.project.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          faggrupper: true,
          _count: { select: { members: true } },
        },
      });
    }),

  // Fase 2 / T.10: prosjektvelger for Timer. Union av:
  //   - kunde-prosjekter der bruker er medlem (samme scope som hentMine —
  //     interne har ingen ProjectMember-rader, så de faller naturlig bort her)
  //   - interne prosjekter (type="internt") for brukerens eget firma
  // Egen prosedyre slik at kundevendte lister (hentMine/hentAlle) forblir rene
  // og fortsatt filtrerer interne ut. Brukes KUN av timer-flate.
  hentForTimer: protectedProcedure
    .query(async ({ ctx }) => {
      const brukersOrgId = await hentBrukersOrg(ctx.userId);
      const where: Prisma.ProjectWhereInput = {
        OR: [
          { members: { some: { userId: ctx.userId } } },
          ...(brukersOrgId
            ? [{ type: "internt", primaryOrganizationId: brukersOrgId }]
            : []),
        ],
      };
      return ctx.prisma.project.findMany({
        where,
        orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
        include: {
          faggrupper: true,
          _count: { select: { members: true } },
        },
      });
    }),

  // Hent alle prosjekter (sitedoc_admin ser alle, kan filtreres på firma).
  hentAlle: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const bruker = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { role: true } });
      const erSitedocAdmin = bruker.role === "sitedoc_admin";
      // Fase 2 / T.10: hentAlle er en kundevendt liste — interne prosjekter
      // (type="internt") filtreres alltid ut. For ikke-admin er member-scopet
      // allerede uten interne (de har ingen ProjectMember-rader); type-filteret
      // er nødvendig for sitedoc_admin-grenen (tomt filter / org-filter).
      const where: Prisma.ProjectWhereInput = erSitedocAdmin
        ? input?.organizationId
          ? { type: "kunde", primaryOrganizationId: input.organizationId }
          : { type: "kunde" }
        : { type: "kunde", members: { some: { userId: ctx.userId } } };
      return ctx.prisma.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          faggrupper: true,
          _count: { select: { members: true } },
        },
      });
    }),

  // K3 «Sist brukt» (v1, 2026-07-22): distinkte prosjekter fra brukerens
  // Activity, nyeste createdAt først, topp N. Løser Kenneths «4-5 prosjekter
  // de veksler mellom» — sticky (én verdi) viste bare det siste ene. Ren
  // spørring på eksisterende audit-data (`activity_log`, indeks
  // [actorUserId, createdAt]) — INGEN ny logging. Ingen vekting (v2 er egen
  // sak, ordre § 38). Filtrerer til prosjekter brukeren FORTSATT har tilgang
  // til, samme scope som hentAlle. Tom Activity → klient faller tilbake på sticky.
  hentSistBrukte: protectedProcedure
    .input(
      z
        .object({
          organizationId: z.string().uuid().optional(),
          antall: z.number().int().min(1).max(10).default(5),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const antall = input?.antall ?? 5;

      // Nyeste Activity-rader for brukeren med projectId. Tak på 200 rader for å
      // finne nok distinkte prosjekter uten å skanne hele sporet.
      const aktiviteter = await ctx.prisma.activity.findMany({
        where: { actorUserId: ctx.userId, projectId: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { projectId: true },
        take: 200,
      });

      const distinkte: string[] = [];
      for (const a of aktiviteter) {
        if (a.projectId && !distinkte.includes(a.projectId)) {
          distinkte.push(a.projectId);
          if (distinkte.length >= antall) break;
        }
      }
      if (distinkte.length === 0) return [];

      // Samme tilgangs-/scope-regel som hentAlle: kunde-prosjekter, sitedoc_admin
      // ser alle (valgfritt firma-filter), øvrige kun der de er medlem.
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { role: true },
      });
      const erSitedocAdmin = bruker.role === "sitedoc_admin";
      const where: Prisma.ProjectWhereInput = {
        id: { in: distinkte },
        type: "kunde",
        ...(input?.organizationId ? { primaryOrganizationId: input.organizationId } : {}),
        ...(erSitedocAdmin ? {} : { members: { some: { userId: ctx.userId } } }),
      };
      // Kun id-ene trengs (klienten mapper mot allerede-lastet prosjektliste).
      // Flat `string[]`-retur unngår tRPC-include-TS2589 på klientsiden.
      const prosjekter = await ctx.prisma.project.findMany({
        where,
        select: { id: true },
      });
      const tilgjengelige = new Set(prosjekter.map((p) => p.id));

      // Behold Activity-rekkefølgen (nyeste først), kun tilgjengelige prosjekter.
      return distinkte.filter((id) => tilgjengelige.has(id));
    }),

  // Hent ett prosjekt med ID
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.id);

      return ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          faggrupper: true,
          members: {
            include: {
              user: true,
              faggruppeKoblinger: { include: { faggruppe: true } },
            },
          },
          templates: true,
          drawings: true,
          folders: { where: { parentId: null }, include: { children: true } },
          projectOrganizations: { select: { id: true } },
        },
      });
    }),

  // Onboarding-fremdrift: booleans for progress-banner på prosjekt-dashbord.
  // Banneret skjules klient-side når alle synlige steg er true.
  // B2 (2026-05-07): utvidet med modul-oppsett-status for Timer/Maskin/Varelager.
  // Modul-pillene vises kun når aktivert (ProjectModule.status="aktiv") og er
  // ferdig når firma-nivå-grunnoppsett er på plass (lønnsart+aktivitet,
  // equipment, vare). Standalone prosjekt (ingen primaryOrganizationId) kan
  // ikke ha firma-moduler aktivert — flaggene er da alltid false.
  hentOnboardingStatus: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const [
        dokumentflytAntall,
        brukergruppeAntall,
        malKobletAntall,
        lokasjonAntall,
        prosjekt,
        prosjektmoduler,
      ] = await Promise.all([
        ctx.prisma.dokumentflyt.count({ where: { projectId: input.projectId } }),
        ctx.prisma.projectGroup.count({
          where: { projectId: input.projectId, category: "brukergrupper" },
        }),
        ctx.prisma.dokumentflytMal.count({
          where: { dokumentflyt: { projectId: input.projectId } },
        }),
        ctx.prisma.byggeplass.count({ where: { projectId: input.projectId } }),
        ctx.prisma.project.findUnique({
          where: { id: input.projectId },
          select: { primaryOrganizationId: true },
        }),
        ctx.prisma.projectModule.findMany({
          where: { projectId: input.projectId, status: "aktiv" },
          select: { moduleSlug: true },
        }),
      ]);

      const aktiveSlugs = new Set(prosjektmoduler.map((m) => m.moduleSlug));
      const timerAktiv = aktiveSlugs.has("timer");
      const maskinAktiv = aktiveSlugs.has("maskin");
      const varelagerAktiv = aktiveSlugs.has("varelager");
      const orgId = prosjekt?.primaryOrganizationId ?? null;

      const [lonnsartAntall, aktivitetAntall, equipmentAntall, vareAntall] =
        await Promise.all([
          timerAktiv && orgId
            ? ctx.prismaTimer.lonnsart.count({ where: { organizationId: orgId } })
            : Promise.resolve(0),
          timerAktiv && orgId
            ? ctx.prismaTimer.aktivitet.count({ where: { organizationId: orgId } })
            : Promise.resolve(0),
          maskinAktiv && orgId
            ? ctx.prismaMaskin.equipment.count({ where: { organizationId: orgId } })
            : Promise.resolve(0),
          varelagerAktiv && orgId
            ? ctx.prismaVarelager.vare.count({ where: { organizationId: orgId } })
            : Promise.resolve(0),
        ]);

      return {
        harDokumentflyt: dokumentflytAntall > 0,
        harBrukergruppe: brukergruppeAntall > 0,
        harMalKobletTilFlyt: malKobletAntall > 0,
        harLokasjon: lokasjonAntall > 0,
        timerAktiv,
        harTimerOppsett: timerAktiv && lonnsartAntall > 0 && aktivitetAntall > 0,
        maskinAktiv,
        harMaskinregister: maskinAktiv && equipmentAntall > 0,
        varelagerAktiv,
        harVarekatalog: varelagerAktiv && vareAntall > 0,
      };
    }),

  // Opprett nytt prosjekt — auto-tilknytter til firma og oppretter ProjectModule-
  // rader for aktive firmamoduler. Steg 2d (2026-05-03): tar valgfri organizationId
  // fra input. Sitedoc_admin sender valgtFirma.id når de oppretter prosjekt på
  // vegne av et kunde-firma. Vanlig bruker fallbacker til egen organizationId.
  opprett: opprettProsjektProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const antall = await ctx.prisma.project.count();
      const prosjektnummer = generateProjectNumber(antall + 1);

      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { role: true },
      });

      // O-3b: hent brukerens org via OrganizationMember (fallback User.organizationId)
      const brukersOrgId = await hentBrukersOrg(ctx.userId);

      // Velg organizationId: input → eksplisitt, fallback → brukerens egen.
      // Verifiser tilgang når input er gitt.
      let valgtOrgId: string | null = null;
      if (input.organizationId) {
        if (
          bruker.role === "sitedoc_admin" ||
          brukersOrgId === input.organizationId
        ) {
          valgtOrgId = input.organizationId;
        } else {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Ikke tilgang til å opprette prosjekt for dette firmaet",
          });
        }
      } else if (brukersOrgId) {
        valgtOrgId = brukersOrgId;
      }

      // Steg 1e Fase B: les aktive firmamoduler fra OrganizationModule.
      const aktiveFirmaModuler = valgtOrgId
        ? await hentAktiveFirmamoduler(valgtOrgId)
        : [];

      // Strip organizationId fra input før spread til Project-data
      // (det er ikke en kolonne på Project-modellen).
      const { organizationId: _ignore, ...projectData } = input;

      return ctx.prisma.$transaction(async (tx) => {
        const prosjekt = await tx.project.create({
          data: {
            ...projectData,
            projectNumber: prosjektnummer,
            primaryOrganizationId: valgtOrgId,
            members: {
              create: {
                userId: ctx.userId!,
                role: "admin",
              },
            },
          },
        });

        if (valgtOrgId) {
          await tx.projectOrganization.create({
            data: {
              organizationId: valgtOrgId,
              projectId: prosjekt.id,
            },
          });

          if (aktiveFirmaModuler.length > 0) {
            await tx.projectModule.createMany({
              data: aktiveFirmaModuler.map((slug) => ({
                projectId: prosjekt.id,
                moduleSlug: slug,
                organizationId: valgtOrgId!,
                status: "aktiv",
              })),
              skipDuplicates: true,
            });
          }
        }

        return prosjekt;
      });
    }),

  // Opprett testprosjekt med standardgrupper og moduler (for nye brukere)
  opprettTestprosjekt: opprettProsjektProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { name: true, role: true },
      });

      // O-3b: hent brukerens org via OrganizationMember (fallback User.organizationId)
      const brukersOrgId = await hentBrukersOrg(ctx.userId);

      // 2026-05-23: firma er nå påkrevd — alle kunder skal være registrert
      // som firma (samme prinsipp som prosjekt.opprett og admin.opprettProsjekt).
      // Verifiser tilgang: sitedoc_admin kan opprette for enhver org, vanlig
      // bruker kun for egen org.
      if (
        bruker.role !== "sitedoc_admin" &&
        brukersOrgId !== input.organizationId
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Ikke tilgang til å opprette prosjekt for dette firmaet",
        });
      }
      const valgtOrgId = input.organizationId;

      // Steg 1e Fase B: les aktive firmamoduler fra OrganizationModule.
      const aktiveFirmaModuler = await hentAktiveFirmamoduler(valgtOrgId);

      const antall = await ctx.prisma.project.count();
      const prosjektnummer = generateProjectNumber(antall + 1);
      const prosjektNavn = `Testside ${bruker.name || "Ukjent"}`;

      return ctx.prisma.$transaction(async (tx) => {
        // Opprett prosjektet
        const prosjekt = await tx.project.create({
          data: {
            name: prosjektNavn,
            projectNumber: prosjektnummer,
            primaryOrganizationId: valgtOrgId,
            members: {
              create: {
                userId: ctx.userId!,
                role: "admin",
              },
            },
          },
        });

        // Auto-tilknytt til valgt firma + auto-opprett ProjectModule-rader
        // for aktive firmamoduler (Steg 1c Fase B). valgtOrgId er garantert
        // string etter required-Zod 2026-05-23.
        await tx.projectOrganization.create({
          data: {
            organizationId: valgtOrgId,
            projectId: prosjekt.id,
          },
        });

        if (aktiveFirmaModuler.length > 0) {
          await tx.projectModule.createMany({
            data: aktiveFirmaModuler.map((slug) => ({
              projectId: prosjekt.id,
              moduleSlug: slug,
              organizationId: valgtOrgId,
              status: "aktiv",
            })),
            skipDuplicates: true,
          });
        }

        // Opprett standardgrupper
        for (const gruppe of STANDARD_PROJECT_GROUPS) {
          await tx.projectGroup.create({
            data: {
              projectId: prosjekt.id,
              name: gruppe.name,
              slug: gruppe.slug,
              category: gruppe.category,
              permissions: gruppe.permissions,
              domains: gruppe.domains,
              isDefault: true,
            },
          });
        }

        // Aktiver alle moduler (Godkjenning, HMS-avvik, Befaringsrapport)
        for (const modulDef of PROSJEKT_MODULER) {
          await tx.projectModule.create({
            data: {
              projectId: prosjekt.id,
              moduleSlug: modulDef.slug,
            },
          });

          for (const malDef of modulDef.maler) {
            const mal = await tx.reportTemplate.create({
              data: {
                projectId: prosjekt.id,
                name: malDef.navn,
                description: malDef.beskrivelse,
                prefix: malDef.prefix,
                category: malDef.kategori,
                domain: malDef.domain,
                subjects: (malDef.emner ?? []) as Prisma.InputJsonValue,
              },
            });

            if (malDef.objekter.length > 0) {
              await tx.reportObject.createMany({
                data: malDef.objekter.map((obj) => ({
                  templateId: mal.id,
                  type: obj.type,
                  label: obj.label,
                  sortOrder: obj.sortOrder,
                  required: obj.required ?? false,
                  config: obj.config as Prisma.InputJsonValue,
                })),
              });
            }
          }
        }

        // Opprett standard faggrupper
        const faggruppeIder: string[] = [];
        for (const fgDef of STANDARD_FAGGRUPPER) {
          const fg = await tx.faggruppe.create({
            data: {
              projectId: prosjekt.id,
              name: fgDef.navn,
              industry: fgDef.bransje,
              color: fgDef.farge,
              faggruppeNummer: fgDef.faggruppeNummer,
            },
          });
          faggruppeIder.push(fg.id);
        }

        // Koble bruker til Byggherre-faggruppen (første)
        const medlem = await tx.projectMember.findFirst({
          where: { projectId: prosjekt.id, userId: ctx.userId },
        });
        if (medlem && faggruppeIder.length > 0) {
          await tx.faggruppeKobling.create({
            data: {
              projectMemberId: medlem.id,
              faggruppeId: faggruppeIder[0]!,
            },
          });
        }

        // Hent opprettede maler (for å koble til dokumentflyter via prefix)
        const opprettedeMaler = await tx.reportTemplate.findMany({
          where: { projectId: prosjekt.id },
          select: { id: true, prefix: true },
        });

        // Opprett standard dokumentflyter
        for (const flytDef of STANDARD_DOKUMENTFLYTER) {
          const flyt = await tx.dokumentflyt.create({
            data: { projectId: prosjekt.id, name: flytDef.navn },
          });

          // Legg til oppretter-medlemmer
          for (const idx of flytDef.oppretter) {
            if (idx < faggruppeIder.length) {
              await tx.dokumentflytMedlem.create({
                data: {
                  dokumentflytId: flyt.id,
                  faggruppeId: faggruppeIder[idx],
                  rolle: "bestiller",
                  steg: 1,
                },
              });
            }
          }

          // Legg til svarer-medlemmer
          for (const idx of flytDef.svarer) {
            if (idx < faggruppeIder.length) {
              await tx.dokumentflytMedlem.create({
                data: {
                  dokumentflytId: flyt.id,
                  faggruppeId: faggruppeIder[idx],
                  rolle: "utforer",
                  steg: 1,
                },
              });
            }
          }

          // Koble maler via prefix
          for (const prefix of flytDef.malPrefixer) {
            const mal = opprettedeMaler.find((m) => m.prefix === prefix);
            if (mal) {
              await tx.dokumentflytMal.create({
                data: { dokumentflytId: flyt.id, templateId: mal.id },
              });
            }
          }
        }

        return prosjekt;
      });
    }),

  // Oppdater prosjekt
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        address: z.string().optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        internalProjectNumber: z.string().max(100).nullable().optional(),
        externalProjectNumber: z.string().max(100).nullable().optional(),
        logoUrl: z.string().max(500).nullable().optional(),
        showInternalProjectNumber: z.boolean().optional(),
        utskriftsinnstillinger: z.object({
          logo: z.boolean(),
          eksternProsjektnummer: z.boolean(),
          prosjektnavn: z.boolean(),
          fraTil: z.boolean(),
          lokasjon: z.boolean(),
          tegningsnummer: z.boolean(),
          vaer: z.boolean(),
        }).optional(),
        sourceLanguage: z.string().min(2).max(5).optional(),
        status: z.enum(["active", "archived", "completed", "deactivated"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserAdmin(ctx.userId, input.id);

      // Sjekk om kildespråk endres
      const gammelt = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.id },
        select: { sourceLanguage: true },
      });

      const { id, ...data } = input;
      const result = await ctx.prisma.project.update({
        where: { id },
        data,
      });

      // Hvis kildespråk endret: reset languageConfirmed på dokumenter
      // som hadde gammelt kildespråk som detektert → de trenger ny vurdering
      if (input.sourceLanguage && input.sourceLanguage !== gammelt.sourceLanguage) {
        await ctx.prisma.ftdDocument.updateMany({
          where: {
            projectId: id,
            isActive: true,
            detectedLanguage: gammelt.sourceLanguage,
            languageConfirmed: true,
          },
          data: { languageConfirmed: false },
        });
      }

      return result;
    }),
});
