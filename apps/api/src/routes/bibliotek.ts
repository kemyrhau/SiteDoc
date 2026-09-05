import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { finnLedigeMalVerdier } from "./mal";

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

  /**
   * Feltlisten for ÉN sentralmal — for «inspiser før lån» (L1, AM4b).
   *
   * Lazy med vilje: `hentStandarder` selecter IKKE `malInnhold`, og skal ikke.
   * Å laste malInnhold for alle maler ved dialog-åpning skalerer med totalt
   * antall felt i HELE arkivet (regresjonen ordren skal hindre). Denne henter
   * innhold for kun den malen brukeren faktisk åpner forhåndsvisningen på.
   * Returnerer felt uten fase-overskrifter (de bygges ved lån), sortert på
   * sortOrder og med fase for gruppering i UI.
   */
  hentMalInnhold: protectedProcedure
    .input(z.object({ bibliotekMalId: z.string() }))
    .query(async ({ ctx, input }) => {
      const mal = await ctx.prisma.bibliotekMal.findUniqueOrThrow({
        where: { id: input.bibliotekMalId },
        select: { id: true, navn: true, referanse: true, malInnhold: true },
      });
      const raw = (mal.malInnhold ?? []) as Array<{
        label: string;
        type: string;
        fase?: string | null;
        sortOrder?: number;
      }>;
      const felter = [...raw]
        .filter((f) => f && f.type !== "heading")
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((f) => ({ label: f.label, type: f.type, fase: f.fase ?? null }));
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

      const malInnhold = bibMal.malInnhold as Array<{
        label: string;
        type: string;
        zone: string;
        fase?: string;
        config?: Record<string, unknown>;
        sortOrder: number;
      }>;

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
