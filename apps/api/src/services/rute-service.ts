/**
 * Rute-service — keyless geokoding + kjøretid-matrise bak et provider-grensesnitt.
 *
 * R1 (reisetid-matrise): grunnmur. Ingen kallere ennå — R2 (kontor-geokoding),
 * R3 (recompute-motor) og R4 (oppslag) kobler på.
 *
 * Provider-abstraksjon: public OpenStreetMap-tjenester som default — Nominatim
 * for geokoding, OSRM `/table` for kjøretid. Begge keyless. Bytte til selvhostet
 * (server-ny, som embedding-/oversettelse-tjenestene) skjer ved å sette
 * OSRM_BASE_URL / NOMINATIM_BASE_URL — ingen kode- eller kallerendring. Vi leser
 * kun process.env med public fallback; rører ingen .env-fil.
 *
 * Feilfilosofi: matrisen er en forslag-cache, ALDRI kritisk sti. Alle feil
 * (timeout, nettverk, 0 treff, ugyldig svar) → null. Kaster aldri i kallestien.
 */

export interface Coord {
  lat: number;
  lng: number;
}

/** Ett adressesøk-treff til klikkbar treffliste (Kartverket/Geonorge). */
export interface AdresseTreff {
  lat: number;
  lng: number;
  label: string;
}

const NOMINATIM_BASE_URL =
  process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org";
const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";
// Kartverket/Geonorge adressesøk — norsk, keyless, tolerant for upresis skriving.
const GEONORGE_ADRESSE_URL =
  process.env.GEONORGE_ADRESSE_URL ?? "https://ws.geonorge.no/adresser/v1/sok";

// Nominatim-policy krever en identifiserende User-Agent.
const USER_AGENT = "SiteDoc/1.0 (+https://sitedoc.no)";

const GEOKOD_TIMEOUT_MS = 5000;
const MATRISE_TIMEOUT_MS = 8000;

/** Celle-verdi for et uoppnåelig kontor→byggeplass-par i matrisen. */
export const UOPPNAAELIG = -1;

/** fetch med timeout via AbortController. Returnerer null ved enhver feil. */
async function fetchMedTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

interface RuteProvider {
  geokod(adresse: string): Promise<Coord | null>;
  matrise(fra: Coord[], til: Coord[]): Promise<number[][] | null>;
}

const osmProvider: RuteProvider = {
  async geokod(adresse) {
    const url = `${NOMINATIM_BASE_URL}/search?format=json&limit=1&q=${encodeURIComponent(
      adresse,
    )}`;
    const res = await fetchMedTimeout(url, GEOKOD_TIMEOUT_MS);
    if (!res || !res.ok) return null;
    try {
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      if (!Array.isArray(data) || data.length === 0) return null;
      const lat = Number(data[0]?.lat);
      const lng = Number(data[0]?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    } catch {
      return null;
    }
  },

  async matrise(fra, til) {
    if (fra.length === 0 || til.length === 0) return null;
    // OSRM forventer «lng,lat»-rekkefølge. Kontorer (sources) først, byggeplasser
    // (destinations) sist i samme koordinat-liste — ett kall dekker hele matrisen.
    const alle = [...fra, ...til];
    const coordStr = alle.map((c) => `${c.lng},${c.lat}`).join(";");
    const sources = fra.map((_, i) => i).join(";");
    const destinations = til.map((_, i) => fra.length + i).join(";");
    const url = `${OSRM_BASE_URL}/table/v1/driving/${coordStr}?sources=${sources}&destinations=${destinations}&annotations=duration`;
    const res = await fetchMedTimeout(url, MATRISE_TIMEOUT_MS);
    if (!res || !res.ok) return null;
    try {
      const data = (await res.json()) as {
        code?: string;
        durations?: Array<Array<number | null>>;
      };
      if (data.code !== "Ok" || !Array.isArray(data.durations)) return null;
      // Sekunder → minutter, avrundet. Uoppnåelige par (null) → UOPPNAAELIG.
      return data.durations.map((rad) =>
        rad.map((sek) => (sek == null ? UOPPNAAELIG : Math.round(sek / 60))),
      );
    } catch {
      return null;
    }
  },
};

const provider: RuteProvider = osmProvider;

/**
 * Geokod en adresse → koordinat. Returnerer null ved feil eller 0 treff.
 */
export async function geokodAdresse(adresse: string): Promise<Coord | null> {
  const trimmet = adresse.trim();
  if (!trimmet) return null;
  return provider.geokod(trimmet);
}

/**
 * Adressesøk mot Kartverket/Geonorge — tolerant for delvis/upresis skriving
 * (`fuzzy=true`). Returnerer inntil `maks` treff med visningsetikett til en
 * klikkbar treffliste. Kaster aldri; tom liste ved feil/timeout/0 treff.
 * Åpne adressedata © Kartverket (Geonorge).
 */
export async function sokAdresser(adresse: string, maks = 5): Promise<AdresseTreff[]> {
  const trimmet = adresse.trim();
  if (!trimmet) return [];
  const url = `${GEONORGE_ADRESSE_URL}?sok=${encodeURIComponent(
    trimmet,
  )}&fuzzy=true&treffPerSide=${maks}&side=0`;
  const res = await fetchMedTimeout(url, GEOKOD_TIMEOUT_MS);
  if (!res || !res.ok) return [];
  try {
    const data = (await res.json()) as {
      adresser?: Array<{
        adressetekst?: string;
        postnummer?: string;
        poststed?: string;
        representasjonspunkt?: { lat?: number; lon?: number };
      }>;
    };
    if (!Array.isArray(data.adresser)) return [];
    const treff: AdresseTreff[] = [];
    for (const a of data.adresser) {
      const lat = Number(a.representasjonspunkt?.lat);
      const lng = Number(a.representasjonspunkt?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const poststed = [a.postnummer, a.poststed].filter(Boolean).join(" ");
      const label = [a.adressetekst, poststed].filter(Boolean).join(", ");
      treff.push({ lat, lng, label: label || a.adressetekst || `${lat}, ${lng}` });
      if (treff.length >= maks) break;
    }
    return treff;
  } catch {
    return [];
  }
}

/**
 * Kjøretid-matrise (minutter) fra hvert «fra»-punkt til hvert «til»-punkt.
 * Returnerer durations[fra][til]; UOPPNAAELIG (-1) for uoppnåelige par; null ved
 * feil. Kaster aldri — matrisen er forslag-cache, ikke kritisk sti.
 */
export async function hentKjoretidMatrise(
  fra: Coord[],
  til: Coord[],
): Promise<number[][] | null> {
  return provider.matrise(fra, til);
}
