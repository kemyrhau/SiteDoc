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

  // Hent oversettelsesinnstillinger for et prosjekt
  hentOversettelsesInnstillinger: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const modul = await ctx.prisma.projectModule.findUnique({
        where: { projectId_moduleSlug: { projectId: input.projectId, moduleSlug: "oversettelse" } },
      });
      if (!modul || !modul.active) return { aktiv: false, motor: "opus-mt" as const, apiKey: null };
      const config = (modul.config ?? {}) as { motor?: string; apiKey?: string };
      return {
        aktiv: true,
        motor: (config.motor ?? "opus-mt") as "opus-mt" | "google" | "deepl",
        apiKey: config.apiKey ? "••••••••" : null, // Skjul nøkkel
      };
    }),

  // Oppdater oversettelsesinnstillinger (kun firmaadmin/prosjektadmin)
  oppdaterOversettelsesInnstillinger: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      motor: z.enum(["opus-mt", "google", "deepl"]),
      apiKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const config: Record<string, string> = { motor: input.motor };
      if (input.apiKey && input.apiKey !== "••••••••") {
        config.apiKey = input.apiKey;
      } else if (input.apiKey === "••••••••") {
        // Behold eksisterende nøkkel
        const eksisterende = await ctx.prisma.projectModule.findUnique({
          where: { projectId_moduleSlug: { projectId: input.projectId, moduleSlug: "oversettelse" } },
        });
        const eksConfig = (eksisterende?.config ?? {}) as { apiKey?: string };
        if (eksConfig.apiKey) config.apiKey = eksConfig.apiKey;
      }
      return ctx.prisma.projectModule.update({
        where: { projectId_moduleSlug: { projectId: input.projectId, moduleSlug: "oversettelse" } },
        data: { config },
      });
    }),

  // Sammenlign oversettelse av én blokk med alle motorer
  sammenlignOversettelse: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      blokkId: z.string(),
      targetLang: z.string().min(2).max(5),
    }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // Hent blokken og finn norsk original
      const blokk = await ctx.prisma.ftdDocumentBlock.findUnique({
        where: { id: input.blokkId },
        select: { content: true, language: true, sourceBlockId: true },
      });
      if (!blokk) throw new Error("Blokk ikke funnet");

      // Hent norsk kildetekst
      let norskTekst: string;
      if (blokk.language === "nb") {
        norskTekst = blokk.content;
      } else if (blokk.sourceBlockId) {
        const kilde = await ctx.prisma.ftdDocumentBlock.findUnique({
          where: { id: blokk.sourceBlockId },
          select: { content: true },
        });
        norskTekst = kilde?.content ?? blokk.content;
      } else {
        norskTekst = blokk.content;
      }

      const modul = await ctx.prisma.projectModule.findUnique({
        where: { projectId_moduleSlug: { projectId: input.projectId, moduleSlug: "oversettelse" } },
      });
      const config = (modul?.config ?? {}) as { apiKey?: string };
      const { sammenlignMotorer } = await import("../services/oversettelse-service");
      return {
        norskOriginal: norskTekst,
        oversettelser: await sammenlignMotorer(norskTekst, input.targetLang, config.apiKey),
      };
    }),

  // Re-oversett hele dokumentet med valgt motor
  reOversettDokument: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      documentId: z.string(),
      targetLang: z.string().min(2).max(5),
      motor: z.enum(["opus-mt", "google", "deepl"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      await ctx.prisma.ftdDocumentBlock.deleteMany({
        where: { documentId: input.documentId, language: input.targetLang },
      });
      // Tøm cache for dette dokumentet+språket
      const blokker = await ctx.prisma.ftdDocumentBlock.findMany({
        where: { documentId: input.documentId, language: "nb" },
        select: { content: true },
      });
      if (blokker.length > 0) {
        const { createHash } = await import("node:crypto");
        const hashes = blokker.map((b) => createHash("sha256").update(b.content).digest("hex"));
        await ctx.prisma.translationCache.deleteMany({
          where: { contentHash: { in: hashes }, targetLang: input.targetLang },
        });
      }
      await ctx.prisma.ftdTranslationJob.upsert({
        where: { documentId_targetLang: { documentId: input.documentId, targetLang: input.targetLang } },
        create: { id: `${input.documentId}-${input.targetLang}`, documentId: input.documentId, targetLang: input.targetLang, status: "pending", blocksTotal: blokker.length },
        update: { status: "pending", blocksDone: 0, error: null, blocksTotal: blokker.length },
      });
      // Oppdater motor
      const modul = await ctx.prisma.projectModule.findUnique({
        where: { projectId_moduleSlug: { projectId: input.projectId, moduleSlug: "oversettelse" } },
      });
      const config = (modul?.config ?? {}) as Record<string, string>;
      config.motor = input.motor;
      await ctx.prisma.projectModule.update({
        where: { projectId_moduleSlug: { projectId: input.projectId, moduleSlug: "oversettelse" } },
        data: { config },
      });
      return { status: "queued", blokker: blokker.length };
    }),
});
