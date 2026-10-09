import { z } from "zod";
import { Prisma, type PrismaClient } from "@sitedoc/db";
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
  utledScaleKildeVedLagring,
  finnMalestokkFraTekst,
  finnTegningsnummer,
  finnTegningstype,
} from "@sitedoc/shared";
import { verifiserProsjektmedlem, verifiserProsjektIkkeFrosset, verifiserAdmin } from "../trpc/tilgangskontroll";
import { konverterDwg, hentKonverteringKapasitet, roterProsentMarkor, type DwgKonverteringsResultat } from "../services/dwgKonvertering";
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

/** PDF-`Title` fra pdfinfo (dokumentmetadata). Null hvis tom/ukjent. R3-kilde (b). */
async function hentPdfTitle(pdfFilSti: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("pdfinfo", [pdfFilSti], { timeout: 15000 });
    const title = stdout.match(/^Title:\s*(.+)$/im)?.[1]?.trim();
    return title && title.length > 0 ? title : null;
  } catch {
    return null;
  }
}

/** Rå tittelfelt-tekst (pdftotext side 1). Null ved feil. R3-kilde (c). */
async function hentTittelfeltTekst(pdfFilSti: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-f", "1", "-l", "1", pdfFilSti, "-"], { timeout: 15000 });
    return stdout || null;
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

/**
 * Er en tegning referert av en markør (oppgave/sjekkliste/kontrollpunkt/område)?
 * Samme referanseveier som slettevakten (FK + myk JSON-referanse i Checklist/Task.data).
 * Avgjør om en forsvunnet DWG-layout kan slettes (Q3: slett uten markør, ellers "stale").
 */
async function tegningHarMarkorer(prisma: PrismaClient, drawingId: string): Promise<boolean> {
  const mykMonster = `%"${drawingId}"%`;
  const rader = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT (
      (SELECT count(*) FROM tasks WHERE drawing_id = ${drawingId} OR data::text LIKE ${mykMonster}) +
      (SELECT count(*) FROM checklists WHERE drawing_id = ${drawingId} OR data::text LIKE ${mykMonster}) +
      (SELECT count(*) FROM kontrollplan_punkter WHERE drawing_id = ${drawingId}) +
      (SELECT count(*) FROM omrader WHERE tegning_id = ${drawingId})
    ) AS n`;
  return Number(rader[0]?.n ?? 0) > 0;
}

/**
 * ÉN felles skriver for et fullført DWG/DXF-konverteringsresultat (D5/D6) — delt av
 * `startTegningKonvertering` (opprett/revisjon) og `provKonverteringIgjen`, så de to
 * kopiene ikke kan drifte fra hverandre.
 *
 *  1. Oppdaterer hovedtegningen: status, koordinatsystem, georeferanse, visnings-URL,
 *     bilde-dimensjoner og måling (`mmPrPiksel`/`scale`/`scaleKilde` rett fra tegningens
 *     enheter — D5). `scaleKilde = null` (ukjent enhet) → måling låst til kalibrering.
 *  2. Layouts (D6): ERSTATTER på `(parentDrawingId, layoutNavn)` — oppdaterer eksisterende
 *     layout-rad eller lager ny, aldri duplikat ved revisjon/«prøv igjen».
 *  3. Forsvunne layouts (fantes før, ikke i ny fil): slettes uten markør, ellers merkes
 *     `conversionStatus = "stale"` (Kenneth Q3).
 */
/**
 * RETUR 3 §2 — flytt eksisterende markører/områder (lagret i prosent) med `delta` graders
 * rotasjon om bildesenteret (50,50) når en re-konvertering endrer den inn-bakte auto-rotasjonen.
 * Uten dette ville markørene blitt liggende på gammel pikselposisjon og pekt feil mot den nye,
 * roterte SVG-en. Manuell «Roter» håndteres IKKE her — den er en CSS-rotasjon av hele wrapperen
 * (markører + SVG roterer sammen), så prosentposisjonene skal da stå urørt.
 */
async function roterMarkorerVedRotasjonsendring(
  tx: Prisma.TransactionClient,
  drawingId: string,
  delta: number,
): Promise<void> {
  if (!delta) return;

  const oppgaver = await tx.task.findMany({
    where: { drawingId, positionX: { not: null }, positionY: { not: null } },
    select: { id: true, positionX: true, positionY: true },
  });
  for (const o of oppgaver) {
    const p = roterProsentMarkor({ x: o.positionX!, y: o.positionY! }, delta);
    await tx.task.update({ where: { id: o.id }, data: { positionX: p.x, positionY: p.y } });
  }

  const sjekklister = await tx.checklist.findMany({
    where: { drawingId, positionX: { not: null }, positionY: { not: null } },
    select: { id: true, positionX: true, positionY: true },
  });
  for (const s of sjekklister) {
    const p = roterProsentMarkor({ x: s.positionX!, y: s.positionY! }, delta);
    await tx.checklist.update({ where: { id: s.id }, data: { positionX: p.x, positionY: p.y } });
  }

  const punkter = await tx.kontrollplanPunkt.findMany({
    where: { drawingId, positionX: { not: null }, positionY: { not: null } },
    select: { id: true, positionX: true, positionY: true },
  });
  for (const k of punkter) {
    const p = roterProsentMarkor({ x: k.positionX!, y: k.positionY! }, delta);
    await tx.kontrollplanPunkt.update({ where: { id: k.id }, data: { positionX: p.x, positionY: p.y } });
  }

  const omrader = await tx.omrade.findMany({
    where: { tegningId: drawingId },
    select: { id: true, polygon: true },
  });
  for (const om of omrader) {
    const poly = Array.isArray(om.polygon) ? (om.polygon as { x: number; y: number }[]) : [];
    if (!poly.length) continue;
    const ny = poly.map((v) => roterProsentMarkor({ x: v.x, y: v.y }, delta));
    await tx.omrade.update({ where: { id: om.id }, data: { polygon: ny as unknown as Prisma.InputJsonValue } });
  }
  console.log(`[DWG] Rotasjon endret ${delta.toFixed(1)}° → flyttet ${oppgaver.length} oppgave-, ${sjekklister.length} sjekkliste-, ${punkter.length} kontrollpunkt-markører og ${omrader.length} område(r)`);
}

async function anvendDwgResultat(
  prisma: PrismaClient,
  tegning: { id: string; name: string; projectId: string; byggeplassId: string | null },
  resultat: DwgKonverteringsResultat,
  originalFileUrl: string,
): Promise<void> {
  const oppdatering: Record<string, unknown> = {
    conversionStatus: resultat.feil ? "failed" : "done",
    conversionError: resultat.feil,
  };
  if (resultat.koordinatSystem) oppdatering.coordinateSystem = resultat.koordinatSystem;
  if (resultat.geoReferanse) oppdatering.geoReference = resultat.geoReferanse;
  if (resultat.visningUrl) {
    oppdatering.fileUrl = resultat.visningUrl;
    oppdatering.fileType = resultat.visningFilType;
    oppdatering.imageWidth = resultat.imageWidth;
    oppdatering.imageHeight = resultat.imageHeight;
    // D5: måling rett fra tegningens enheter. Enhetsutledningen er fasiten for en ny
    // fil — en kalibrering gjaldt den forrige fila og skal ikke bæres over automatisk.
    oppdatering.mmPrPiksel = resultat.mmPrPiksel;
    oppdatering.scale = resultat.scale;
    oppdatering.scaleKilde = resultat.scaleKilde;
    // RETUR 2: auto-rotasjon bakt inn i SVG-en + startutsnitt. Ny fil → nullstill en
    // tidligere brukeroverstyring (den gjaldt forrige fil, som enhetene/kalibreringen).
    oppdatering.autoRotasjon = resultat.autoRotasjon;
    oppdatering.rotasjonOverstyrt = null;
    oppdatering.startutsnitt = resultat.startutsnitt ?? Prisma.JsonNull;
    // RETUR 4 (fullstendighet): lagre parset-vs-tegnet-rapporten så manglende typer
    // synes på test uten å lese kode.
    oppdatering.konverteringRapport = resultat.rapport
      ? (resultat.rapport as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;
  }

  // RETUR 3 §2: endres den inn-bakte auto-rotasjonen ved denne (re-)konverteringen, må
  // eksisterende markører/områder flyttes med samme rotasjon — i SAMME transaksjon som
  // tegnings-oppdateringen, så de aldri blir stående feil mellom to skrivinger. Første
  // opplasting har ingen markører → no-op; georefererte tegninger får rotasjon 0 (§1) → delta 0.
  const forrige = await prisma.drawing.findUnique({
    where: { id: tegning.id },
    select: { autoRotasjon: true },
  });
  const rotDelta = resultat.visningUrl
    ? (resultat.autoRotasjon ?? 0) - (forrige?.autoRotasjon ?? 0)
    : 0;
  await prisma.$transaction(async (tx) => {
    await tx.drawing.update({ where: { id: tegning.id }, data: oppdatering });
    await roterMarkorerVedRotasjonsendring(tx, tegning.id, rotDelta);
  });
  console.log(`[DWG] Konvertering fullført for tegning ${tegning.id}`);

  // En FEILET konvertering skal ALDRI røre eksisterende layouts — ellers ville en
  // transient feil (tom resultat.layouts) slettet/stale-et alle eksisterende layouts.
  if (resultat.feil) return;

  // D6: erstatt layout-rader på (parentDrawingId, layoutNavn)
  const eksisterende = await prisma.drawing.findMany({
    where: { parentDrawingId: tegning.id },
    select: { id: true, layoutNavn: true },
  });
  const nyeNavn = new Set(resultat.layouts.map((l) => l.navn));

  for (const layout of resultat.layouts) {
    const felles = {
      name: layout.navn,
      fileUrl: layout.visningUrl,
      fileType: layout.visningFilType,
      conversionStatus: "done",
      conversionError: null,
      coordinateSystem: resultat.koordinatSystem,
      imageWidth: layout.imageWidth,
      imageHeight: layout.imageHeight,
      mmPrPiksel: layout.mmPrPiksel,
      scale: layout.scale,
      scaleKilde: layout.scaleKilde,
    };
    const treff = eksisterende.find((e) => e.layoutNavn === layout.navn);
    if (treff) {
      await prisma.drawing.update({ where: { id: treff.id }, data: felles });
    } else {
      await prisma.drawing.create({
        data: {
          ...felles,
          projectId: tegning.projectId,
          byggeplassId: tegning.byggeplassId,
          originalFileUrl,
          parentDrawingId: tegning.id,
          layoutNavn: layout.navn,
          description: `Layout fra ${tegning.name} (fane ${layout.tabOrder})`,
        },
      });
    }
    console.log(`[DWG] Layout "${layout.navn}" skrevet (erstatt-på-navn)`);
  }

  // Forsvunne layouts: slett uten markør, ellers "stale" (Q3)
  for (const e of eksisterende) {
    if (e.layoutNavn && nyeNavn.has(e.layoutNavn)) continue;
    if (await tegningHarMarkorer(prisma, e.id)) {
      await prisma.drawing.update({ where: { id: e.id }, data: { conversionStatus: "stale" } });
      console.log(`[DWG] Layout ${e.id} forsvant men har markører → stale`);
    } else {
      await prisma.drawing.delete({ where: { id: e.id } });
      console.log(`[DWG] Layout ${e.id} forsvant uten markører → slettet`);
    }
  }
}

/**
 * Start bakgrunns-konvertering for en PERSISTERT tegning (fire-and-forget).
 *
 * Felles vei for `opprett` (R2) og `lastOppRevisjon` (R8) — én kilde for PDF→PNG,
 * DWG→SVG (+ layouts) og IFC-metadata, så ny revisjon aldri viser gammel PNG.
 * Kalleren har ALLEREDE satt synkron initial-tilstand (`conversionStatus`,
 * `originalFileUrl`, `fileType`, bilde-dimensjoner for bildetyper); denne gjør kun
 * det asynkrone tunge arbeidet og den endelige `update`-en når konverteringen er
 * ferdig. Feiler et steg → `conversionStatus = failed`, aldri en gjettet verdi.
 *
 * `brukerScale`: en allerede satt/bekreftet målestokk (brukerinput ved opplasting,
 * eller eksisterende `scale` ved revisjon). Er den satt, overskrives den ALDRI av
 * tittelfelt-forslaget (samme regel som før: forslag kun i tomt felt).
 */
function startTegningKonvertering(
  prisma: PrismaClient,
  tegning: { id: string; name: string; projectId: string; byggeplassId: string | null },
  fil: { fileUrl: string; fileType: string; brukerScale?: string | null },
): void {
  const filType = fil.fileType.toLowerCase();
  const erDwgEllerDxf = filType === "dwg" || filType === "dxf";
  const erIfc = filType === "ifc";
  const erPdf = filType === "pdf";

  // Start asynkron DWG/DXF-konvertering i bakgrunnen (D4: DXF går samme vei, uten dwg2dxf)
  if (erDwgEllerDxf) {
    const filSti = join(UPLOADS_DIR, fil.fileUrl.replace("/uploads/", ""));
    konverterDwg(filSti, tegning.name, UPLOADS_DIR, filType)
      .then((resultat) => anvendDwgResultat(prisma, tegning, resultat, fil.fileUrl))
      .catch(async (err) => {
        console.error(`[DWG] Konvertering feilet for tegning ${tegning.id}:`, err);
        await prisma.drawing.update({
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
    const ifcFilSti = join(UPLOADS_DIR, fil.fileUrl.replace("/uploads/", ""));
    trekUtIfcMetadata(ifcFilSti, tegning.name)
      .then(async (meta) => {
        const oppdatering: Record<string, unknown> = {
          ifcMetadata: meta,
        };
        // Sett fag/opphav kun hvis ikke allerede angitt på raden (leser persistert
        // tilstand i stedet for `input` — likeverdig for opprett, korrekt for revisjon).
        const naa = await prisma.drawing.findUnique({ where: { id: tegning.id }, select: { discipline: true, originator: true } });
        if (meta.fagdisiplin && !naa?.discipline) oppdatering.discipline = meta.fagdisiplin;
        if (meta.organisasjon && !naa?.originator) oppdatering.originator = meta.organisasjon;
        console.log(`[IFC] Metadata uttrukket for tegning ${tegning.id}: ${meta.prosjektnavn ?? "ukjent prosjekt"}`);
        await prisma.drawing.update({
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
    const pdfFilSti = join(UPLOADS_DIR, fil.fileUrl.replace("/uploads/", ""));
    const pngFilnavn = `${randomUUID()}.png`;
    const pngUtSti = join(UPLOADS_DIR, pngFilnavn.replace(".png", ""));

    (async () => {
      try {
        console.log(`[PDF] Starter konvertering: ${tegning.name} → PNG (200 DPI)...`);
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
        const settForslag = !fil.brukerScale && scaleForslag
          ? { scale: scaleForslag, scaleKilde: "tittelfelt" as const }
          : {};

        await prisma.drawing.update({
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
        await prisma.drawing.update({
          where: { id: tegning.id },
          data: {
            conversionStatus: "failed",
            conversionError: `PDF→PNG feilet: ${melding}`,
          },
        });
      }
    })();
  }
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
      const erDxf = input.fileType.toLowerCase() === "dxf";
      const erIfc = input.fileType.toLowerCase() === "ifc";
      const erPdf = input.fileType.toLowerCase() === "pdf";

      // Hent bildedimensjoner for bildetype-filer (PNG, JPG, SVG)
      let imageWidth: number | undefined;
      let imageHeight: number | undefined;
      if (!erDwg && !erDxf && !erIfc && !erPdf) {
        const dim = await hentBildeDimensjoner(join(UPLOADS_DIR, input.fileUrl.replace("/uploads/", "")));
        if (dim) { imageWidth = dim.width; imageHeight = dim.height; }
      }

      const tegning = await ctx.prisma.drawing.create({
        data: {
          ...input,
          imageWidth,
          imageHeight,
          // D4: DXF konverteres som DWG (pending → bakgrunns-SVG). PDF → converting.
          ...((erDwg || erDxf || erPdf) ? {
            originalFileUrl: input.fileUrl,
            conversionStatus: (erDwg || erDxf) ? "pending" : "converting",
          } : {}),
        },
      });

      // R2/R8: felles konverteringsvei (PDF→PNG, DWG→SVG+layouts, IFC-metadata).
      // Initial-tilstand (conversionStatus/originalFileUrl/bilde-dim) er satt synkront
      // i create over; helperen gjør det asynkrone arbeidet.
      startTegningKonvertering(
        ctx.prisma,
        { id: tegning.id, name: tegning.name, projectId: tegning.projectId, byggeplassId: tegning.byggeplassId },
        { fileUrl: input.fileUrl, fileType: input.fileType, brukerScale: input.scale },
      );

      // R3: forhåndsutfyllings-forslag (tegningsnummer/-type) fra filnavn + (for PDF)
      // PDF-Title og tittelfelt-tekst. SKRIVES IKKE på raden — returneres til klienten
      // som «foreslått». Entydig treff eller tomt («usikkert → ikke fyll ut»).
      const forslagKilder: Array<string | null> = [input.name];
      if (erPdf) {
        const pdfSti = join(UPLOADS_DIR, input.fileUrl.replace("/uploads/", ""));
        forslagKilder.push(await hentPdfTitle(pdfSti));
        forslagKilder.push(await hentTittelfeltTekst(pdfSti));
      }
      const metadataForslag = {
        drawingNumber: finnTegningsnummer(forslagKilder),
        drawingType: finnTegningstype(forslagKilder),
        kilde: erPdf ? ("filnavn+pdf" as const) : ("filnavn" as const),
      };

      return { ...tegning, metadataForslag };
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
        scaleKilde: z.enum(["tittelfelt", "manuell", "kalibrert", "georeferanse", "dwg"]).optional(),
        description: z.string().optional(),
        originator: z.string().max(255).optional(),
        byggeplassId: z.string().uuid().nullable().optional(),
        issuedAt: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      // Målestokk skrevet inn for hånd (detaljtabellen / «Rediger flere») bærer ingen
      // egen kilde — et menneske som taster en målestokk ER manuell bekreftelse. Settes
      // `scaleKilde` eksplisitt (in-viewer-panelet, kalibrering), beholdes den. Uten dette
      // ble `scaleKilde` null og `kanMale()` avslo måling selv om brukeren hadde skrevet 1:50.
      const utledetKilde = utledScaleKildeVedLagring(data.scale !== undefined, data.scaleKilde);
      if (utledetKilde !== undefined) data.scaleKilde = utledetKilde;
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
        // R8: fileType kreves nå så serveren kan starte riktig konvertering for den
        // nye fila (PDF→PNG / DWG→SVG), på samme vei som `opprett`.
        fileType: z.string(),
        fileSize: z.number().int().optional(),
        description: z.string().optional(),
        uploadedById: z.string().uuid().optional(),
        status: tegningStatuser.optional(),
        issuedAt: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { drawingId, revision, fileUrl, fileType, fileSize, description, uploadedById, status, issuedAt } = input;

      // Hent gjeldende tegning
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({
        where: { id: drawingId },
      });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);

      // D6/Q3: arkiver gjeldende DWG-layouts sammen med revisjonen, så en tidligere
      // revisjon kan vises komplett (hovedtegningens forrige fil ligger i fileUrl).
      const gjeldendeLayouter = await ctx.prisma.drawing.findMany({
        where: { parentDrawingId: drawingId },
        select: { layoutNavn: true, fileUrl: true },
      });

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
          layouter: gjeldendeLayouter.length > 0
            ? gjeldendeLayouter.map((l) => ({ layoutNavn: l.layoutNavn, fileUrl: l.fileUrl }))
            : undefined,
        },
      });

      // R8: initial-tilstand for den nye fila — speiler `opprett`s create-data, så
      // konverteringen starter på samme vei (helperen under). For bildetyper regnes
      // dimensjoner synkront; PDF/DWG får originalFileUrl + conversionStatus og
      // konverteres asynkront (ellers ville ny revisjon vist gammel PNG).
      const erDwg = fileType.toLowerCase() === "dwg";
      const erDxf = fileType.toLowerCase() === "dxf";
      const erIfc = fileType.toLowerCase() === "ifc";
      const erPdf = fileType.toLowerCase() === "pdf";

      let imageWidth: number | null = null;
      let imageHeight: number | null = null;
      if (!erDwg && !erDxf && !erIfc && !erPdf) {
        const dim = await hentBildeDimensjoner(join(UPLOADS_DIR, fileUrl.replace("/uploads/", "")));
        if (dim) { imageWidth = dim.width; imageHeight = dim.height; }
      }

      const oppdatert = await ctx.prisma.drawing.update({
        where: { id: drawingId },
        data: {
          revision,
          version: tegning.version + 1,
          fileUrl,
          fileType,
          fileSize: fileSize ?? null,
          status: status ?? tegning.status,
          issuedAt: issuedAt ?? null,
          description,
          // Bildetype: sett dim + nullstill konvertering (ingen konvertering kreves).
          // PDF/DWG/DXF: originalFileUrl + conversionStatus = venter på konvertering.
          imageWidth,
          imageHeight,
          ...((erDwg || erDxf || erPdf)
            ? { originalFileUrl: fileUrl, conversionStatus: (erDwg || erDxf) ? "pending" : "converting" }
            : { conversionStatus: null }),
        },
      });

      // R8: start konvertering for den nye fila (delt vei med `opprett`). brukerScale =
      // eksisterende målestokk → en kalibrert/manuell målestokk overskrives aldri av et
      // nytt tittelfelt-forslag.
      startTegningKonvertering(
        ctx.prisma,
        { id: tegning.id, name: tegning.name, projectId: tegning.projectId, byggeplassId: tegning.byggeplassId },
        { fileUrl, fileType, brukerScale: tegning.scale },
      );

      return oppdatert;
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

  // RETUR 2 (vedtak A): sett/nullstill brukerens rotasjons-overstyring for en DWG-tegning.
  // `grader` = absolutt visningsrotasjon (auto ± 90°-trinn, eller 0 = tilbake til
  // opprinnelig urotert). `null` = fjern overstyring, følg auto igjen. Vieweren roterer
  // (rotasjonOverstyrt − autoRotasjon) på toppen av den allerede inn-bakte auto-rotasjonen.
  settRotasjon: protectedProcedure
    .input(z.object({
      drawingId: z.string().uuid(),
      grader: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tegning = await ctx.prisma.drawing.findUniqueOrThrow({ where: { id: input.drawingId }, select: { projectId: true } });
      await verifiserProsjektmedlem(ctx.userId, tegning.projectId);
      return ctx.prisma.drawing.update({
        where: { id: input.drawingId },
        data: { rotasjonOverstyrt: input.grader },
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

  // D2: er DWG/DXF-konvertering (libredwg) tilgjengelig i DENNE containeren?
  // Opplastingsdialogen bruker dette til å avvise .dwg/.dxf med forklaring i stedet for
  // en stille `failed`. Ingen prosjekt-scope — serveren selv har eller mangler konvertereren.
  // Cachet 60 s i tjenesten. NB (D-M2): tRPC kjører in-process i web, så svaret her
  // gjelder containeren som faktisk ville konvertert (web for nettleser-opplasting).
  konverteringKapasitet: protectedProcedure.query(async () => {
    return hentKonverteringKapasitet();
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

      // Start konvertering på nytt — filtype utledes av originalens endelse (dwg/dxf).
      const original = tegning.originalFileUrl;
      const filType = original.toLowerCase().endsWith(".dxf") ? "dxf" : "dwg";
      const filSti = join(UPLOADS_DIR, original.replace("/uploads/", ""));
      konverterDwg(filSti, tegning.name, UPLOADS_DIR, filType)
        .then((resultat) => anvendDwgResultat(
          ctx.prisma,
          { id: tegning.id, name: tegning.name, projectId: tegning.projectId, byggeplassId: tegning.byggeplassId },
          resultat,
          original,
        ))
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

  // Backfill av måle-grunnlag (mm/piksel) for eldre PDF-tegninger UTEN ny rendering.
  //
  // Tegninger konvertert før måling-i-tegning (2026-09-24) fikk aldri `mmPrPiksel`,
  // så `kanMale()` avslår måling selv om målestokken er satt. `rekonverterPdf` tar
  // bare uferdige/feilede PDF-er, aldri de ferdige — derfor denne. Papirbredden
  // leses på nytt fra original-PDF-en (`pdfinfo`) og mm/piksel utledes mot den
  // ALLEREDE lagrede `imageWidth`. `fileUrl` røres ikke og ingenting rendres på nytt.
  // Begrenset til PDF-kilde: en DWG/DXF-tegnings `mmPrPiksel = null` er legitim
  // (ukjent enhet → låst til kalibrering) og pdfinfo gjelder ikke der.
  backfillMaalegrunnlag: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await verifiserProsjektIkkeFrosset(ctx.userId, input.projectId);
      // Samme tilgang som rekonverter-knappen: sitedoc_admin eller prosjektadmin.
      const bruker = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { role: true } });
      if (bruker?.role !== "sitedoc_admin") {
        const medlem = await ctx.prisma.projectMember.findUnique({
          where: { userId_projectId: { userId: ctx.userId, projectId: input.projectId } },
        });
        if (medlem?.role !== "admin") {
          return { totalt: 0, oppdatert: 0, utenGrunnlag: 0, melding: "Kun admin kan hente målegrunnlag" };
        }
      }

      const kandidater = await ctx.prisma.drawing.findMany({
        where: {
          projectId: input.projectId,
          conversionStatus: "done",
          mmPrPiksel: null,
          OR: [
            { fileType: "pdf" },
            { originalFileUrl: { endsWith: ".pdf" } },
          ],
        },
        select: { id: true, name: true, fileUrl: true, originalFileUrl: true, fileType: true, imageWidth: true },
      });

      let oppdatert = 0;
      let utenGrunnlag = 0;
      for (const t of kandidater) {
        // PDF-kilden: original-PDF-en (konverterte) eller selve fila (uendret pdf).
        const pdfRel = t.originalFileUrl ?? (t.fileType === "pdf" ? t.fileUrl : null);
        if (!pdfRel) { utenGrunnlag++; continue; }
        const pdfFilSti = join(UPLOADS_DIR, pdfRel.replace("/uploads/", ""));
        const papirBreddeMm = await hentPapirbreddeMm(pdfFilSti);
        if (!papirBreddeMm) { utenGrunnlag++; continue; }

        // Bredde: bruk lagret imageWidth; mangler den, les fra det viste bildet (sharp).
        let imageWidth = t.imageWidth ?? null;
        let imageHeight: number | null = null;
        if (imageWidth == null) {
          const dim = await hentBildeDimensjoner(join(UPLOADS_DIR, t.fileUrl.replace("/uploads/", "")));
          if (dim) { imageWidth = dim.width; imageHeight = dim.height; }
        }
        if (imageWidth == null || imageWidth <= 0) { utenGrunnlag++; continue; }

        const mmPrPiksel = utledMmPrPiksel(papirBreddeMm, imageWidth);
        await ctx.prisma.drawing.update({
          where: { id: t.id },
          data: { mmPrPiksel, ...(imageHeight != null ? { imageWidth, imageHeight } : {}) },
        });
        oppdatert++;
        console.log(`[Backfill-mål] ${t.name}: mm/px=${mmPrPiksel}`);
      }

      return {
        totalt: kandidater.length,
        oppdatert,
        utenGrunnlag,
        melding: `${oppdatert} av ${kandidater.length} tegning(er) fikk målegrunnlag${utenGrunnlag > 0 ? `, ${utenGrunnlag} uten PDF-grunnlag` : ""}`,
      };
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
