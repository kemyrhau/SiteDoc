import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { createProjectSchema, STANDARD_PROJECT_GROUPS, PROSJEKT_MODULER, STANDARD_FAGGRUPPER, STANDARD_DOKUMENTFLYTER } from "@sitedoc/shared";
import { generateProjectNumber } from "@sitedoc/shared";
import type { Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";
import {
  verifiserProsjektmedlem,
  verifiserAdmin,
} from "../trpc/tilgangskontroll";

export const prosjektRouter = router({
  // Hent prosjekter der innlogget bruker er medlem (sitedoc_admin ser alle).
  // P1 Fase 1 (2026-05-04): valgfri organizationId filtrerer for sitedoc_admin
  // når et firma er valgt i FirmaVelger. Vanlig bruker / company_admin er
  // uberørt — eksisterende members-filter beholder isolasjon.
  hentMine: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const bruker = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { role: true } });
      const erSitedocAdmin = bruker.role === "sitedoc_admin";
      const where: Prisma.ProjectWhereInput = erSitedocAdmin
        ? input?.organizationId
          ? { primaryOrganizationId: input.organizationId }
          : {}
        : { members: { some: { userId: ctx.userId } } };
      return ctx.prisma.project.findMany({
        where,
        orderBy: { updatedAt: "desc" },
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
      const where: Prisma.ProjectWhereInput = erSitedocAdmin
        ? input?.organizationId
          ? { primaryOrganizationId: input.organizationId }
          : {}
        : { members: { some: { userId: ctx.userId } } };
      return ctx.prisma.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          faggrupper: true,
          _count: { select: { members: true } },
        },
      });
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

  // Onboarding-fremdrift: 4 booleans for progress-banner på prosjekt-dashbord.
  // Banneret skjules klient-side når alle 4 er true.
  hentOnboardingStatus: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const [dokumentflytAntall, brukergruppeAntall, malKobletAntall, lokasjonAntall] =
        await Promise.all([
          ctx.prisma.dokumentflyt.count({ where: { projectId: input.projectId } }),
          ctx.prisma.projectGroup.count({
            where: { projectId: input.projectId, category: "brukergrupper" },
          }),
          ctx.prisma.dokumentflytMal.count({
            where: { dokumentflyt: { projectId: input.projectId } },
          }),
          ctx.prisma.byggeplass.count({ where: { projectId: input.projectId } }),
        ]);

      return {
        harDokumentflyt: dokumentflytAntall > 0,
        harBrukergruppe: brukergruppeAntall > 0,
        harMalKobletTilFlyt: malKobletAntall > 0,
        harLokasjon: lokasjonAntall > 0,
      };
    }),

  // Opprett nytt prosjekt — auto-tilknytter til firma og oppretter ProjectModule-
  // rader for aktive firmamoduler. Steg 2d (2026-05-03): tar valgfri organizationId
  // fra input. Sitedoc_admin sender valgtFirma.id når de oppretter prosjekt på
  // vegne av et kunde-firma. Vanlig bruker fallbacker til egen organizationId.
  opprett: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const antall = await ctx.prisma.project.count();
      const prosjektnummer = generateProjectNumber(antall + 1);

      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { role: true, organizationId: true },
      });

      // Velg organizationId: input → eksplisitt, fallback → brukerens egen.
      // Verifiser tilgang når input er gitt.
      let valgtOrgId: string | null = null;
      if (input.organizationId) {
        if (
          bruker.role === "sitedoc_admin" ||
          bruker.organizationId === input.organizationId
        ) {
          valgtOrgId = input.organizationId;
        } else {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Ikke tilgang til å opprette prosjekt for dette firmaet",
          });
        }
      } else if (bruker.organizationId) {
        valgtOrgId = bruker.organizationId;
      }

      const firma = valgtOrgId
        ? await ctx.prisma.organization.findUnique({
            where: { id: valgtOrgId },
            select: { harTimerModul: true, harMaskinModul: true },
          })
        : null;

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

          const aktiveModuler: string[] = [];
          if (firma?.harTimerModul) aktiveModuler.push("timer");
          if (firma?.harMaskinModul) aktiveModuler.push("maskin");
          if (aktiveModuler.length > 0) {
            await tx.projectModule.createMany({
              data: aktiveModuler.map((slug) => ({
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
  opprettTestprosjekt: protectedProcedure
    .mutation(async ({ ctx }) => {
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { name: true, organizationId: true },
      });

      const firma = bruker.organizationId
        ? await ctx.prisma.organization.findUnique({
            where: { id: bruker.organizationId },
            select: { harTimerModul: true, harMaskinModul: true },
          })
        : null;

      const antall = await ctx.prisma.project.count();
      const prosjektnummer = generateProjectNumber(antall + 1);
      const prosjektNavn = `Testside ${bruker.name || "Ukjent"}`;

      return ctx.prisma.$transaction(async (tx) => {
        // Opprett prosjektet
        const prosjekt = await tx.project.create({
          data: {
            name: prosjektNavn,
            projectNumber: prosjektnummer,
            primaryOrganizationId: bruker.organizationId ?? null,
            members: {
              create: {
                userId: ctx.userId!,
                role: "admin",
              },
            },
          },
        });

        // Auto-tilknytt til brukerens firma + auto-opprett ProjectModule-rader
        // for aktive firmamoduler (Steg 1c Fase B)
        if (bruker.organizationId) {
          await tx.projectOrganization.create({
            data: {
              organizationId: bruker.organizationId,
              projectId: prosjekt.id,
            },
          });

          const aktiveFirmaModuler: string[] = [];
          if (firma?.harTimerModul) aktiveFirmaModuler.push("timer");
          if (firma?.harMaskinModul) aktiveFirmaModuler.push("maskin");
          if (aktiveFirmaModuler.length > 0) {
            await tx.projectModule.createMany({
              data: aktiveFirmaModuler.map((slug) => ({
                projectId: prosjekt.id,
                moduleSlug: slug,
                organizationId: bruker.organizationId!,
                status: "aktiv",
              })),
              skipDuplicates: true,
            });
          }
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
