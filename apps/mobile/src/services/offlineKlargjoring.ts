/**
 * Klargjør prosjekt for offline-bruk.
 * Laster ned tegninger, IFC-modeller og bilder til lokal lagring.
 */

import * as FileSystem from "expo-file-system/legacy";
import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken } from "./auth";
import { lastNedIfc, erCachet as erIfcCachet } from "./ifcCache";

const TEGNING_MAPPE = `${FileSystem.documentDirectory}sitedoc-tegninger/`;

export interface OfflineStatus {
  steg: string;
  ferdigeProsent: number;
  detalj?: string;
}

export interface OfflineResultat {
  tegningerLastet: number;
  ifcLastet: number;
  feil: string[];
}

interface TegningInfo {
  id: string;
  name: string;
  fileUrl: string | null;
  fileType: string | null;
  updatedAt?: string;
}

/** Sørg for at cache-mappen finnes */
async function initialiserMappe() {
  const info = await FileSystem.getInfoAsync(TEGNING_MAPPE);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(TEGNING_MAPPE, { intermediates: true });
  }
}

/** Generer filnavn fra URL */
function lagFilnavn(fileUrl: string): string {
  const deler = fileUrl.split("/");
  return deler[deler.length - 1] ?? "tegning";
}

/** Sjekk om tegning er cachet */
export async function erTegningCachet(fileUrl: string): Promise<boolean> {
  const sti = `${TEGNING_MAPPE}${lagFilnavn(fileUrl)}`;
  const info = await FileSystem.getInfoAsync(sti);
  return info.exists;
}

/** Hent lokal sti for tegning */
export async function hentTegningLokalSti(fileUrl: string): Promise<string | null> {
  const sti = `${TEGNING_MAPPE}${lagFilnavn(fileUrl)}`;
  const info = await FileSystem.getInfoAsync(sti);
  return info.exists ? sti : null;
}

/** Last ned én tegning til lokal cache */
async function lastNedTegning(fileUrl: string): Promise<void> {
  await initialiserMappe();
  const filnavn = lagFilnavn(fileUrl);
  const lokalSti = `${TEGNING_MAPPE}${filnavn}`;

  const info = await FileSystem.getInfoAsync(lokalSti);
  if (info.exists) return; // Allerede cachet

  const fullUrl = fileUrl.startsWith("http")
    ? fileUrl
    : `${AUTH_CONFIG.apiUrl.replace("/trpc", "")}${fileUrl.startsWith("/api") ? fileUrl : `/api${fileUrl}`}`;

  const token = await hentSessionToken();
  const nedlasting = FileSystem.createDownloadResumable(
    fullUrl,
    lokalSti,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );

  const result = await nedlasting.downloadAsync();
  if (!result || result.status !== 200) {
    try { await FileSystem.deleteAsync(lokalSti, { idempotent: true }); } catch { /* */ }
    throw new Error(`HTTP ${result?.status ?? "ukjent"}`);
  }
}

/** Klargjør prosjekt for offline */
export async function klargjørForOffline(
  tegninger: TegningInfo[],
  onStatus: (status: OfflineStatus) => void,
): Promise<OfflineResultat> {
  const feil: string[] = [];
  let tegningerLastet = 0;
  let ifcLastet = 0;

  const plantegninger = tegninger.filter((t) => t.fileUrl && t.fileType?.toLowerCase() !== "ifc");
  const ifcModeller = tegninger.filter((t) => t.fileUrl && t.fileType?.toLowerCase() === "ifc");
  const totalt = plantegninger.length + ifcModeller.length;
  let ferdig = 0;

  // 1. Last ned tegninger (PDF/SVG)
  for (const t of plantegninger) {
    if (!t.fileUrl) continue;
    onStatus({
      steg: "Tegninger",
      ferdigeProsent: Math.round((ferdig / totalt) * 100),
      detalj: t.name,
    });
    try {
      await lastNedTegning(t.fileUrl);
      tegningerLastet++;
    } catch (err) {
      feil.push(`${t.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
    ferdig++;
  }

  // 2. Last ned IFC-modeller
  for (const m of ifcModeller) {
    if (!m.fileUrl) continue;
    const alleredeCachet = await erIfcCachet(m.fileUrl);
    onStatus({
      steg: "3D-modeller",
      ferdigeProsent: Math.round((ferdig / totalt) * 100),
      detalj: alleredeCachet ? `${m.name} (cachet)` : m.name,
    });
    try {
      await lastNedIfc(m.fileUrl, undefined, m.updatedAt);
      ifcLastet++;
    } catch (err) {
      feil.push(`${m.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
    ferdig++;
  }

  onStatus({ steg: "Ferdig", ferdigeProsent: 100 });

  return { tegningerLastet, ifcLastet, feil };
}

/** Hent total størrelse på offline-cache */
export async function hentOfflineStørrelse(): Promise<number> {
  let totalt = 0;
  for (const mappe of [TEGNING_MAPPE, `${FileSystem.documentDirectory}sitedoc-ifc/`]) {
    try {
      const info = await FileSystem.getInfoAsync(mappe);
      if (!info.exists) continue;
      const filer = await FileSystem.readDirectoryAsync(mappe);
      for (const fil of filer) {
        const filInfo = await FileSystem.getInfoAsync(`${mappe}${fil}`);
        totalt += (filInfo as { size?: number }).size ?? 0;
      }
    } catch { /* */ }
  }
  return totalt;
}

/** Slett all offline-data */
export async function slettOfflineData(): Promise<void> {
  try { await FileSystem.deleteAsync(TEGNING_MAPPE, { idempotent: true }); } catch { /* */ }
  // IFC-cache slettes via tømIfcCache() separat
}
