/**
 * Klargjør prosjekt for offline-bruk.
 * Laster ned tegninger, IFC-modeller og bilder til lokal lagring.
 */

import * as FileSystem from "expo-file-system/legacy";
import { hentWebUrl } from "../config/auth";
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
  // Mobilvariant (ezdxf hatch=solid). Vises i stedet for fileUrl når satt → caches også.
  mobilFileUrl?: string | null;
  fileType: string | null;
  updatedAt?: string;
}

/** Minste form viseren trenger for å avgjøre offline-tilstand (lokasjoner + Mer). */
export interface TegningKildeRef {
  fileUrl: string | null;
  mobilFileUrl?: string | null;
}

/** Resolvert kilde for viseren: data-URI (lokal) ELLER nett-URL, eller utilgjengelig. */
export interface TegningKilde {
  /** data:-URI når lokal · full nett-URL når online · null når offline + ikke forberedt. */
  uri: string | null;
  /** true = lest fra lokal cache (fungerer i flymodus). */
  lokal: boolean;
  /** true = uten nett OG ikke forberedt → viseren viser «Ikke tilgjengelig offline». */
  offlineUtilgjengelig: boolean;
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

/**
 * Effektiv vis-URL for en tegning: mobilvarianten (ezdxf) når den finnes, ellers
 * fileUrl. Speiler valget i lokasjoner.tsx (`mobilFileUrl ?? fileUrl`) — begge er
 * revisjon-unike UUID-filnavn (upload.ts + dwgKonvertering.ts), så siste URL-ledd
 * er en komplett revisjon-nøkkel: ny revisjon ⇒ nytt filnavn ⇒ egen cache-nøkkel.
 */
function effektivVisUrl(ref: TegningKildeRef): string | null {
  return ref.mobilFileUrl ?? ref.fileUrl ?? null;
}

/** MIME-type fra filendelse (de typene viseren faktisk får: svg / png / jpg). */
function mimeForUrl(url: string): string {
  const navn = lagFilnavn(url).toLowerCase();
  if (navn.endsWith(".svg")) return "image/svg+xml";
  if (navn.endsWith(".png")) return "image/png";
  if (navn.endsWith(".jpg") || navn.endsWith(".jpeg")) return "image/jpeg";
  if (navn.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

/**
 * Last den lokale kopien inn som data-URI. WKWebView nekter å lese `file://` fra en
 * HTML-streng-kilde (`loadHTMLString`), så lokal visning går via data-URI — fungerer
 * likt for `<img>`, `fetch()` (ezdxf-inline) og RN-lupa, og nettstien laster uansett
 * de samme bytene.
 */
async function lesSomDataUri(lokalSti: string, url: string): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(lokalSti, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${mimeForUrl(url)};base64,${b64}`;
}

/**
 * Forbered ÉN tegning for offline: last ned både fileUrl og (når satt) mobilvarianten,
 * så viseren kan lese den lokalt uansett hvilken variant den bruker. Idempotent
 * (lastNedTegning hopper over allerede cachede filer).
 */
export async function forberedTegning(ref: TegningKildeRef): Promise<void> {
  if (ref.fileUrl) await lastNedTegning(ref.fileUrl);
  if (ref.mobilFileUrl) await lastNedTegning(ref.mobilFileUrl);
}

/**
 * Er tegningen forberedt for offline? Sjekker den EFFEKTIVE vis-URL-en (mobilvariant
 * når den finnes) — det er den fila viseren faktisk trenger lokalt.
 */
export async function erTegningForberedt(ref: TegningKildeRef): Promise<boolean> {
  const url = effektivVisUrl(ref);
  if (!url) return false;
  return erTegningCachet(url);
}

/**
 * Resolver kilden viseren skal bruke: LOKAL KOPI FØRST (data-URI), ellers nett, ellers
 * «ikke tilgjengelig offline». `apiUrl` speiler lokasjoner-nettstien (AUTH_CONFIG.apiUrl).
 */
export async function hentTegningKilde(
  ref: TegningKildeRef,
  erPaaNettet: boolean,
  apiUrl: string,
): Promise<TegningKilde> {
  const url = effektivVisUrl(ref);
  if (!url) return { uri: null, lokal: false, offlineUtilgjengelig: false };

  const lokalSti = await hentTegningLokalSti(url);
  if (lokalSti) {
    try {
      return { uri: await lesSomDataUri(lokalSti, url), lokal: true, offlineUtilgjengelig: false };
    } catch {
      // Lesing feilet (korrupt/slettet under oss) → fall til nett om mulig.
    }
  }

  if (erPaaNettet) {
    const nett = url.startsWith("http") ? url : `${apiUrl}${url}`;
    return { uri: nett, lokal: false, offlineUtilgjengelig: false };
  }

  return { uri: null, lokal: false, offlineUtilgjengelig: true };
}

/** Last ned én tegning til lokal cache */
export async function lastNedTegning(fileUrl: string): Promise<void> {
  await initialiserMappe();
  const filnavn = lagFilnavn(fileUrl);
  const lokalSti = `${TEGNING_MAPPE}${filnavn}`;

  const info = await FileSystem.getInfoAsync(lokalSti);
  if (info.exists) return; // Allerede cachet

  const baseUrl = hentWebUrl();
  const url = fileUrl.startsWith("/api") ? fileUrl : `/api${fileUrl}`;
  const fullUrl = fileUrl.startsWith("http") ? fileUrl : `${baseUrl}${url}`;

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

  const plantegninger = tegninger.filter((t) => t.fileUrl && (t.fileType?.toLowerCase() ?? "") !== "ifc");
  const ifcModeller = tegninger.filter((t) => t.fileUrl && t.fileType?.toLowerCase() === "ifc");
  console.log(`[Offline] ${plantegninger.length} tegninger, ${ifcModeller.length} IFC-modeller`);
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
      // Mobilvarianten (ezdxf) er den som faktisk vises for DWG → cache den også,
      // ellers brukes den nedlastede fileUrl aldri av viseren offline.
      if (t.mobilFileUrl) await lastNedTegning(t.mobilFileUrl);
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
