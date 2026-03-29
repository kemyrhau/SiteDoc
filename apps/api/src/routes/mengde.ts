import { z } from "zod";
import { router, protectedProcedure } from "../trpc/trpc";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import {
  hentTilgjengeligeMappeIder,
  byggMappeTilgangsFilter,
} from "../services/folder-tilgang";
// Prosessering kjøres på API-serveren (ren Node) — ikke i Next.js
const API_INTERN_URL = `http://localhost:${process.env.API_PORT ?? process.env.PORT ?? "3001"}`;

function triggerProsessering(documentId: string) {
  fetch(`${API_INTERN_URL}/prosesser/${documentId}`, { method: "POST" }).catch(
    (err) => console.error(`Kunne ikke trigge prosessering for ${documentId}:`, err),
  );
}

type AvviksStatus = "Match" | "Endret" | "Ny" | "Fjernet";
export interface AvviksRad {
  postnr: string | null;
  beskrivelse: string | null;
  enhet: string | null;
  mengdeAnbud: number;
  mengdeKontrakt: number;
  mengdeDiff: number;
  sumAnbud: number;
  sumKontrakt: number;
  sumDiff: number;
  status: AvviksStatus;
}

export const mengdeRouter = router({
  hentDokumenter: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const mappeIder = await hentTilgjengeligeMappeIder(
        ctx.userId,
        input.projectId,
      );
      return ctx.prisma.ftdDocument.findMany({
        where: {
          projectId: input.projectId,
          isActive: true,
          docType: { not: null }, // Kun dokumenter importert til økonomi
          ...byggMappeTilgangsFilter(mappeIder),
        },
        include: { folder: { select: { id: true, name: true } } },
        orderBy: { uploadedAt: "desc" },
      });
    }),

  hentPerioder: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        enterpriseId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.ftdNotaPeriod.findMany({
        where: {
          projectId: input.projectId,
          ...(input.enterpriseId
            ? { enterpriseId: input.enterpriseId }
            : {}),
        },
        include: {
          enterprise: { select: { id: true, name: true, color: true } },
        },
        orderBy: { periodeNr: "asc" },
      });
    }),

  hentSpecPoster: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        periodId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      return ctx.prisma.ftdSpecPost.findMany({
        where: { projectId: input.projectId },
        include: {
          notaPoster: input.periodId
            ? { where: { periodId: input.periodId } }
            : false,
        },
        orderBy: { postnr: "asc" },
      });
    }),

  hentAvviksanalyse: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const specPosts = await ctx.prisma.ftdSpecPost.findMany({
        where: { projectId: input.projectId },
      });
      const forstePeriode = await ctx.prisma.ftdNotaPeriod.findFirst({
        where: { projectId: input.projectId, type: "a_nota" },
        orderBy: { periodeNr: "asc" },
        include: { poster: true },
      });

      if (!forstePeriode) return { rows: [], summary: null };

      const kontraktMap = new Map(
        forstePeriode.poster.map((p) => [p.specPostId, p]),
      );

      const rows: AvviksRad[] = specPosts.map((sp) => {
        const kp = kontraktMap.get(sp.id);
        const mengdeAnbud = Number(sp.mengdeAnbud ?? 0);
        const mengdeKontrakt = kp ? Number(kp.mengdeAnbud ?? 0) : 0;
        const sumAnbud = Number(sp.sumAnbud ?? 0);
        const sumKontrakt = kp ? Number(kp.sumAnbud ?? 0) : 0;

        let status: AvviksStatus;
        if (!kp) status = "Fjernet";
        else if (sumAnbud === sumKontrakt && mengdeAnbud === mengdeKontrakt)
          status = "Match";
        else status = "Endret";

        return {
          postnr: sp.postnr,
          beskrivelse: sp.beskrivelse,
          enhet: sp.enhet,
          mengdeAnbud,
          mengdeKontrakt,
          mengdeDiff: mengdeKontrakt - mengdeAnbud,
          sumAnbud,
          sumKontrakt,
          sumDiff: sumKontrakt - sumAnbud,
          status,
        };
      });

      // Poster i kontrakt som ikke finnes i budsjett → "Ny"
      for (const [specPostId, kp] of kontraktMap) {
        if (!specPosts.find((sp) => sp.id === specPostId)) {
          rows.push({
            postnr: null,
            beskrivelse: "Ny post",
            enhet: null,
            mengdeAnbud: 0,
            mengdeKontrakt: Number(kp.mengdeAnbud ?? 0),
            mengdeDiff: Number(kp.mengdeAnbud ?? 0),
            sumAnbud: 0,
            sumKontrakt: Number(kp.sumAnbud ?? 0),
            sumDiff: Number(kp.sumAnbud ?? 0),
            status: "Ny" as const,
          });
        }
      }

      return {
        rows,
        summary: {
          totalAnbud: rows.reduce((s, r) => s + r.sumAnbud, 0),
          totalKontrakt: rows.reduce((s, r) => s + r.sumKontrakt, 0),
          totalDiff: rows.reduce((s, r) => s + r.sumDiff, 0),
          antallMatch: rows.filter((r) => r.status === "Match").length,
          antallEndret: rows.filter((r) => r.status === "Endret").length,
          antallNy: rows.filter((r) => r.status === "Ny").length,
          antallFjernet: rows.filter((r) => r.status === "Fjernet").length,
        },
      };
    }),

  lagreNotat: protectedProcedure
    .input(z.object({ specPostId: z.string(), tekst: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.ftdSpecPost.update({
        where: { id: input.specPostId },
        data: { eksternNotat: input.tekst },
      });
    }),

  slettPeriode: protectedProcedure
    .input(z.object({ periodId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.ftdNotaPeriod.delete({
        where: { id: input.periodId },
      });
    }),

  registrerDokument: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        folderId: z.string().uuid().optional(),
        filename: z.string(),
        fileUrl: z.string(),
        filetype: z.string().optional(),
        docType: z.enum(["anbudsgrunnlag", "budsjett", "a_nota", "t_nota", "mengdebeskrivelse", "annet"]).default("annet"),
        kontraktNavn: z.string().optional(),
        notaType: z.enum(["A-Nota", "T-Nota", "Sluttnota"]).optional(),
        notaNr: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // Sjekk om et soft-slettet dokument med samme filnavn finnes
      const eksisterende = await ctx.prisma.ftdDocument.findUnique({
        where: {
          projectId_filename: {
            projectId: input.projectId,
            filename: input.filename,
          },
        },
      });

      let doc;
      if (eksisterende) {
        // Reaktiver og oppdater
        doc = await ctx.prisma.ftdDocument.update({
          where: { id: eksisterende.id },
          data: {
            isActive: true,
            folderId: input.folderId ?? null,
            fileUrl: input.fileUrl,
            filetype: input.filetype ?? null,
            docType: input.docType,
            kontraktNavn: input.kontraktNavn ?? null,
            notaType: input.notaType ?? null,
            notaNr: input.notaNr ?? null,
            processingState: "pending",
            processingError: null,
          },
        });
        // Slett gamle chunks og spec-poster
        await ctx.prisma.ftdDocumentChunk.deleteMany({ where: { documentId: doc.id } });
        await ctx.prisma.ftdSpecPost.deleteMany({ where: { documentId: doc.id } });
      } else {
        doc = await ctx.prisma.ftdDocument.create({
          data: {
            projectId: input.projectId,
            folderId: input.folderId ?? null,
            filename: input.filename,
            fileUrl: input.fileUrl,
            filetype: input.filetype ?? null,
            docType: input.docType,
            kontraktNavn: input.kontraktNavn ?? null,
            notaType: input.notaType ?? null,
            notaNr: input.notaNr ?? null,
          },
        });
      }

      // Trigger prosessering på API-serveren (ren Node-kontekst)
      triggerProsessering(doc.id);

      return doc;
    }),

  reprosesser: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.ftdDocument.findUniqueOrThrow({
        where: { id: input.documentId },
      });
      await verifiserProsjektmedlem(ctx.userId, doc.projectId);

      // Slett eksisterende chunks og spec-poster fra dette dokumentet
      await ctx.prisma.ftdDocumentChunk.deleteMany({
        where: { documentId: input.documentId },
      });
      await ctx.prisma.ftdSpecPost.deleteMany({
        where: { documentId: input.documentId },
      });

      // Nullstill og kjør på nytt
      await ctx.prisma.ftdDocument.update({
        where: { id: input.documentId },
        data: { processingState: "pending", processingError: null },
      });

      triggerProsessering(input.documentId);

      return { ok: true };
    }),

  oppdaterDokument: protectedProcedure
    .input(
      z.object({
        documentId: z.string(),
        docType: z.enum(["anbudsgrunnlag", "a_nota", "t_nota", "mengdebeskrivelse", "annet"]).optional(),
        notaType: z.enum(["A-Nota", "T-Nota", "Sluttnota"]).nullable().optional(),
        notaNr: z.number().int().nullable().optional(),
        kontraktNavn: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { documentId, ...data } = input;
      return ctx.prisma.ftdDocument.update({
        where: { id: documentId },
        data,
      });
    }),

  fjernFraOkonomi: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fjern økonomi-kobling — dokumentet beholdes i mapper
      await ctx.prisma.ftdSpecPost.deleteMany({ where: { documentId: input.documentId } });
      return ctx.prisma.ftdDocument.update({
        where: { id: input.documentId },
        data: {
          docType: null,
          notaType: null,
          notaNr: null,
          kontraktNavn: null,
        },
      });
    }),
});
