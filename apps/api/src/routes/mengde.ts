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
    .input(
      z.object({
        projectId: z.string().uuid(),
        kontraktId: z.string().optional(),
        docType: z.string().optional(),
      }),
    )
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
          ...(input.kontraktId ? { kontraktId: input.kontraktId } : {}),
          ...(input.docType ? { docType: input.docType } : {}),
          ...byggMappeTilgangsFilter(mappeIder),
        },
        include: { folder: { select: { id: true, name: true } } },
        orderBy: [{ notaNr: "asc" }, { uploadedAt: "desc" }],
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
        kontraktId: z.string().optional(),
        dokumentId: z.string().optional(),
        periodId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const where: { projectId: string; documentId?: string; document?: { kontraktId: string } } = {
        projectId: input.projectId,
      };

      if (input.dokumentId) {
        where.documentId = input.dokumentId;
      } else if (input.kontraktId) {
        where.document = { kontraktId: input.kontraktId };
      }

      return ctx.prisma.ftdSpecPost.findMany({
        where,
        include: {
          document: { select: { id: true, docType: true, notaNr: true, kontraktId: true, kontraktNavn: true } },
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
        kontraktId: z.string().optional(),
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
            kontraktId: input.kontraktId ?? null,
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
            kontraktId: input.kontraktId ?? null,
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
        kontraktId: z.string().nullable().optional(),
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

  hentNotaRapport: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        kontraktId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const alle = await ctx.prisma.ftdDocument.findMany({
        where: {
          projectId: input.projectId,
          kontraktId: input.kontraktId,
          isActive: true,
          docType: { in: ["a_nota", "t_nota"] },
          notaNr: { not: null },
        },
        select: {
          id: true,
          notaType: true,
          notaNr: true,
          filename: true,
          utfortPr: true,
          utfortTotalt: true,
          utfortForrige: true,
          utfortDenne: true,
          innestaaende: true,
          innestaaendeForrige: true,
          innestaaendeDenne: true,
          nettoDenne: true,
          mva: true,
          sumInkMva: true,
          uploadedAt: true,
        },
        orderBy: { notaNr: "asc" },
      });

      // Dedupliser per notaNr — prioriter den med mest header-data
      const perNr = new Map<number, (typeof alle)[0]>();
      for (const dok of alle) {
        const nr = dok.notaNr!;
        const eksisterende = perNr.get(nr);
        if (!eksisterende) {
          perNr.set(nr, dok);
        } else {
          // Tell antall header-felter med verdi
          const tell = (d: typeof dok) =>
            [d.utfortTotalt, d.utfortDenne, d.nettoDenne, d.mva, d.sumInkMva]
              .filter((v) => v !== null).length;
          if (tell(dok) > tell(eksisterende)) {
            perNr.set(nr, dok);
          }
        }
      }
      const resultat = Array.from(perNr.values());
      return resultat;
    }),

  hentDokumentasjonForPost: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        kontraktId: z.string().optional(),
        postnr: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      // Finn alle sider som matcher postnr, scopet til kontraktens mapper
      const where: Record<string, unknown> = {
        postnr: input.postnr,
        document: {
          projectId: input.projectId,
          isActive: true,
        },
      };

      if (input.kontraktId) {
        (where.document as Record<string, unknown>).folder = {
          kontraktId: input.kontraktId,
        };
      }

      return ctx.prisma.ftdDocumentPage.findMany({
        where,
        select: {
          id: true,
          pageNumber: true,
          postnr: true,
          document: {
            select: {
              id: true,
              filename: true,
              fileUrl: true,
              notaType: true,
              notaNr: true,
              uploadedAt: true,
            },
          },
        },
        orderBy: [
          { document: { uploadedAt: "asc" } },
          { pageNumber: "asc" },
        ],
      });
    }),
});
