// Lagringsstatistikk — delt, ren aggregeringslogikk (testbar, Prisma-agnostisk).
// Server henter rå rader (fil-modeller + prosjekt→firma-kobling) og kaller disse;
// UI og eksport reimplementerer aldri summeringen.
//
// Fem fil-modeller (packages/db). Fire når prosjekt direkte/ett hopp; `images` har
// INGEN projectId og kobles via checklist/task (begge FK ON DELETE SET NULL) — en
// slettet sjekkliste/oppgave nuller koblingen, og bildet blir FORELDRELØST
// (projectId=null her). Foreldreløse er reell diskbruk (24 % i prod 2026-08-11) men
// kan ikke attribueres til prosjekt/firma → aldri fakturerbare, men med i diskbruk.

export type LagringModell =
  | "images"
  | "drawings"
  | "drawing_revisions"
  | "point_clouds"
  | "ftd_documents";

export const LAGRING_MODELLER: readonly LagringModell[] = [
  "images",
  "drawings",
  "drawing_revisions",
  "point_clouds",
  "ftd_documents",
] as const;

/**
 * Grov snitt-DB-rad-størrelse per modell (Postgres-metadata-fotavtrykk, IKKE
 * fil-bytes). KUN for «DB-volum (estimat)»-sekundærtallet — bevisst konservativt,
 * aldri fakturert. Fil-lagringen prises på faktisk `file_size`-SUM, ikke dette.
 */
export const DB_SNITT_BYTES: Record<LagringModell, number> = {
  images: 400,
  drawings: 600,
  drawing_revisions: 400,
  point_clouds: 600,
  ftd_documents: 800,
};

/** Én normalisert rad inn i aggregeringen. projectId=null = foreldreløs. */
export interface LagringRad {
  modell: LagringModell;
  /** null = ikke knyttet til prosjekt (foreldreløst bilde). */
  projectId: string | null;
  /** file_size i bytes; 0 hvis kolonnen er null (drift-sikring). */
  bytes: number;
  /**
   * false = file_size var NULL (ukjent størrelse, IKKE 0). Raden teller som fil
   * (antall +1) men bidrar 0 til volumet — dekningsgraden synliggjør gapet, ellers
   * ser summen komplett ut mens den skjuler ukjent volum. Drawings kan produsere
   * NULL (DWG-layouts uten målt størrelse); Image er alltid målt (NOT NULL).
   */
  maaltStorrelse: boolean;
}

export interface ModellSum {
  bytes: number;
  antall: number;
}

/** Aggregat per prosjekt. projectId=null = foreldreløs-bøtta. */
export interface ProsjektAggregat {
  projectId: string | null;
  perModell: Record<LagringModell, ModellSum>;
  totalBytes: number;
  totalAntall: number;
}

/** Tom per-modell-sum (alle modeller på 0). */
export function tomModellSum(): Record<LagringModell, ModellSum> {
  return {
    images: { bytes: 0, antall: 0 },
    drawings: { bytes: 0, antall: 0 },
    drawing_revisions: { bytes: 0, antall: 0 },
    point_clouds: { bytes: 0, antall: 0 },
    ftd_documents: { bytes: 0, antall: 0 },
  };
}

/**
 * Aggreger rå rader per prosjekt (og per modell). Foreldreløse samles under én
 * post med projectId=null. Deterministisk: én ProsjektAggregat per distinkt
 * projectId (inkl. null hvis det finnes foreldreløse rader).
 */
export function aggregerLagring(rader: LagringRad[]): ProsjektAggregat[] {
  const perProsjekt = new Map<string | null, ProsjektAggregat>();
  for (const rad of rader) {
    let agg = perProsjekt.get(rad.projectId);
    if (!agg) {
      agg = {
        projectId: rad.projectId,
        perModell: tomModellSum(),
        totalBytes: 0,
        totalAntall: 0,
      };
      perProsjekt.set(rad.projectId, agg);
    }
    const bytes = rad.bytes > 0 ? rad.bytes : 0;
    agg.perModell[rad.modell].bytes += bytes;
    agg.perModell[rad.modell].antall += 1;
    agg.totalBytes += bytes;
    agg.totalAntall += 1;
  }
  return [...perProsjekt.values()];
}

/**
 * DB-volum-estimat (bytes) for et sett rader — sekundærtall. Σ over modeller av
 * antall × DB_SNITT_BYTES. Aldri fakturert; kun kapasitets-indikator.
 */
export function dbVolumEstimatBytes(rader: LagringRad[]): number {
  let sum = 0;
  for (const rad of rader) {
    sum += DB_SNITT_BYTES[rad.modell];
  }
  return sum;
}

/**
 * Antall rader med UMÅLT størrelse (file_size NULL) per modell. Dekningsgrad-
 * grunnlaget: fabels regel er at fakturering mot volumet krever 100 % dekning.
 * Vises som restpost når > 0, aldri gjemt bort.
 */
export function manglerStorrelsePerModell(
  rader: LagringRad[],
): Record<LagringModell, number> {
  const ut: Record<LagringModell, number> = {
    images: 0,
    drawings: 0,
    drawing_revisions: 0,
    point_clouds: 0,
    ftd_documents: 0,
  };
  for (const rad of rader) {
    if (!rad.maaltStorrelse) ut[rad.modell] += 1;
  }
  return ut;
}

/** Menneskelesbar bytes → «11,3 MB» (norsk desimalkomma). Delt web/admin-flate. */
export function formaterBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace(".", ",")} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1).replace(".", ",")} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2).replace(".", ",")} GB`;
}
