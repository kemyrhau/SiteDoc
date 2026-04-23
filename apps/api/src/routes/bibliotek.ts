import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";

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
                },
              },
            },
          },
        },
      });
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

      const malInnhold = bibMal.malInnhold as Array<{
        label: string;
        type: string;
        zone: string;
        fase?: string;
        config?: Record<string, unknown>;
        sortOrder: number;
      }>;

      // Opprett ReportTemplate (SjekklisteMal)
      const template = await ctx.prisma.reportTemplate.create({
        data: {
          projectId: input.projectId,
          name: bibMal.navn,
          description: `${bibMal.kapittel.standard.kode} ${bibMal.referanse}${bibMal.beskrivelse ? " — " + bibMal.beskrivelse : ""}`,
          category: "sjekkliste",
          domain: "kvalitet",
          prefix: bibMal.referanse.split(/[\s\/]/)[0] ?? undefined,
        },
      });

      // Opprett ReportObjects (felt) fra malInnhold
      if (Array.isArray(malInnhold) && malInnhold.length > 0) {
        // Legg til et heading-felt for fasen, gruppert
        const faser = [...new Set(malInnhold.map((f) => f.fase).filter(Boolean))];
        let sortIdx = 0;

        for (const fase of faser) {
          // Fase-overskrift
          sortIdx++;
          await ctx.prisma.reportObject.create({
            data: {
              templateId: template.id,
              type: "heading",
              label: fase === "FØR" ? "Kontroll FØR utførelse" : fase === "UNDER" ? "Kontroll UNDER utførelse" : "Kontroll ETTER utførelse",
              sortOrder: sortIdx,
              config: { zone: "datafelter" },
            },
          });

          // Felt for denne fasen
          const faseFelt = malInnhold.filter((f) => f.fase === fase);
          for (const f of faseFelt) {
            sortIdx++;
            await ctx.prisma.reportObject.create({
              data: {
                templateId: template.id,
                type: f.type,
                label: f.label,
                sortOrder: sortIdx,
                config: { zone: f.zone ?? "datafelter", ...f.config },
              },
            });
          }
        }

        // Felt uten fase
        const utenFase = malInnhold.filter((f) => !f.fase);
        for (const f of utenFase) {
          sortIdx++;
          await ctx.prisma.reportObject.create({
            data: {
              templateId: template.id,
              type: f.type,
              label: f.label,
              sortOrder: sortIdx,
              config: { zone: f.zone ?? "datafelter", ...f.config },
            },
          });
        }
      }

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
});
