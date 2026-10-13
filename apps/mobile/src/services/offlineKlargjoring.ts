/**
 * Klargjør prosjekt for offline-bruk.
 * Laster ned tegninger, IFC-modeller og bilder til lokal lagring.
 */

import * as FileSystem from "expo-file-system/legacy";
import { hentWebUrl } from "../config/auth";
import { hentSessionToken } from "./auth";
import { lastNedIfc, erCachet as erIfcCachet } from "./ifcCache";

const TEGNING_MAPPE = `${FileSystem.documentDirectory}sitedoc-tegninger/`;
/** Cache-mappa viseren får lese-tilgang til (file://-lasting, RETUR 1 B). */
export const TEGNING_CACHE_MAPPE = TEGNING_MAPPE;

const MANIFEST_STI = `${TEGNING_MAPPE}manifest.json`;

/**
 * Tak for HELE tegningscachen (RETUR 1 A). Tegninger er visnings-artefakter
 * (SVG/PNG, typisk < 3 MB; ezdxf-mobilvariant ~2,5 MB) som alltid kan lastes på
 * nytt når det er nett. 500 MB rommer en full byggeplass forberedt offline
 * (dusinvis av tegninger) og hindrer samtidig at revisjon-churn vokser i det
 * uendelige. IFC-modeller har egen cache (`sitedoc-ifc/`) utenfor dette taket.
 * Forberedte tegninger for den AKTIVE byggeplassen skånes for utkasting, så en
 * bevisst «forbered byggeplass» ikke spiser seg selv opp.
 */
let cacheTak = 500 * 1024 * 1024;
/** Test-sømme: overstyr taket for å verifisere LRU-utkasting uten å skrive 500 MB. */
export function _settCacheTak(bytes: number): void {
  cacheTak = bytes;
}

/** Én tegnings cache-tilstand i manifestet. */
interface ManifestPost {
  /** Filnavn (ikke full sti) som hører til DENNE revisjonen nå (fileUrl + evt. mobil). */
  filer: string[];
  /** true = eksplisitt «Forbered til offline» (ikke tilfeldig visnings-cache). */
  forberedt: boolean;
  /** Byggeplassen tegningen hører til — brukes til å skåne den aktive ved utkasting. */
  byggeplassId?: string | null;
  /** Date.now() ved siste visning/nedlasting — LRU-rekkefølge. */
  sistBrukt: number;
}
type Manifest = Record<string, ManifestPost>; // tegningId → post

async function lesManifest(): Promise<Manifest> {
  try {
    const info = await FileSystem.getInfoAsync(MANIFEST_STI);
    if (!info.exists) return {};
    return JSON.parse(await FileSystem.readAsStringAsync(MANIFEST_STI)) as Manifest;
  } catch {
    return {};
  }
}

async function skrivManifest(m: Manifest): Promise<void> {
  await initialiserMappe();
  try {
    await FileSystem.writeAsStringAsync(MANIFEST_STI, JSON.stringify(m));
  } catch {
    /* manifest er en optimalisering — skrivefeil skal ikke rive nedlasting */
  }
}

async function filStorrelse(filnavn: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(`${TEGNING_MAPPE}${filnavn}`);
    return info.exists ? ((info as { size?: number }).size ?? 0) : 0;
  } catch {
    return 0;
  }
}

/** Er filnavnet referert av en ANNEN tegning enn `unntattId`? (trygghet mot delt UUID). */
function filIBrukAvAnnen(m: Manifest, unntattId: string, filnavn: string): boolean {
  for (const [id, post] of Object.entries(m)) {
    if (id === unntattId) continue;
    if (post.filer.includes(filnavn)) return true;
  }
  return false;
}

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
  byggeplassId?: string | null;
  updatedAt?: string;
}

/** Minste form viseren trenger for å avgjøre offline-tilstand (lokasjoner + Mer). */
export interface TegningKildeRef {
  fileUrl: string | null;
  mobilFileUrl?: string | null;
}

/** Resolvert kilde for viseren: file://-sti (lokal) ELLER nett-URL, eller utilgjengelig. */
export interface TegningKilde {
  /** file://-sti når lokal · full nett-URL når online · null når offline + ikke forberedt. */
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

/**
 * Registrer tegningens cachede filer i manifestet og rydd (RETUR 1 A):
 *  1. Slett filer fra FORRIGE revisjon av samme tegning som ikke lenger er i bruk
 *     (ny revisjon = nytt UUID-filnavn → gammel fil ble ellers liggende for alltid).
 *  2. Skriv den nye posten (forberedt=true, sistBrukt=nå).
 *  3. Kjør LRU-tak på hele cachen (skåner forberedt for den aktive byggeplassen).
 */
async function registrerCache(
  tegningId: string,
  nyeFiler: string[],
  byggeplassId?: string | null,
): Promise<void> {
  const m = await lesManifest();
  const gammel = m[tegningId];
  if (gammel) {
    for (const f of gammel.filer) {
      if (!nyeFiler.includes(f) && !filIBrukAvAnnen(m, tegningId, f)) {
        try { await FileSystem.deleteAsync(`${TEGNING_MAPPE}${f}`, { idempotent: true }); } catch { /* */ }
      }
    }
  }
  m[tegningId] = {
    filer: nyeFiler,
    forberedt: true,
    byggeplassId: byggeplassId ?? gammel?.byggeplassId ?? null,
    sistBrukt: Date.now(),
  };
  await skrivManifest(m);
  await ryddCache(byggeplassId ?? null);
}

/**
 * LRU-utkasting til cachen er under taket. Skåner tegninger som er forberedt for den
 * AKTIVE byggeplassen (`aktivByggeplassId`); alt annet (inkl. forberedt for tidligere
 * byggeplasser og tilfeldig visnings-cache) kastes eldst-først etter `sistBrukt`.
 */
async function ryddCache(aktivByggeplassId: string | null, tak: number = cacheTak): Promise<void> {
  const m = await lesManifest();
  const poster = Object.entries(m);
  if (!poster.length) return;

  const str: Record<string, number> = {};
  for (const [, post] of poster) {
    for (const f of post.filer) if (str[f] == null) str[f] = await filStorrelse(f);
  }
  let total = Object.values(str).reduce((a, b) => a + b, 0);
  if (total <= tak) return;

  const skånet = (p: ManifestPost) =>
    p.forberedt && aktivByggeplassId != null && p.byggeplassId === aktivByggeplassId;
  const kandidater = poster
    .filter(([, p]) => !skånet(p))
    .sort((a, b) => a[1].sistBrukt - b[1].sistBrukt);

  for (const [id, post] of kandidater) {
    if (total <= tak) break;
    for (const f of post.filer) {
      if (filIBrukAvAnnen(m, id, f)) continue;
      try { await FileSystem.deleteAsync(`${TEGNING_MAPPE}${f}`, { idempotent: true }); } catch { /* */ }
      total -= str[f] ?? 0;
    }
    delete m[id];
  }
  await skrivManifest(m);
}

/** LRU-berøring: marker tegningen som nettopp brukt (kalt når viseren leser lokal kopi). */
async function berorTegning(tegningId: string): Promise<void> {
  const m = await lesManifest();
  if (!m[tegningId]) return;
  m[tegningId] = { ...m[tegningId]!, sistBrukt: Date.now() };
  await skrivManifest(m);
}

/**
 * Forbered ÉN tegning for offline: last ned både fileUrl og (når satt) mobilvarianten,
 * så viseren kan lese den lokalt uansett hvilken variant den bruker. Idempotent
 * (lastNedTegning hopper over allerede cachede filer). `tegningId` kobler filene til
 * tegningen i manifestet (revisjon-opprydning + LRU); uten id gjøres ingen bokføring.
 */
export async function forberedTegning(
  ref: TegningKildeRef,
  tegningId?: string,
  byggeplassId?: string | null,
): Promise<void> {
  if (ref.fileUrl) await lastNedTegning(ref.fileUrl);
  if (ref.mobilFileUrl) await lastNedTegning(ref.mobilFileUrl);
  if (tegningId) {
    const filer = [
      ref.fileUrl ? lagFilnavn(ref.fileUrl) : null,
      ref.mobilFileUrl ? lagFilnavn(ref.mobilFileUrl) : null,
    ].filter((f): f is string => !!f);
    await registrerCache(tegningId, filer, byggeplassId);
  }
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
 * Resolver kilden viseren skal bruke: LOKAL KOPI FØRST (`file://`-sti), ellers nett,
 * ellers «ikke tilgjengelig offline». `apiUrl` speiler lokasjoner-nettstien
 * (AUTH_CONFIG.apiUrl). RETUR 1 B: lokal kopi leveres som `file://`-sti (ikke base64
 * data-URI), så WebView-en refererer fila direkte og slipper å holde innholdet i
 * flere kopier i minnet. `tegningId` (valgfri) LRU-berører posten ved visning.
 */
export async function hentTegningKilde(
  ref: TegningKildeRef,
  erPaaNettet: boolean,
  apiUrl: string,
  tegningId?: string,
): Promise<TegningKilde> {
  const url = effektivVisUrl(ref);
  if (!url) return { uri: null, lokal: false, offlineUtilgjengelig: false };

  const lokalSti = await hentTegningLokalSti(url);
  if (lokalSti) {
    if (tegningId) { try { await berorTegning(tegningId); } catch { /* */ } }
    return { uri: lokalSti, lokal: true, offlineUtilgjengelig: false };
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
      // Bokfør i manifestet (revisjon-opprydning + LRU, RETUR 1 A).
      await registrerCache(
        t.id,
        [lagFilnavn(t.fileUrl), t.mobilFileUrl ? lagFilnavn(t.mobilFileUrl) : null].filter((f): f is string => !!f),
        t.byggeplassId ?? null,
      );
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

/**
 * Skriv viser-HTML-en til cache-mappa og returner `file://`-stien (RETUR 1 B). Viseren
 * laster denne fila via `source={{ uri }}` + `allowingReadAccessToURL=TEGNING_CACHE_MAPPE`,
 * slik at `<img src="file://…">`/`fetch("file://…")` leser den lokale tegningen DIREKTE
 * uten base64 i minnet. `nonce` gir unikt filnavn pr. innholdsendring, så WebView-en
 * laster på nytt når markører/innhold endres (file-URL caches ellers). Tidligere
 * visnings-HTML ryddes (bare én er aktiv om gangen).
 */
export async function skrivTegningHtml(html: string, nonce: number): Promise<string> {
  await initialiserMappe();
  try {
    const filer = await FileSystem.readDirectoryAsync(TEGNING_MAPPE);
    for (const f of filer) {
      if (f.startsWith("visning-") && f.endsWith(".html")) {
        await FileSystem.deleteAsync(`${TEGNING_MAPPE}${f}`, { idempotent: true });
      }
    }
  } catch { /* */ }
  const sti = `${TEGNING_MAPPE}visning-${nonce}.html`;
  await FileSystem.writeAsStringAsync(sti, html);
  return sti;
}
