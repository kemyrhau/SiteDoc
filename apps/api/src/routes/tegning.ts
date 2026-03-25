import { z } from "zod";
import { Prisma } from "@sitedoc/db";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { router, protectedProcedure } from "../trpc/trpc";
import {
  drawingDisciplineSchema,
  drawingTypeSchema,
  drawingStatusSchema,
  geoReferanseSchema,
} from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { konverterDwg } from "../services/dwgKonvertering";
import { trekUtIfcMetadata } from "../services/ifcMetadata";

const UPLOADS_DIR = join(process.cwd(), "uploads");

const fagdisipliner = drawingDisciplineSchema;
const tegningstyper = drawingTypeSchema;
const tegningStatuser = drawingStatusSchema;

export const tegningRouter = router({
  // Hent alle tegninger for et prosjekt
  hentForProsjekt: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        discipline: z.string().optional(),
        status: z.string().optional(),
        buildingId: z.string().uuid().optional(),
        floor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { projectId, discipline, status, buildingId, floor } = input;
      return ctx.prisma.drawing.findMany({
        where: {
          projectId,
          ...(discipline ? { discipline } : {}),
          ...(status ? { status } : {}),
          ...(buildingId ? { buildingId } : {}),
          ...(floor ? { floor } : {}),
        },
        include: {
          building: { select: { id: true, name: true } },
          _count: { select: { revisions: true } },
        },
        orderBy: [{ discipline: "asc" }, { drawingNumber: "asc" }, { name: "asc" }],
      });
    }),

  // Hent tegninger for en bygning
  hentForBygning: protectedProcedure
    .input(z.object({ buildingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bygning = await ctx.prisma.building.findUniqueOrThrow({ where: { id: input.buildingId }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, bygning.projectId);
      return ctx.prisma.drawing.findMany({
        where: { buildingId: input.buildingId },
        include: { _count: { select: { revisions: true } } },
        orderBy: [{ discipline: "asc" }, { drawingNumber: "asc" }],
      });
    }),

  // Hent én tegning med revisjonshistorikk
  hentMedId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          building: true,
          project: { select: { id: true, name: true } },
          revisions: {
            orderBy: { createdAt: "desc" },
            include: { uploadedBy: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);

      // For PDF-filer: hent sidedimensjoner for korrekt markørposisjonering på mobil
      let pdfPageSize: { width: number; height: number } | null = null;
      if (tegning.fileType === "pdf" && tegning.fileUrl) {
        try {
          const filSti = join(UPLOADS_DIR, tegning.fileUrl.replace("/uploads/", ""));
          const pdfBytes = await readFile(filSti);
          const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
          const side = pdfDoc.getPage(0);
          const { width: pw, height: ph } = side.getSize();
          pdfPageSize = { width: pw, height: ph };
        } catch {
          // Ignorer — pdfPageSize forblir null
        }
      }

      return { ...tegning, pdfPageSize };
    }),

  // Opprett ny tegning
  opprett: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        buildingId: z.string().uuid().optional(),
        name: z.string().min(1).max(255),
        drawingNumber: z.string().max(50).optional(),
        discipline: fagdisipliner.optional(),
        drawingType: tegningstyper.optional(),
        revision: z.string().max(10).default("A"),
        status: tegningStatuser.default("utkast"),
        floor: z.string().max(20).optional(),
        scale: z.string().max(20).optional(),
        description: z.string().optional(),
        originator: z.string().max(255).optional(),
        fileUrl: z.string(),
        fileType: z.string(),
        fileSize: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);

      const erDwg = input.fileType.toLowerCase() === "dwg";
      const erIfc = input.fileType.toLowerCase() === "ifc";

      const tegning = await ctx.prisma.drawing.create({
        data: {
          ...input,
          ...(erDwg ? {
            originalFileUrl: input.fileUrl,
            conversionStatus: "pending",
          } : {}),
        },
      });

      // Start asynkron DWG-konvertering i bakgrunnen
      if (erDwg) {
        const dwgFilSti = join(UPLOADS_DIR, input.fileUrl.replace("/uploads/", ""));
        konverterDwg(dwgFilSti, input.name, UPLOADS_DIR)
          .then(async (resultat) => {
            const oppdatering: Record<string, unknown> = {
              conversionStatus: resultat.feil ? "failed" : "done",
              conversionError: resultat.feil,
            };

            if (resultat.koordinatSystem) {
              oppdatering.coordinateSystem = resultat.koordinatSystem;
            }

            if (resultat.geoReferanse) {
              oppdatering.geoReference = resultat.geoReferanse;
            }

            if (resultat.visningUrl) {
              oppdatering.fileUrl = resultat.visningUrl;
              oppdatering.fileType = resultat.visningFilType;
            }

            await ctx.prisma.drawing.update({
              where: { id: tegning.id },
              data: oppdatering,
            });
            console.log(`[DWG] Konvertering fullført for tegning ${tegning.id}`);

            // Opprett ekstra tegninger for hvert layout i DWG-filen
            if (resultat.layouts.length > 0) {
              console.log(`[DWG] Oppretter ${resultat.layouts.length} layout-tegninger...`);
              for (const layout of resultat.layouts) {
                try {
                  await ctx.prisma.drawing.create({
                    data: {
                      projectId: input.projectId,
                      buildingId: input.buildingId,
                      name: layout.navn,
                      fileUrl: layout.visningUrl,
                      fileType: layout.visningFilType,
                      originalFileUrl: input.fileUrl,
                      conversionStatus: "done",
                      coordinateSystem: resultat.koordinatSystem,
                      description: `Layout fra ${input.name} (fane ${layout.tabOrder})`,
                    },
                  });
                  console.log(`[DWG] Layout-tegning opprettet: "${layout.navn}"`);
                } catch (layoutErr) {
                  console.error(`[DWG] Feil ved opprettelse av layout "${layout.navn}":`, layoutErr);
                }
              }
            }
          })
          .catch(async (err) => {
            console.error(`[DWG] Konvertering feilet for tegning ${tegning.id}:`, err);
            await ctx.prisma.drawing.update({
              where: { id: tegning.id },
              data: {
                conversionStatus: "failed",
                conversionError: err instanceof Error ? err.message : "Ukjent feil",
              },
            });
          });
      }

      // Parse IFC-metadata asynkront
      if (erIfc) {
        const ifcFilSti = join(UPLOADS_DIR, input.fileUrl.replace("/uploads/", ""));
        trekUtIfcMetadata(ifcFilSti, input.name)
          .then(async (meta) => {
            const oppdatering: Record<string, unknown> = {
              ifcMetadata: meta,
            };
            // Sett fagdisiplin hvis ikke allerede angitt
            if (meta.fagdisiplin && !input.discipline) {
              oppdatering.discipline = meta.fagdisiplin;
            }
            // Sett originator fra organisasjon
            if (meta.organisasjon && !input.originator) {
              oppdatering.originator = meta.organisasjon;
            }
            console.log(`[IFC] Metadata uttrukket for tegning ${tegning.id}: ${meta.prosjektnavn ?? "ukjent prosjekt"}`);
            await ctx.prisma.drawing.update({
              where: { id: tegning.id },
              data: oppdatering,
            });
          })
          .catch((err) => {
            console.error(`[IFC] Metadata-utvinning feilet for tegning ${tegning.id}:`, err);
          });
      }

      return tegning;
    }),

  // Oppdater tegningsmetadata
  oppdater: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        drawingNumber: z.string().max(50).optional(),
        discipline: fagdisipliner.optional(),
        drawingType: tegningstyper.optional(),
        status: tegningStatuser.optional(),
        floor: z.string().max(20).optional(),
        scale: z.string().max(20).optional(),
        description: z.string().optional(),
        originator: z.string().max(255).optional(),
        buildingId: z.string().uuid().nullable().optional(),
        issuedAt: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return ctx.prisma.drawing.update({ where: { id }, data });
    }),

  // Last opp ny revisjon av en tegning
  lastOppRevisjon: protectedProcedure
    .input(
      z.object({
        drawingId: z.string().uuid(),
        revision: z.string().max(10),
        fileUrl: z.string(),
        fileSize: z.number().int().optional(),
        description: z.string().optional(),
        uploadedById: z.string().uuid().optional(),
        status: tegningStatuser.optional(),
        issuedAt: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { drawingId, revision, fileUrl, fileSize, description, uploadedById, status, issuedAt } = input;

      // Hent gjeldende tegning
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({
        where: { id: drawingId },
      });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);

      // Lagre gjeldende versjon som revisjonshistorikk
      await ctx.prisma.drawingRevision.create({
        data: {
          drawingId,
          revision: tegning.revision,
          version: tegning.version,
          fileUrl: tegning.fileUrl,
          fileSize: tegning.fileSize,
          status: tegning.status,
          issuedAt: tegning.issuedAt,
          uploadedById,
        },
      });

      // Oppdater tegningen med ny revisjon
      return ctx.prisma.drawing.update({
        where: { id: drawingId },
        data: {
          revision,
          version: tegning.version + 1,
          fileUrl,
          fileSize: fileSize ?? null,
          status: status ?? tegning.status,
          issuedAt: issuedAt ?? null,
          description,
        },
      });
    }),

  // Hent revisjonshistorikk for en tegning
  hentRevisjoner: protectedProcedure
    .input(z.object({ drawingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id: input.drawingId }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return ctx.prisma.drawingRevision.findMany({
        where: { drawingId: input.drawingId },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Tilknytt eller fjern tegning fra bygning
  tilknyttBygning: protectedProcedure
    .input(
      z.object({
        drawingId: z.string().uuid(),
        buildingId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id: input.drawingId }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return ctx.prisma.drawing.update({
        where: { id: input.drawingId },
        data: { buildingId: input.buildingId },
      });
    }),

  // Sett georeferanse for en tegning
  settGeoReferanse: protectedProcedure
    .input(z.object({
      drawingId: z.string().uuid(),
      geoReference: geoReferanseSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id: input.drawingId }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return ctx.prisma.drawing.update({
        where: { id: input.drawingId },
        data: { geoReference: input.geoReference },
      });
    }),

  // Fjern georeferanse fra en tegning
  fjernGeoReferanse: protectedProcedure
    .input(z.object({ drawingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id: input.drawingId }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return ctx.prisma.drawing.update({
        where: { id: input.drawingId },
        data: { geoReference: Prisma.DbNull },
      });
    }),

  // Hent konverteringsstatus for DWG-tegning
  hentKonverteringsStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({
        where: { id: input.id },
        select: {
          id: true,
          projectId: true,
          conversionStatus: true,
          conversionError: true,
          coordinateSystem: true,
          fileUrl: true,
          fileType: true,
          geoReference: true,
        },
      });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return tegning;
    }),

  // Prøv DWG-konvertering på nytt
  provKonverteringIgjen: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({
        where: { id: input.id },
      });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);

      if (!tegning.originalFileUrl) {
        throw new Error("Denne tegningen har ingen original DWG-fil");
      }

      // Nullstill status
      await ctx.prisma.drawing.update({
        where: { id: input.id },
        data: { conversionStatus: "pending", conversionError: null },
      });

      // Start konvertering på nytt
      const dwgFilSti = join(UPLOADS_DIR, tegning.originalFileUrl.replace("/uploads/", ""));
      konverterDwg(dwgFilSti, tegning.name, UPLOADS_DIR)
        .then(async (resultat) => {
          const oppdatering: Record<string, unknown> = {
            conversionStatus: resultat.feil ? "failed" : "done",
            conversionError: resultat.feil,
          };
          if (resultat.koordinatSystem) oppdatering.coordinateSystem = resultat.koordinatSystem;
          if (resultat.geoReferanse) oppdatering.geoReference = resultat.geoReferanse;
          if (resultat.visningUrl) {
            oppdatering.fileUrl = resultat.visningUrl;
            oppdatering.fileType = resultat.visningFilType;
          }
          await ctx.prisma.drawing.update({ where: { id: input.id }, data: oppdatering });
          console.log(`[DWG] Re-konvertering fullført for tegning ${input.id}`);

          // Opprett layout-tegninger ved re-konvertering
          if (resultat.layouts.length > 0) {
            console.log(`[DWG] Oppretter ${resultat.layouts.length} layout-tegninger...`);
            for (const layout of resultat.layouts) {
              try {
                await ctx.prisma.drawing.create({
                  data: {
                    projectId: tegning.projectId,
                    buildingId: tegning.buildingId,
                    name: layout.navn,
                    fileUrl: layout.visningUrl,
                    fileType: layout.visningFilType,
                    originalFileUrl: tegning.originalFileUrl,
                    conversionStatus: "done",
                    coordinateSystem: resultat.koordinatSystem,
                    description: `Layout fra ${tegning.name} (fane ${layout.tabOrder})`,
                  },
                });
                console.log(`[DWG] Layout-tegning opprettet: "${layout.navn}"`);
              } catch (layoutErr) {
                console.error(`[DWG] Feil ved opprettelse av layout "${layout.navn}":`, layoutErr);
              }
            }
          }
        })
        .catch(async (err) => {
          console.error(`[DWG] Re-konvertering feilet for ${input.id}:`, err);
          await ctx.prisma.drawing.update({
            where: { id: input.id },
            data: { conversionStatus: "failed", conversionError: err instanceof Error ? err.message : "Ukjent feil" },
          });
        });

      return { status: "pending" };
    }),

  // Slett tegning
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id: input.id }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return ctx.prisma.drawing.delete({ where: { id: input.id } });
    }),
});
