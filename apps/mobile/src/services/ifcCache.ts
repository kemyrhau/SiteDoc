/**
 * Lokal cache for IFC-filer.
 * Laster ned IFC-modeller til dokumentmappen for offline-tilgang.
 * Filer identifiseres med SHA av URL for konsistent navngiving.
 */

import * as FileSystem from "expo-file-system/legacy";
import { AUTH_CONFIG } from "../config/auth";
import { hentSessionToken } from "./auth";

const IFC_MAPPE = `${FileSystem.documentDirectory}sitedoc-ifc/`;

interface CachetModell {
  id: string;
  name: string;
  fileUrl: string;
  lokalSti: string;
  størrelse: number;
}

interface CacheMeta {
  updatedAt: string;
  cachedAt: string;
}

interface NedlastingsStatus {
  id: string;
  status: "venter" | "laster" | "ferdig" | "feilet";
  prosent: number;
  feil?: string;
}

/** Sørg for at cache-mappen finnes */
async function initialiserMappe() {
  const info = await FileSystem.getInfoAsync(IFC_MAPPE);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IFC_MAPPE, { intermediates: true });
  }
}

/** Generer konsistent filnavn fra URL */
function lagFilnavn(fileUrl: string): string {
  // Bruk siste del av URL (UUID.ifc)
  const deler = fileUrl.split("/");
  return deler[deler.length - 1] ?? "modell.ifc";
}

/** Hent cache-metadata for en fil */
async function hentMeta(lokalSti: string): Promise<CacheMeta | null> {
  try {
    const metaSti = `${lokalSti}.meta`;
    const info = await FileSystem.getInfoAsync(metaSti);
    if (!info.exists) return null;
    const json = await FileSystem.readAsStringAsync(metaSti);
    return JSON.parse(json) as CacheMeta;
  } catch { return null; }
}

/** Lagre cache-metadata */
async function lagreMeta(lokalSti: string, meta: CacheMeta): Promise<void> {
  await FileSystem.writeAsStringAsync(`${lokalSti}.meta`, JSON.stringify(meta));
}

/** Sjekk om en IFC-fil er cachet lokalt */
export async function erCachet(fileUrl: string): Promise<boolean> {
  const filnavn = lagFilnavn(fileUrl);
  const sti = `${IFC_MAPPE}${filnavn}`;
  const info = await FileSystem.getInfoAsync(sti);
  return info.exists;
}

/** Hent lokal sti for en cachet fil (null hvis ikke cachet) */
export async function hentLokalSti(fileUrl: string): Promise<string | null> {
  const filnavn = lagFilnavn(fileUrl);
  const sti = `${IFC_MAPPE}${filnavn}`;
  const info = await FileSystem.getInfoAsync(sti);
  return info.exists ? sti : null;
}

/** Last ned en IFC-fil til lokal cache (med versjonskontroll) */
export async function lastNedIfc(
  fileUrl: string,
  onProgress?: (prosent: number) => void,
  serverUpdatedAt?: string,
): Promise<string> {
  await initialiserMappe();

  const filnavn = lagFilnavn(fileUrl);
  const lokalSti = `${IFC_MAPPE}${filnavn}`;

  // Sjekk om allerede cachet OG oppdatert
  const info = await FileSystem.getInfoAsync(lokalSti);
  if (info.exists) {
    if (!serverUpdatedAt) return lokalSti; // Ingen versjonsinfo — bruk cache
    const meta = await hentMeta(lokalSti);
    if (meta && new Date(meta.updatedAt) >= new Date(serverUpdatedAt)) {
      return lokalSti; // Cache er fersk
    }
    // Cache er utdatert — slett og last ned på nytt
    try { await FileSystem.deleteAsync(lokalSti, { idempotent: true }); } catch { /* */ }
  }

  // Bygg full URL — /uploads/ serveres direkte, /api/ for tegning-nedlasting
  const baseUrl = AUTH_CONFIG.apiUrl.replace("/trpc", "");
  const fullUrl = fileUrl.startsWith("http")
    ? fileUrl
    : `${baseUrl}${fileUrl}`;

  const token = await hentSessionToken();

  const nedlasting = FileSystem.createDownloadResumable(
    fullUrl,
    lokalSti,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    (status) => {
      if (status.totalBytesExpectedToWrite > 0) {
        const prosent = Math.round(
          (status.totalBytesWritten / status.totalBytesExpectedToWrite) * 100,
        );
        onProgress?.(prosent);
      }
    },
  );

  const result = await nedlasting.downloadAsync();
  if (!result || result.status !== 200) {
    // Fjern ufullstendig fil
    try { await FileSystem.deleteAsync(lokalSti, { idempotent: true }); } catch { /* */ }
    throw new Error(`Nedlasting feilet (HTTP ${result?.status ?? "ukjent"})`);
  }

  // Lagre metadata for versjonskontroll
  if (serverUpdatedAt) {
    await lagreMeta(lokalSti, { updatedAt: serverUpdatedAt, cachedAt: new Date().toISOString() });
  }

  return lokalSti;
}

/** Last ned flere IFC-filer med fremdriftsrapportering */
export async function lastNedAlleIfc(
  modeller: Array<{ id: string; name: string; fileUrl: string; updatedAt?: string }>,
  onStatus?: (statuser: NedlastingsStatus[]) => void,
): Promise<CachetModell[]> {
  await initialiserMappe();

  const statuser: NedlastingsStatus[] = modeller.map((m) => ({
    id: m.id,
    status: "venter",
    prosent: 0,
  }));

  const resultater: CachetModell[] = [];

  for (let i = 0; i < modeller.length; i++) {
    const modell = modeller[i]!;
    statuser[i] = { ...statuser[i]!, status: "laster" };
    onStatus?.([...statuser]);

    try {
      const lokalSti = await lastNedIfc(
        modell.fileUrl,
        (prosent) => {
          statuser[i] = { ...statuser[i]!, prosent };
          onStatus?.([...statuser]);
        },
        modell.updatedAt,
      );

      const info = await FileSystem.getInfoAsync(lokalSti);
      resultater.push({
        id: modell.id,
        name: modell.name,
        fileUrl: modell.fileUrl,
        lokalSti,
        størrelse: (info as { size?: number }).size ?? 0,
      });

      statuser[i] = { ...statuser[i]!, status: "ferdig", prosent: 100 };
      onStatus?.([...statuser]);
    } catch (err) {
      statuser[i] = {
        ...statuser[i]!,
        status: "feilet",
        feil: err instanceof Error ? err.message : String(err),
      };
      onStatus?.([...statuser]);
    }
  }

  return resultater;
}

/** Hent liste over alle cachete IFC-filer */
export async function hentCachedeModeller(): Promise<Array<{ filnavn: string; størrelse: number }>> {
  try {
    const info = await FileSystem.getInfoAsync(IFC_MAPPE);
    if (!info.exists) return [];

    const filer = await FileSystem.readDirectoryAsync(IFC_MAPPE);
    const resultater = [];
    for (const fil of filer) {
      const filInfo = await FileSystem.getInfoAsync(`${IFC_MAPPE}${fil}`);
      resultater.push({
        filnavn: fil,
        størrelse: (filInfo as { size?: number }).size ?? 0,
      });
    }
    return resultater;
  } catch {
    return [];
  }
}

/** Slett alle cachete IFC-filer */
export async function tømIfcCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(IFC_MAPPE, { idempotent: true });
  } catch { /* */ }
}

/** Hent total størrelse på IFC-cache i bytes */
export async function hentCacheStørrelse(): Promise<number> {
  const filer = await hentCachedeModeller();
  return filer.reduce((sum, f) => sum + f.størrelse, 0);
}
