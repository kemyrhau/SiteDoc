import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { createProjectSchema, STANDARD_PROJECT_GROUPS, PROSJEKT_MODULER, STANDARD_ENTREPRISER, STANDARD_DOKUMENTFLYTER } from "@sitedoc/shared";
import { generateProjectNumber } from "@sitedoc/shared";
import type { Prisma } from "@sitedoc/db";
import {
  verifiserProsjektmedlem,
  verifiserAdmin,
} from "../trpc/tilgangskontroll";

export const prosjektRouter = router({
  // Hent prosjekter der innlogget bruker er medlem (sitedoc_admin ser alle)
  hentMine: protectedProcedure.query(async ({ ctx }) => {
    const bruker = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { role: true } });
    const erSitedocAdmin = bruker.role === "sitedoc_admin";
    return ctx.prisma.project.findMany({
      where: erSitedocAdmin ? {} : { members: { some: { userId: ctx.userId } } },
      orderBy: { updatedAt: "desc" },
      include: {
        enterprises: true,
        _count: { select: { members: true } },
      },
    });
  }),

  // Hent alle prosjekter (sitedoc_admin ser alle)
  hentAlle: protectedProcedure.query(async ({ ctx }) => {
    const bruker = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { role: true } });
    const erSitedocAdmin = bruker.role === "sitedoc_admin";
    return ctx.prisma.project.findMany({
      where: erSitedocAdmin ? {} : { members: { some: { userId: ctx.userId } } },
      orderBy: { createdAt: "desc" },
      include: {
        enterprises: true,
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
          enterprises: true,
          members: {
            include: {
              user: true,
              enterprises: { include: { enterprise: true } },
            },
          },
          templates: true,
          drawings: true,
          folders: { where: { parentId: null }, include: { children: true } },
          organizationProjects: { select: { id: true } },
        },
      });
    }),

  // Opprett nytt prosjekt — kobler automatisk til brukerens firma hvis det finnes
  opprett: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      // Tell eksisterende prosjekter for sekvensnummer
      const antall = await ctx.prisma.project.count();
      const prosjektnummer = generateProjectNumber(antall + 1);

      const prosjekt = await ctx.prisma.project.create({
        data: {
          ...input,
          projectNumber: prosjektnummer,
          members: {
            create: {
              userId: ctx.userId!,
              role: "admin",
            },
          },
        },
      });

      // Auto-tilknytt til brukerens firma
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { organizationId: true },
      });

      if (bruker.organizationId) {
        await ctx.prisma.organizationProject.create({
          data: {
            organizationId: bruker.organizationId,
            projectId: prosjekt.id,
          },
        });
      }

      return prosjekt;
    }),

  // Opprett testprosjekt med standardgrupper og moduler (for nye brukere)
  opprettTestprosjekt: protectedProcedure
    .mutation(async ({ ctx }) => {
      const bruker = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { name: true, organizationId: true },
      });

      const antall = await ctx.prisma.project.count();
      const prosjektnummer = generateProjectNumber(antall + 1);
      const prosjektNavn = `Testside ${bruker.name || "Ukjent"}`;

      return ctx.prisma.$transaction(async (tx) => {
        // Opprett prosjektet
        const prosjekt = await tx.project.create({
          data: {
            name: prosjektNavn,
            projectNumber: prosjektnummer,
            members: {
              create: {
                userId: ctx.userId!,
                role: "admin",
              },
            },
          },
        });

        // Auto-tilknytt til brukerens firma
        if (bruker.organizationId) {
          await tx.organizationProject.create({
            data: {
              organizationId: bruker.organizationId,
              projectId: prosjekt.id,
            },
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

        // Opprett standard entrepriser
        const entrepriseIder: string[] = [];
        for (const entDef of STANDARD_ENTREPRISER) {
          const ent = await tx.enterprise.create({
            data: {
              projectId: prosjekt.id,
              name: entDef.navn,
              industry: entDef.bransje,
              color: entDef.farge,
              enterpriseNumber: entDef.entreprisenummer,
            },
          });
          entrepriseIder.push(ent.id);
        }

        // Koble bruker til Byggherre-entreprisen (første)
        const medlem = await tx.projectMember.findFirst({
          where: { projectId: prosjekt.id, userId: ctx.userId },
        });
        if (medlem && entrepriseIder.length > 0) {
          await tx.memberEnterprise.create({
            data: {
              projectMemberId: medlem.id,
              enterpriseId: entrepriseIder[0]!,
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
            if (idx < entrepriseIder.length) {
              await tx.dokumentflytMedlem.create({
                data: {
                  dokumentflytId: flyt.id,
                  enterpriseId: entrepriseIder[idx],
                  rolle: "bestiller",
                  steg: 1,
                },
              });
            }
          }

          // Legg til svarer-medlemmer
          for (const idx of flytDef.svarer) {
            if (idx < entrepriseIder.length) {
              await tx.dokumentflytMedlem.create({
                data: {
                  dokumentflytId: flyt.id,
                  enterpriseId: entrepriseIder[idx],
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
