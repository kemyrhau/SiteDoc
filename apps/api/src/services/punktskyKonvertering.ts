/**
 * Punktsky-konvertering
 *
 * Pipeline: Opplastet fil → [CloudCompare] → LAS → PotreeConverter → Potree octree
 *
 * CloudCompare brukes for:
 * - E57 → LAS konvertering
 * - PLY → LAS konvertering
 * - Evt. forbehandling (subsampling, filtrering)
 *
 * PotreeConverter genererer octree for Potree-vieweren:
 * - Output: metadata.json, hierarchy.bin, octree.bin
 */

import { execFile } from "child_process";
import { mkdir, readFile, rename, readdir, stat, rm } from "fs/promises";
import { join, basename, extname } from "path";
import { randomUUID } from "crypto";
import { promisify } from "util";
import { lesLasInfo, type LasInfo } from "./lasHeader";

const execFileAsync = promisify(execFile);

export interface PunktSkyResultat {
  potreeUrl: string | null;     // Relativ URL til Potree metadata.json
  lasInfo: LasInfo | null;
  feil: string | null;
}

/** Sjekk om en kommando finnes i PATH */
async function kommandoFinnes(cmd: string): Promise<boolean> {
  try {
    await execFileAsync("which", [cmd]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Konverter E57/PLY til LAS via CloudCompare CLI.
 * Returnerer sti til output LAS-fil.
 */
async function konverterTilLas(
  innfil: string,
  tmpDir: string,
): Promise<string> {
  const harCC = await kommandoFinnes("CloudCompare");
  const harXvfb = await kommandoFinnes("xvfb-run");

  if (!harCC) {
    throw new Error("CloudCompare er ikke installert på serveren");
  }

  const args = [
    "-SILENT",
    "-O", innfil,
    "-C_EXPORT_FMT", "LAS",
    "-SAVE_CLOUDS",
  ];

  // Linux headless krever xvfb
  if (harXvfb) {
    await execFileAsync("xvfb-run", ["--auto-servernum", "CloudCompare", ...args], {
      timeout: 600_000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: tmpDir,
    });
  } else {
    await execFileAsync("CloudCompare", args, {
      timeout: 600_000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: tmpDir,
    });
  }

  // Finn output LAS-fil
  const filer = await readdir(tmpDir);
  const lasFil = filer.find((f) => f.toLowerCase().endsWith(".las") || f.toLowerCase().endsWith(".laz"));
  if (!lasFil) {
    throw new Error("CloudCompare produserte ingen LAS-output");
  }

  return join(tmpDir, lasFil);
}

/**
 * Kjør PotreeConverter for å generere octree.
 * Returnerer sti til output-mappen.
 */
async function kjørPotreeConverter(
  lasFil: string,
  outputDir: string,
): Promise<void> {
  // Sjekk PotreeConverter 2.x først, deretter 1.7
  const harPC2 = await kommandoFinnes("PotreeConverter");
  const harPC17 = !harPC2 && await kommandoFinnes("PotreeConverter1.7");

  const konverter = harPC2 ? "PotreeConverter" : harPC17 ? "PotreeConverter1.7" : null;

  if (!konverter) {
    throw new Error("PotreeConverter er ikke installert på serveren");
  }

  await mkdir(outputDir, { recursive: true });

  const args = [
    lasFil,
    "-o", outputDir,
    "--output-attributes", "RGB,INTENSITY,CLASSIFICATION,RETURN_NUMBER,NUMBER_OF_RETURNS",
  ];

  await execFileAsync(konverter, args, {
    timeout: 1_800_000, // 30 min for store filer
    maxBuffer: 50 * 1024 * 1024,
  });

  // Verifiser at output eksisterer
  const filer = await readdir(outputDir);
  const harMetadata = filer.some((f) => f === "metadata.json");
  if (!harMetadata) {
    throw new Error("PotreeConverter produserte ingen metadata.json");
  }
}

/**
 * Hovedfunksjon: konverter punktsky-fil til Potree-format.
 *
 * @param filsti - Absolutt sti til opplastet fil
 * @param filnavn - Originalt filnavn
 * @param uploadsDir - Sti til uploads-katalogen
 */
export async function konverterPunktsky(
  filsti: string,
  filnavn: string,
  uploadsDir: string,
): Promise<PunktSkyResultat> {
  const ext = extname(filnavn).toLowerCase();
  const tmpId = randomUUID();
  const tmpDir = join("/tmp", `punktsky-${tmpId}`);
  const potreeId = randomUUID();
  const potreeOutputDir = join(uploadsDir, "potree", potreeId);

  try {
    await mkdir(tmpDir, { recursive: true });

    let lasFil = filsti;

    // Konverter fra E57/PLY til LAS via CloudCompare
    if (ext === ".e57" || ext === ".ply") {
      console.log(`[Punktsky] Konverterer ${ext} → LAS via CloudCompare...`);
      // Kopier fil til tmp-dir for CloudCompare
      const { copyFile } = await import("fs/promises");
      const tmpInn = join(tmpDir, basename(filnavn));
      await copyFile(filsti, tmpInn);
      lasFil = await konverterTilLas(tmpInn, tmpDir);
      console.log(`[Punktsky] CloudCompare-konvertering fullført: ${lasFil}`);
    }

    // Les LAS-header for metadata
    console.log(`[Punktsky] Leser LAS-header...`);
    let lasInfo: LasInfo | null = null;
    try {
      lasInfo = await lesLasInfo(lasFil);
      console.log(`[Punktsky] ${lasInfo.punktAntall} punkter, versjon ${lasInfo.versjon}, format ${lasInfo.punktFormat}`);
      console.log(`[Punktsky] Klassifisering: ${lasInfo.harKlassifisering ? "ja" : "nei"}, RGB: ${lasInfo.harRgb ? "ja" : "nei"}`);
      if (lasInfo.harKlassifisering) {
        const klasser = lasInfo.klassifiseringer
          .filter((k) => k.antall > 0)
          .map((k) => `${k.navn} (${k.antall})`)
          .join(", ");
        console.log(`[Punktsky] Klasser: ${klasser}`);
      }
    } catch (err) {
      console.warn(`[Punktsky] Kunne ikke lese LAS-header: ${err}`);
    }

    // Kjør PotreeConverter
    console.log(`[Punktsky] Kjører PotreeConverter...`);
    await kjørPotreeConverter(lasFil, potreeOutputDir);
    console.log(`[Punktsky] PotreeConverter fullført → ${potreeOutputDir}`);

    const potreeUrl = `/uploads/potree/${potreeId}/metadata.json`;

    return {
      potreeUrl,
      lasInfo,
      feil: null,
    };
  } catch (err) {
    const melding = err instanceof Error ? err.message : "Ukjent feil";
    console.error(`[Punktsky] Konvertering feilet: ${melding}`);
    return {
      potreeUrl: null,
      lasInfo: null,
      feil: melding,
    };
  } finally {
    // Rydd opp tmp-filer
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignorer
    }
  }
}
