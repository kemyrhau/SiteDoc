/**
 * Klient-cache for dxf-viewer-filene (forenklet DXF + O1-register), RETUR 4 punkt 1+3
 * (relay/inbox-dokgen-arbeidstegning-f1.md). Nøkkelen er den USIGNERTE `/uploads/...`-
 * stien — filnavnet bærer en UUID, og en ny revisjon får en NY fil, så cachen blir
 * aldri feil eller utdatert. Den signerte URL-en (ferskeste fra tRPC-responsen, se
 * `hmac.ts`/`signerUploadsOutput.ts`) brukes KUN til selve nedlastingen ved cache-bom.
 *
 * SVAR RETUR 4 (orkestrator 2026-10-14): «IKKE rør hmac.ts. Cache i stedet DXF-en og
 * registeret på klienten (Cache Storage eller IndexedDB) med den usignerte filstien
 * som nøkkel... Sett et tak (f.eks. LRU 200 MB), og tøm cachen ved utlogging.»
 */

const CACHE_NAVN = "sitedoc-tegning-filer-v1";
const INDEKS_NOKKEL = "sitedoc-tegning-cache-indeks-v1";
const MAKS_BYTES = 200 * 1024 * 1024;

type IndeksOppforing = { bytes: number; sistBrukt: number };
type Indeks = Record<string, IndeksOppforing>;

function lesIndeks(): Indeks {
  if (typeof localStorage === "undefined") return {};
  try {
    const raa = localStorage.getItem(INDEKS_NOKKEL);
    return raa ? (JSON.parse(raa) as Indeks) : {};
  } catch {
    return {};
  }
}

function skrivIndeks(indeks: Indeks): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(INDEKS_NOKKEL, JSON.stringify(indeks));
  } catch {
    // Kvote full e.l. — cachen degraderer til "alltid bom" (indeksen mister sporet),
    // aldri en krasj for brukeren.
  }
}

async function apneCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(CACHE_NAVN);
  } catch {
    return null;
  }
}

/** Hent en cachet fil for den usignerte stien. `null` ved cache-bom eller utilgjengelig API. */
export async function hentFraTegningCache(usignertSti: string): Promise<Blob | null> {
  const cache = await apneCache();
  if (!cache) return null;
  const treff = await cache.match(usignertSti);
  if (!treff) return null;
  const indeks = lesIndeks();
  if (indeks[usignertSti]) {
    indeks[usignertSti] = { ...indeks[usignertSti], sistBrukt: Date.now() };
    skrivIndeks(indeks);
  }
  return treff.blob();
}

/** LRU-utkastelse (eldste `sistBrukt` først) til taket overholdes for den NYE oppføringen. */
async function fjernEldsteVedBehov(nyeBytes: number): Promise<void> {
  const indeks = lesIndeks();
  let totalt = Object.values(indeks).reduce((sum, o) => sum + o.bytes, 0) + nyeBytes;
  if (totalt <= MAKS_BYTES) return;
  const cache = await apneCache();
  if (!cache) return;
  const sortertEldstForst = Object.entries(indeks).sort((a, b) => a[1].sistBrukt - b[1].sistBrukt);
  for (const [sti, oppforing] of sortertEldstForst) {
    if (totalt <= MAKS_BYTES) break;
    await cache.delete(sti);
    delete indeks[sti];
    totalt -= oppforing.bytes;
  }
  skrivIndeks(indeks);
}

/** Lagre en nedlastet fil i cachen under den usignerte stien (best effort). */
export async function lagreITegningCache(usignertSti: string, blob: Blob): Promise<void> {
  const cache = await apneCache();
  if (!cache) return;
  await fjernEldsteVedBehov(blob.size);
  try {
    await cache.put(usignertSti, new Response(blob));
    const indeks = lesIndeks();
    indeks[usignertSti] = { bytes: blob.size, sistBrukt: Date.now() };
    skrivIndeks(indeks);
  } catch {
    // Kvote overskredet e.l. — best effort, aldri en feil brukeren skal se.
  }
}

/** Tøm hele tegningsfil-cachen (RETUR 4 DoD: ved utlogging). */
export async function tomTegningCache(): Promise<void> {
  if (typeof caches !== "undefined") {
    try {
      await caches.delete(CACHE_NAVN);
    } catch {
      // best effort
    }
  }
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(INDEKS_NOKKEL);
    } catch {
      // best effort
    }
  }
}

export type TegningFremdriftFase = "cache" | "nedlasting";
export type TegningFremdriftCbk = (fase: TegningFremdriftFase, mottattBytes: number, totalBytes: number | null) => void;

/**
 * Hent en fil som Blob — cache først (usignert nøkkel), ellers nettverk via den
 * SIGNERTE URL-en (kun brukt ved bom). Rapporterer nedlastingsfremdrift via `fremdrift`
 * (RETUR 4 punkt 3: «vis fremdrift (MB/%), ikke bare 'Laster tegning…'»).
 */
export async function hentFilMedCache(
  usignertSti: string,
  signertUrl: string,
  fremdrift?: TegningFremdriftCbk,
): Promise<Blob> {
  const cachet = await hentFraTegningCache(usignertSti);
  if (cachet) {
    fremdrift?.("cache", cachet.size, cachet.size);
    return cachet;
  }
  const res = await fetch(signertUrl);
  if (!res.ok) {
    throw new Error(`Henting feilet: HTTP ${res.status} ${res.statusText}`);
  }
  const totalBytesRaa = res.headers.get("Content-Length");
  const totalBytes = totalBytesRaa ? Number(totalBytesRaa) : null;
  if (!res.body) {
    const blob = await res.blob();
    fremdrift?.("nedlasting", blob.size, totalBytes ?? blob.size);
    void lagreITegningCache(usignertSti, blob);
    return blob;
  }
  const leser = res.body.getReader();
  const deler: BlobPart[] = [];
  let mottatt = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    deler.push(value as BlobPart);
    mottatt += value.length;
    fremdrift?.("nedlasting", mottatt, totalBytes);
  }
  const blob = new Blob(deler);
  void lagreITegningCache(usignertSti, blob);
  return blob;
}

/** Den usignerte stien — fjerner `?exp=&sig=`-query — nøkkelen cachen bruker. */
export function usignertFilSti(url: string): string {
  return url.split("?")[0] ?? url;
}
