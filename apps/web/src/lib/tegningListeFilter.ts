import { DRAWING_STATUSES, utledKildeformat } from "@sitedoc/shared";

/**
 * Metadata S-pakke B-5: filter for tegningslista (web `TegningerPanel`). Status,
 * kildeformat og georeferert. Et filter vises bare når lista har minst to ulike
 * verdier å velge mellom (samme regel som `visFilterKolonne` på mobil), eller når
 * det alt er satt. Eldre API uten feltene gir én verdi (tom) → filteret skjules.
 */

export interface TegningMetadataRad {
  status?: string | null;
  fileType?: string | null;
  originalFileUrl?: string | null;
  geoReference?: unknown;
}

export type GeorefValg = "" | "ja" | "nei";

export interface TegningFilter {
  status: string;
  kildeformat: string;
  georef: GeorefValg;
}

export const TOMT_TEGNING_FILTER: TegningFilter = { status: "", kildeformat: "", georef: "" };

export function tegningFilterAktivt(f: TegningFilter): boolean {
  return !!f.status || !!f.kildeformat || !!f.georef;
}

export function filtrerTegningerPaaMetadata<T extends TegningMetadataRad>(
  tegninger: T[],
  f: TegningFilter,
): T[] {
  if (!tegningFilterAktivt(f)) return tegninger;
  return tegninger.filter((tg) => {
    if (f.status && tg.status !== f.status) return false;
    if (f.kildeformat && utledKildeformat(tg.originalFileUrl, tg.fileType) !== f.kildeformat) return false;
    if (f.georef === "ja" && tg.geoReference == null) return false;
    if (f.georef === "nei" && tg.geoReference != null) return false;
    return true;
  });
}

export interface TegningFilterAlternativer {
  status: string[];
  kildeformat: string[];
  georef: boolean;
}

/** Valg som finnes i lista. Status i fast rekkefølge (`DRAWING_STATUSES`), formater A–Å. */
export function tegningFilterAlternativer(tegninger: TegningMetadataRad[]): TegningFilterAlternativer {
  const statuser = new Set<string>();
  const formater = new Set<string>();
  let med = false;
  let uten = false;
  for (const tg of tegninger) {
    if (tg.status) statuser.add(tg.status);
    const kf = utledKildeformat(tg.originalFileUrl, tg.fileType);
    if (kf) formater.add(kf);
    if (tg.geoReference != null) med = true;
    else uten = true;
  }
  return {
    status: (DRAWING_STATUSES as readonly string[]).filter((s) => statuser.has(s)),
    kildeformat: [...formater].sort(),
    georef: med && uten,
  };
}

/** Synlig når det finnes noe å velge mellom, eller filteret alt er satt. */
export function visTegningFilter(alternativer: string[], verdi: string): boolean {
  return alternativer.length >= 2 || !!verdi;
}
