/**
 * IFC-råfil pr. modell i mobil-vieweren (M5 (1)).
 *
 * Objektinfo (egenskaper) og skjuling av IfcSpace/IfcOpening leses fra IFC-råfila
 * med web-ifc. Når modellen lastes fra fragment-cachen finnes ingen råfil, så den
 * hentes i bakgrunnen etter at modellen vises. Et tapp før råfila er kommet venter
 * på den i stedet for å vise tom objektinfo.
 */

export type RaadataLager = {
  /** Legg inn råfil som allerede er lastet (IFC-veien). */
  sett: (modelId: string, data: Uint8Array) => void;
  /** Start bakgrunnshenting (cache-veien). Feil gir null — vieweren virker videre uten egenskaper. */
  hentIBakgrunn: (modelId: string, hent: () => Promise<Uint8Array>) => Promise<Uint8Array | null>;
  /** Råfil for modellen; venter på pågående bakgrunnshenting. null hvis ingen finnes. */
  hent: (modelId: string) => Promise<Uint8Array | null>;
};

export function lagRaadataLager(): RaadataLager {
  const lager = new Map<string, Promise<Uint8Array | null>>();
  return {
    sett(modelId, data) {
      lager.set(modelId, Promise.resolve(data));
    },
    hentIBakgrunn(modelId, hent) {
      const løfte = hent().catch(() => null);
      lager.set(modelId, løfte);
      return løfte;
    },
    async hent(modelId) {
      return (await lager.get(modelId)) ?? null;
    },
  };
}

/** Hent IFC-fila med samme URL og token som IFC-veien. */
export async function hentIfcRaadata(url: string, token: string | undefined): Promise<Uint8Array> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** web-ifc `getItemProperties` → flate attributter ({ value } pakkes ut, tomme verdier droppes). */
export function lesAttributter(itemProps: Record<string, unknown> | null): Record<string, unknown> {
  const attributter: Record<string, unknown> = {};
  if (!itemProps) return attributter;
  for (const [k, v] of Object.entries(itemProps)) {
    if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
      const val = (v as { value: unknown }).value;
      if (val != null && val !== "") attributter[k] = val;
    }
  }
  return attributter;
}
