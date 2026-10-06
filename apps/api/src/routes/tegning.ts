import { z } from "zod";
import { Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";
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
  utledMmPrPiksel,
  finnMalestokkFraTekst,
} from "@sitedoc/shared";
import { verifiserProsjektmedlem, verifiserProsjektIkkeFrosset, verifiserAdmin } from "../trpc/tilgangskontroll";
import { konverterDwg } from "../services/dwgKonvertering";
import { oppdaterByggeplassGeofence } from "../services/byggeplassGeofence";
import { byggeplassFilterDirekte } from "../services/byggeplassFilter";
import { trekUtIfcMetadata } from "../services/ifcMetadata";
/** Hent bildedimensjoner fra fil (PNG/SVG/JPG) via sharp (dynamisk import) */
async function hentBildeDimensjoner(filsti: string): Promise<{ width: number; height: number } | null> {
  try {
    const { default: sharp } = await import("sharp");
    const meta = await sharp(filsti).metadata();
    if (meta.width && meta.height) return { width: meta.width, height: meta.height };
    return null;
  } catch { return null; }
}

/** Papirbredde (mm) fra pdfinfo ("Page size: W x H pts"). Null hvis ukjent. */
async function hentPapirbreddeMm(pdfFilSti: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("pdfinfo", [pdfFilSti], { timeout: 15000 });
    const breddeRaw = stdout.match(/Page size:\s*([\d.]+)\s*x\s*[\d.]+\s*pts/i)?.[1];
    if (breddeRaw === undefined) return null;
    const breddePts = parseFloat(breddeRaw);
    if (!Number.isFinite(breddePts) || breddePts <= 0) return null;
    return (breddePts * 25.4) / 72; // pts → mm
  } catch {
    return null;
  }
}

/** Målestokk-forslag fra tittelfeltet (pdftotext side 1). Null hvis ikke funnet. */
async function hentMalestokkForslag(pdfFilSti: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-f", "1", "-l", "1", pdfFilSti, "-"], { timeout: 15000 });
    return finnMalestokkFraTekst(stdout);
  } catch {
    return null;
  }
}

/**
 * Målemetadata etter PDF→PNG-konvertering: mm/piksel (papirbredde ÷ pikselbredde)
 * og et målestokk-forslag fra tittelfeltet. Utledningen er selvvaliderende —
 * endres DPI-flagget over, følger både papirbredde og pikselbredde med, så
 * mm/piksel holder. pdfinfo/pdftotext følger med poppler-utils (samme pakke som
 * pdftoppm), så ingen ny avhengighet. Feiler ett steg, blir feltet NULL — aldri
 * en gjettet verdi.
 */
async function utledMaalemetadata(pdfFilSti: string, pngFilnavn: string): Promise<{
  dim: { width: number; height: number } | null;
  mmPrPiksel: number | null;
  scaleForslag: string | null;
}> {
  const dim = await hentBildeDimensjoner(join(UPLOADS_DIR, pngFilnavn));
  const papirBreddeMm = await hentPapirbreddeMm(pdfFilSti);
  const mmPrPiksel = papirBreddeMm && dim?.width ? utledMmPrPiksel(papirBreddeMm, dim.width) : null;
  const scaleForslag = await hentMalestokkForslag(pdfFilSti);
  return { dim, mmPrPiksel, scaleForslag };
}

// Absolutt sti til uploads — env-variabel for pålitelighet på tvers av web/api-prosesser
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");

const fagdisipliner = drawingDisciplineSchema;
const tegningstyper = drawingTypeSchema;
const tegningStatuser = drawingStatusSchema;

// Entall/flertall for slettevakt-meldingen (mikrotekst-standard: oppgi tallet + neste steg,
// ikke bare «kan ikke slettes» — en nektelse uten tall sender brukeren på leting).
function tall(n: number, entall: string, flertall: string): string {
  return `${n} ${n === 1 ? entall : flertall}`;
}

// Slettevakt-melding for tegning: navngir HVER referansevei som er > 0. Speiler omrade.ts:23.
// Referansene til en tegning er BÅDE harde FK-er (drawing_id/tegning_id, alle SetNull → ville
// gitt dinglende markør) OG en myk JSON-referanse: rapportobjektet TegningPosisjon lagrer
// `drawingId` i Checklist.data/Task.data (shared TegningPosisjonVerdi) uten FK.
function byggTegningSlettevaktMelding(t: {
  oppgaver: number;
  sjekklister: number;
  kontrollpunkter: number;
  omrader: number;
}): string {
  const deler: string[] = [];
  if (t.oppgaver > 0) deler.push(tall(t.oppgaver, "oppgave", "oppgaver"));
  if (t.sjekklister > 0) deler.push(tall(t.sjekklister, "sjekkliste", "sjekklister"));
  if (t.kontrollpunkter > 0) deler.push(tall(t.kontrollpunkter, "kontrollplanpunkt", "kontrollplanpunkter"));
  if (t.omrader > 0) deler.push(tall(t.omrader, "område", "områder"));
  return `Tegningen brukes av ${deler.join(", ")} og kan ikke slettes. Flytt markørene til en annen tegning, eller fjern det som bruker den, først.`;
}

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
          // Byggeplass-tilhørighet (mykt), regel i byggeplassFilter.ts. Byggeplass-løse
          // tegninger merkes «Hele prosjektet» i lista (klient).
          ...(byggeplassFilterDirekte(byggeplassId) ?? {}),
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

      // Hent bildedimensjoner for bildetype-filer (PNG, JPG, SVG)
      let imageWidth: number | undefined;
      let imageHeight: number | undefined;
      if (!erDwg && !erIfc && !erPdf) {
        const dim = await hentBildeDimensjoner(join(UPLOADS_DIR, input.fileUrl.replace("/uploads/", "")));
        if (dim) { imageWidth = dim.width; imageHeight = dim.height; }
      }

      const tegning = await ctx.prisma.drawing.create({
        data: {
          ...input,
          imageWidth,
          imageHeight,
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
              // Hent dimensjoner fra konvertert fil
              const dim = await hentBildeDimensjoner(join(UPLOADS_DIR, resultat.visningUrl.replace("/uploads/", "")));
              if (dim) { oppdatering.imageWidth = dim.width; oppdatering.imageHeight = dim.height; }
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

            // Dimensjoner + målemetadata (mm/piksel, målestokk-forslag) fra konvertert PNG
            const { dim, mmPrPiksel, scaleForslag } = await utledMaalemetadata(pdfFilSti, pngFilnavn);
            // Forhåndsutfyll målestokk KUN når brukeren ikke selv oppga én (aldri overskriv).
            // Forslaget er «tittelfelt» og ubekreftet — verktøyet er avslått til et menneske bekrefter.
            const settForslag = !input.scale && scaleForslag
              ? { scale: scaleForslag, scaleKilde: "tittelfelt" as const }
              : {};

            await ctx.prisma.drawing.update({
              where: { id: tegning.id },
              data: {
                fileUrl: `/uploads/${pngFilnavn}`,
                fileType: "png",
                imageWidth: dim?.width ?? null,
                imageHeight: dim?.height ?? null,
                mmPrPiksel,
                ...settForslag,
                conversionStatus: "done",
              },
            });
            console.log(`[PDF] Database oppdatert: tegning ${tegning.id} → PNG (mm/px=${mmPrPiksel ?? "null"}, målestokk-forslag=${scaleForslag ?? "ingen"})`);
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
        // Kilde til `scale` — settes når et menneske bekrefter/kalibrerer målestokken.
        // Måleverktøyet er avslått til kilden er menneske-bekreftet eller georeferanse.
        scaleKilde: z.enum(["tittelfelt", "manuell", "kalibrert", "georeferanse"]).optional(),
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
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id: input.drawingId }, select: { projectId: true, byggeplassId: true } });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      const oppdatert = await ctx.prisma.drawing.update({
        where: { id: input.drawingId },
        data: { geoReference: input.geoReference },
      });
      // Fase 1c: auto-fyll byggeplass-geofence fra denne tegningen — kun hvis
      // geofencen er tom (klobrer aldri en satt/manuell verdi). Feiler aldri
      // georeferering-kallet.
      if (tegning.byggeplassId) {
        try {
          await oppdaterByggeplassGeofence(tegning.byggeplassId, true);
        } catch {
          /* geofence-avledning er best-effort */
        }
      }
      return oppdatert;
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

  // Slett tegning. ADMIN-gatet + SLETTEVAKT (speiler omrade.slett): alle referanse-FK-ene er
  // SetNull (schema: tasks/checklists/kontrollplan_punkter.drawing_id, omrader.tegning_id) →
  // en usett sletting ville etterlatt markører som peker på en tegning som ikke finnes. Teller
  // distinkt per entitet (FK ELLER myk JSON-referanse i samme tabell), blokkerer hvis > 0 og sier
  // hva som blokkerer og hvor mange. Foreldreløse DISKFILER aksepteres i denne runden (egen
  // BACKLOG-sak, ref. gdpr-kartlegging) — det er dinglende markører vakten stopper, ikke disk-GC.
  slett: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id: input.id }, select: { projectId: true } });
      await verifiserAdmin(ctx.userId, tegning.projectId);

      const mykMonster = `%"${input.id}"%`;
      const rader = await ctx.prisma.$queryRaw<
        { oppgaver: bigint; sjekklister: bigint; kontrollpunkter: bigint; omrader: bigint }[]
      >`
        SELECT
          (SELECT count(*) FROM tasks WHERE drawing_id = ${input.id} OR data::text LIKE ${mykMonster}) AS oppgaver,
          (SELECT count(*) FROM checklists WHERE drawing_id = ${input.id} OR data::text LIKE ${mykMonster}) AS sjekklister,
          (SELECT count(*) FROM kontrollplan_punkter WHERE drawing_id = ${input.id}) AS kontrollpunkter,
          (SELECT count(*) FROM omrader WHERE tegning_id = ${input.id}) AS omrader
      `;
      const bruk = {
        oppgaver: Number(rader[0]?.oppgaver ?? 0),
        sjekklister: Number(rader[0]?.sjekklister ?? 0),
        kontrollpunkter: Number(rader[0]?.kontrollpunkter ?? 0),
        omrader: Number(rader[0]?.omrader ?? 0),
      };
      if (bruk.oppgaver + bruk.sjekklister + bruk.kontrollpunkter + bruk.omrader > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: byggTegningSlettevaktMelding(bruk) });
      }
      return ctx.prisma.drawing.delete({ where: { id: input.id } });
    }),

  // Batch re-konverter PDF-tegninger som mangler konvertering
  rekonverterPdf: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // FL: re-konvertering er en skrivehandling — sperret på et avsluttet prosjekt
      // (går ikke via en prosjekt-port; inline-admin-sjekk under).
      await verifiserProsjektIkkeFrosset(ctx.userId, input.projectId);
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
        select: { id: true, fileUrl: true, name: true, scale: true },
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

            // Dimensjoner + målemetadata — som inline-veien. utledMaalemetadata
            // svelger feil og gir null-felt, så en manglende avlesning ruller
            // ikke tilbake en vellykket konvertering.
            const { dim, mmPrPiksel, scaleForslag } = await utledMaalemetadata(pdfFilSti, pngFilnavn);
            // Forhåndsutfyll KUN når tegningen ikke alt har en målestokk (aldri overskriv brukerens).
            const settForslag = !tegning.scale && scaleForslag
              ? { scale: scaleForslag, scaleKilde: "tittelfelt" as const }
              : {};

            await ctx.prisma.drawing.update({
              where: { id: tegning.id },
              data: {
                fileUrl: `/uploads/${pngFilnavn}`,
                fileType: "png",
                imageWidth: dim?.width ?? null,
                imageHeight: dim?.height ?? null,
                mmPrPiksel,
                ...settForslag,
                conversionStatus: "done",
              },
            });
            console.log(`[PDF-batch] Ferdig: ${tegning.name} (mm/px=${mmPrPiksel ?? "null"}, målestokk-forslag=${scaleForslag ?? "ingen"})`);
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

  // Backfill: hent bildedimensjoner for tegninger som mangler imageWidth/imageHeight
  backfillDimensjoner: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektmedlem(ctx.userId, input.projectId);
      const tegninger = await ctx.prisma.drawing.findMany({
        where: {
          projectId: input.projectId,
          imageWidth: null,
          fileType: { in: ["png", "jpg", "jpeg", "svg"] },
        },
        select: { id: true, fileUrl: true, name: true },
      });

      let oppdatert = 0;
      for (const t of tegninger) {
        const filsti = join(UPLOADS_DIR, t.fileUrl.replace("/uploads/", ""));
        const dim = await hentBildeDimensjoner(filsti);
        if (dim) {
          await ctx.prisma.drawing.update({
            where: { id: t.id },
            data: { imageWidth: dim.width, imageHeight: dim.height },
          });
          oppdatert++;
          console.log(`[Backfill] ${t.name}: ${dim.width}x${dim.height}`);
        }
      }
      return { oppdatert, totalt: tegninger.length };
    }),

  // Crop screenshot-bilde rundt en posisjon for detalj-utsnitt i PDF
  cropScreenshot: protectedProcedure
    .input(z.object({
      imageBase64: z.string(),
      positionX: z.number().min(0).max(100),
      positionY: z.number().min(0).max(100),
      zoomFaktor: z.number().min(1).max(10).default(4),
    }))
    .mutation(async ({ input }) => {
      const { imageBase64, positionX, positionY, zoomFaktor } = input;

      // Fjern data:image/png;base64, prefix
      const ren64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(ren64, "base64");

      const { default: sharpLib } = await import("sharp");
      const meta = await sharpLib(buffer).metadata();
      const w = meta.width ?? 800;
      const h = meta.height ?? 600;

      console.log(`[cropScreenshot] Input: positionX=${positionX}, positionY=${positionY}, zoomFaktor=${zoomFaktor}`);
      console.log(`[cropScreenshot] Bilde: ${w}x${h} (${meta.format})`);

      // Beregn crop-rektangel sentrert rundt posisjon
      const cropW = Math.round(w / zoomFaktor);
      const cropH = Math.round(h / zoomFaktor);
      const cx = Math.round(positionX / 100 * w);
      const cy = Math.round(positionY / 100 * h);
      const left = Math.max(0, Math.min(w - cropW, cx - Math.round(cropW / 2)));
      const top = Math.max(0, Math.min(h - cropH, cy - Math.round(cropH / 2)));

      console.log(`[cropScreenshot] Senter: cx=${cx}px, cy=${cy}px`);
      console.log(`[cropScreenshot] Crop: left=${left}, top=${top}, width=${cropW}, height=${cropH}`);

      const cropBuffer = await sharpLib(buffer)
        .extract({ left, top, width: cropW, height: cropH })
        .png()
        .toBuffer();

      return { croppedBase64: `data:image/png;base64,${cropBuffer.toString("base64")}` };
    }),
});
