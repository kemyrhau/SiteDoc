import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { PROSJEKT_MODULER } from "@sitedoc/shared";
import type { Prisma } from "@sitedoc/db";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

/**
 * Seeder HMS-spesifikk infrastruktur når hms-avvik-modulen aktiveres:
 * - HMS-gruppe (ProjectGroup med domains: ["hms"])
 * - HMS-dokumentflyt med bestiller-boks (åpen) + utforer-boks (HMS-gruppe)
 * - Kobler alle ReportTemplate(domain="hms") på prosjektet til flyten
 *
 * Idempotent: gjentatte kall gir ikke duplikater.
 */
async function seedHmsModulOmradet(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<void> {
  // 1) Finn eller opprett HMS-gruppen
  let hmsGruppe = await tx.projectGroup.findFirst({
    where: { projectId, domains: { array_contains: ["hms"] } },
    select: { id: true },
  });
  if (!hmsGruppe) {
    hmsGruppe = await tx.projectGroup.create({
      data: {
        projectId,
        name: "HMS-ansvarlige",
        slug: "hms-ansvarlige",
        category: "field",
        domains: ["hms"],
        permissions: [
          "create_tasks",
          "create_checklists",
          "checklist_edit",
          "checklist_view",
          "task_edit",
          "task_view",
        ],
        isDefault: true,
      },
      select: { id: true },
    });
  }

  // 2) Finn eksisterende HMS-flyt via DokumentflytMal-kobling til mal med domain="hms"
  let hmsFlyt = await tx.dokumentflyt.findFirst({
    where: {
      projectId,
      maler: { some: { template: { domain: "hms" } } },
    },
    select: { id: true },
  });
  if (!hmsFlyt) {
    hmsFlyt = await tx.dokumentflyt.create({
      data: { projectId, name: "HMS" },
      select: { id: true },
    });
    // Boks 1: bestiller — null-medlem (åpen for alle prosjektmedlemmer)
    await tx.dokumentflytMedlem.create({
      data: { dokumentflytId: hmsFlyt.id, rolle: "bestiller", steg: 1 },
    });
    // Boks 2: utforer — HMS-gruppen
    await tx.dokumentflytMedlem.create({
      data: {
        dokumentflytId: hmsFlyt.id,
        rolle: "utforer",
        steg: 2,
        groupId: hmsGruppe.id,
      },
    });
  }

  // 3) Koble alle HMS-maler til flyten — idempotent via composite-unique
  const hmsMaler = await tx.reportTemplate.findMany({
    where: { projectId, domain: "hms" },
    select: { id: true },
  });
  for (const mal of hmsMaler) {
    await tx.dokumentflytMal.upsert({
      where: {
        dokumentflytId_templateId: {
          dokumentflytId: hmsFlyt.id,
          templateId: mal.id,
        },
      },
      create: { dokumentflytId: hmsFlyt.id, templateId: mal.id },
      update: {},
    });
  }
}

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
          } else if (krevEksisterende.status !== "aktiv") {
            await ctx.prisma.projectModule.update({
              where: { id: krevEksisterende.id },
              data: { status: "aktiv" },
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

      // Opprett/reaktiver modulen + seed maler + (for HMS) seed gruppe/flyt/koblinger
      // i én transaksjon. Reaktivering kjører også seeding-løkkene — alle steg er
      // idempotente, slik at brukere som har slettet HMS-gruppen mellom deaktivering
      // og reaktivering får den gjenopprettet.
      return ctx.prisma.$transaction(async (tx) => {
        // Registrer eller reaktiver ProjectModule
        let modul;
        if (eksisterende) {
          modul = eksisterende.status === "aktiv"
            ? eksisterende
            : await tx.projectModule.update({
                where: { id: eksisterende.id },
                data: { status: "aktiv" },
              });
        } else {
          modul = await tx.projectModule.create({
            data: {
              projectId: input.projectId,
              moduleSlug: input.moduleSlug,
            },
          });
        }

        // Opprett maler med rapportobjekter (idempotent på prefix)
        for (const malDef of modulDef.maler) {
          const eksisterendeMal = await tx.reportTemplate.findFirst({
            where: { projectId: input.projectId, prefix: malDef.prefix },
          });

          if (eksisterendeMal) continue;

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

        // HMS-spesifikk seeding: gruppe + flyt + mal-koblinger
        if (input.moduleSlug === "hms-avvik") {
          await seedHmsModulOmradet(tx, input.projectId);
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
            status: "aktiv",
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

      // Default deaktivering = arkivert (per A.17). Slettet krever eksplisitt admin-handling.
      return ctx.prisma.projectModule.update({
        where: {
          projectId_moduleSlug: {
            projectId: input.projectId,
            moduleSlug: input.moduleSlug,
          },
        },
        data: { status: "arkivert" },
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
      if (!modul || modul.status !== "aktiv") return { aktiv: false, motor: "opus-mt" as const, apiKey: null };
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

      // Hent blokken og finn original kildetekst
      const blokk = await ctx.prisma.ftdDocumentBlock.findUnique({
        where: { id: input.blokkId },
        select: { content: true, language: true, sourceBlockId: true, documentId: true },
      });
      if (!blokk) throw new Error("Blokk ikke funnet");

      // Hent dokumentets kildespråk
      const dok = await ctx.prisma.ftdDocument.findUnique({
        where: { id: blokk.documentId },
        select: { sourceLanguage: true },
      });
      const sourceLang = dok?.sourceLanguage ?? "nb";

      // Hent kildetekst (original)
      let kildeTekst: string;
      if (blokk.language === sourceLang) {
        kildeTekst = blokk.content;
      } else if (blokk.sourceBlockId) {
        const kilde = await ctx.prisma.ftdDocumentBlock.findUnique({
          where: { id: blokk.sourceBlockId },
          select: { content: true },
        });
        kildeTekst = kilde?.content ?? blokk.content;
      } else {
        kildeTekst = blokk.content;
      }

      const modul = await ctx.prisma.projectModule.findUnique({
        where: { projectId_moduleSlug: { projectId: input.projectId, moduleSlug: "oversettelse" } },
      });
      const config = (modul?.config ?? {}) as { apiKey?: string };
      const { sammenlignMotorer } = await import("../services/oversettelse-service");
      return {
        norskOriginal: kildeTekst,
        kildesprak: sourceLang,
        oversettelser: await sammenlignMotorer(kildeTekst, input.targetLang, config.apiKey, sourceLang),
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
