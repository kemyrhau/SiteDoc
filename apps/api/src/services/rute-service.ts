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

const NOMINATIM_BASE_URL =
  process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org";
const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";

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
