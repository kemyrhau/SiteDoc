import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { PROSJEKT_MODULER } from "@sitedoc/shared";
import type { Prisma } from "@sitedoc/db";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

export const modulRouter = router({
  // Hent aktive moduler for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.projectModule.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "asc" },
      });
    }),

  // Aktiver en modul — oppretter maler og rapportobjekter automatisk
  aktiver: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      moduleSlug: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const modulDef = PROSJEKT_MODULER.find((m) => m.slug === input.moduleSlug);
      if (!modulDef) {
        throw new Error(`Ukjent modul: ${input.moduleSlug}`);
      }

      // Auto-aktiver avhengigheter
      if (modulDef.krever && modulDef.krever.length > 0) {
        for (const krevSlug of modulDef.krever) {
          const krevEksisterende = await ctx.prisma.projectModule.findUnique({
            where: {
              projectId_moduleSlug: {
                projectId: input.projectId,
                moduleSlug: krevSlug,
              },
            },
          });
          if (!krevEksisterende) {
            await ctx.prisma.projectModule.create({
              data: { projectId: input.projectId, moduleSlug: krevSlug },
            });
          } else if (!krevEksisterende.active) {
            await ctx.prisma.projectModule.update({
              where: { id: krevEksisterende.id },
              data: { active: true },
            });
          }
        }
      }

      // Sjekk om allerede aktivert
      const eksisterende = await ctx.prisma.projectModule.findUnique({
        where: {
          projectId_moduleSlug: {
            projectId: input.projectId,
            moduleSlug: input.moduleSlug,
          },
        },
      });

      if (eksisterende) {
        // Reaktiver hvis deaktivert
        if (!eksisterende.active) {
          return ctx.prisma.projectModule.update({
            where: { id: eksisterende.id },
            data: { active: true },
          });
        }
        return eksisterende;
      }

      // Opprett modulen og malene i en transaksjon
      return ctx.prisma.$transaction(async (tx) => {
        // Registrer modulen
        const modul = await tx.projectModule.create({
          data: {
            projectId: input.projectId,
            moduleSlug: input.moduleSlug,
          },
        });

        // Opprett maler med rapportobjekter
        for (const malDef of modulDef.maler) {
          // Sjekk om mal med samme prefix allerede finnes
          const eksisterendeMal = await tx.reportTemplate.findFirst({
            where: { projectId: input.projectId, prefix: malDef.prefix },
          });

          if (eksisterendeMal) continue; // Ikke overskriv eksisterende

          const mal = await tx.reportTemplate.create({
            data: {
              projectId: input.projectId,
              name: malDef.navn,
              description: malDef.beskrivelse,
              prefix: malDef.prefix,
              category: malDef.kategori,
              domain: malDef.domain,
              subjects: (malDef.emner ?? []) as Prisma.InputJsonValue,
            },
          });

          // Opprett rapportobjekter
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

        return modul;
      });
    }),

  // Deaktiver en modul (beholder malene — de kan ha data)
  deaktiver: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      moduleSlug: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // Sjekk om andre aktive moduler avhenger av denne
      const avhengige = PROSJEKT_MODULER.filter(
        (m) => m.krever?.includes(input.moduleSlug),
      );
      if (avhengige.length > 0) {
        const aktiveAvhengige = await ctx.prisma.projectModule.findMany({
          where: {
            projectId: input.projectId,
            moduleSlug: { in: avhengige.map((m) => m.slug) },
            active: true,
          },
        });
        if (aktiveAvhengige.length > 0) {
          const navn = aktiveAvhengige
            .map((m) => PROSJEKT_MODULER.find((d) => d.slug === m.moduleSlug)?.navn ?? m.moduleSlug)
            .join(", ");
          throw new Error(
            `Kan ikke deaktivere — ${navn} avhenger av denne modulen`,
          );
        }
      }

      return ctx.prisma.projectModule.update({
        where: {
          projectId_moduleSlug: {
            projectId: input.projectId,
            moduleSlug: input.moduleSlug,
          },
        },
        data: { active: false },
      });
    }),
});
