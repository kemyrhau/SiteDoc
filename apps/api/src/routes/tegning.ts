import { z } from "zod";
import { Prisma } from "@sitedoc/db";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { router, protectedProcedure } from "../trpc/trpc";

const execFileAsync = promisify(execFile);
import {
  drawingDisciplineSchema,
  drawingTypeSchema,
  drawingStatusSchema,
  geoReferanseSchema,
} from "@sitedoc/shared";
import { verifiserProsjektmedlem } from "../trpc/tilgangskontroll";
import { konverterDwg } from "../services/dwgKonvertering";
import { trekUtIfcMetadata } from "../services/ifcMetadata";

// Absolutt sti til uploads — env-variabel for pålitelighet på tvers av web/api-prosesser
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");

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
        byggeplassId: z.string().uuid().optional(),
        floor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const { projectId, discipline, status, byggeplassId, floor } = input;
      return ctx.prisma.drawing.findMany({
        where: {
          projectId,
          ...(discipline ? { discipline } : {}),
          ...(status ? { status } : {}),
          ...(byggeplassId ? { byggeplassId } : {}),
          ...(floor ? { floor } : {}),
        },
        include: {
          byggeplass: { select: { id: true, name: true } },
          _count: { select: { revisions: true } },
        },
        orderBy: [{ discipline: "asc" }, { drawingNumber: "asc" }, { name: "asc" }],
      });
    }),

  // Hent tegninger for en byggeplass
  hentForByggeplass: protectedProcedure
    .input(z.object({ byggeplassId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const byggeplass = await ctx.prisma.byggeplass.findUniqueOrThrow({ where: { id: input.byggeplassId }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, byggeplass.projectId);
      return ctx.prisma.drawing.findMany({
        where: { byggeplassId: input.byggeplassId },
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
          byggeplass: true,
          project: { select: { id: true, name: true } },
          revisions: {
            orderBy: { createdAt: "desc" },
            include: { uploadedBy: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);

      return tegning;
    }),

  // Opprett ny tegning
  opprett: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        byggeplassId: z.string().uuid().optional(),
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
      const erPdf = input.fileType.toLowerCase() === "pdf";

      const tegning = await ctx.prisma.drawing.create({
        data: {
          ...input,
          ...((erDwg || erPdf) ? {
            originalFileUrl: input.fileUrl,
            conversionStatus: erDwg ? "pending" : "converting",
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
                      byggeplassId: input.byggeplassId,
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

      // Konverter PDF til PNG for presis visning (markører, GPS, georeferering)
      if (erPdf) {
        const pdfFilSti = join(UPLOADS_DIR, input.fileUrl.replace("/uploads/", ""));
        const pngFilnavn = `${randomUUID()}.png`;
        const pngUtSti = join(UPLOADS_DIR, pngFilnavn.replace(".png", ""));

        (async () => {
          try {
            console.log(`[PDF] Starter konvertering: ${input.name} → PNG (200 DPI)...`);
            const start = Date.now();
            await execFileAsync("pdftoppm", [
              "-png", "-r", "200", "-singlefile",
              pdfFilSti, pngUtSti,
            ], { timeout: 30000 });
            const ms = Date.now() - start;
            console.log(`[PDF] Konvertering fullført på ${ms}ms: ${pngFilnavn}`);

            await ctx.prisma.drawing.update({
              where: { id: tegning.id },
              data: {
                fileUrl: `/uploads/${pngFilnavn}`,
                fileType: "png",
                conversionStatus: "done",
              },
            });
            console.log(`[PDF] Database oppdatert: tegning ${tegning.id} → PNG`);
          } catch (err) {
            const melding = err instanceof Error ? err.message : "Ukjent feil";
            console.error(`[PDF] Konvertering FEILET for tegning ${tegning.id}: ${melding}`);
            await ctx.prisma.drawing.update({
              where: { id: tegning.id },
              data: {
                conversionStatus: "failed",
                conversionError: `PDF→PNG feilet: ${melding}`,
              },
            });
          }
        })();
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
        byggeplassId: z.string().uuid().nullable().optional(),
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

  // Tilknytt eller fjern tegning fra byggeplass
  tilknyttByggeplass: protectedProcedure
    .input(
      z.object({
        drawingId: z.string().uuid(),
        byggeplassId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id: input.drawingId }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return ctx.prisma.drawing.update({
        where: { id: input.drawingId },
        data: { byggeplassId: input.byggeplassId },
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

  // Sett GPS-override for IFC-modell (kalibrering med valgfri rotasjon)
  settGpsOverride: protectedProcedure
    .input(z.object({
      drawingId: z.string().uuid(),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      rotasjon: z.number().optional(),
      skala: z.number().optional(),
      // Direkte similarity-transform: tegning(%) → 3D(xz). Koeffisienter a,b,tx,tz
      transform: z.object({
        a: z.number(), b: z.number(), tx: z.number(), tz: z.number(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id: input.drawingId }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      const gpsData: Record<string, unknown> = { lat: input.lat, lng: input.lng };
      if (input.rotasjon !== undefined) gpsData.rotasjon = input.rotasjon;
      if (input.skala !== undefined) gpsData.skala = input.skala;
      if (input.transform) gpsData.transform = input.transform;
      return ctx.prisma.drawing.update({
        where: { id: input.drawingId },
        data: { gpsOverride: gpsData as Prisma.InputJsonValue },
      });
    }),

  // Fjern GPS-override (tilbake til IFC-metadata GPS)
  fjernGpsOverride: protectedProcedure
    .input(z.object({ drawingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id: input.drawingId }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return ctx.prisma.drawing.update({
        where: { id: input.drawingId },
        data: { gpsOverride: Prisma.DbNull },
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
                    byggeplassId: tegning.byggeplassId,
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

  // Batch re-konverter PDF-tegninger som mangler konvertering
  rekonverterPdf: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Kun sitedoc_admin eller prosjektadmin
      const bruker = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true } });
      if (bruker?.role !== "sitedoc_admin") {
        const medlem = await ctx.prisma.projectMember.findUnique({
          where: { userId_projectId: { userId: ctx.userId, projectId: input.projectId } },
        });
        if (medlem?.role !== "admin") {
          return { startet: 0, melding: "Kun admin kan starte re-konvertering" };
        }
      }

      // Finn PDF-tegninger uten konvertering (eller feilet)
      const pdfTegninger = await ctx.prisma.drawing.findMany({
        where: {
          projectId: input.projectId,
          fileType: "pdf",
          OR: [
            { conversionStatus: null },
            { conversionStatus: "failed" },
          ],
        },
        select: { id: true, fileUrl: true, name: true },
      });

      if (pdfTegninger.length === 0) {
        return { startet: 0, melding: "Ingen PDF-tegninger å konvertere" };
      }

      // Sett alle til "converting" og start asynkront
      for (const tegning of pdfTegninger) {
        await ctx.prisma.drawing.update({
          where: { id: tegning.id },
          data: { conversionStatus: "converting" },
        });

        const pdfFilSti = join(UPLOADS_DIR, tegning.fileUrl.replace("/uploads/", ""));
        const pngFilnavn = `${randomUUID()}.png`;
        const pngUtSti = join(UPLOADS_DIR, pngFilnavn.replace(".png", ""));

        // Fire-and-forget — konverter hver tegning asynkront
        (async () => {
          try {
            console.log(`[PDF-batch] Konverterer: ${tegning.name} (${tegning.id})...`);
            await execFileAsync("pdftoppm", [
              "-png", "-r", "200", "-singlefile",
              pdfFilSti, pngUtSti,
            ], { timeout: 60000 });

            await ctx.prisma.drawing.update({
              where: { id: tegning.id },
              data: {
                fileUrl: `/uploads/${pngFilnavn}`,
                fileType: "png",
                conversionStatus: "done",
              },
            });
            console.log(`[PDF-batch] Ferdig: ${tegning.name}`);
          } catch (err) {
            const melding = err instanceof Error ? err.message : "Ukjent feil";
            console.error(`[PDF-batch] Feilet: ${tegning.name}: ${melding}`);
            await ctx.prisma.drawing.update({
              where: { id: tegning.id },
              data: {
                conversionStatus: "failed",
                conversionError: `PDF→PNG batch-feil: ${melding}`,
              },
            });
          }
        })();
      }

      return { startet: pdfTegninger.length, melding: `Startet konvertering av ${pdfTegninger.length} PDF-tegning(er)` };
    }),
});
