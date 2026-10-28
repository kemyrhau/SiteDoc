import { Prisma } from "@sitedoc/db";

// Mappefilteret for dokumentsøk — ÉN regel for alle kallsteder (firma-admin + tom mappeliste,
// Kenneth 2026-10-28). `mappeIder` kommer fra `hentTilgjengeligeMappeIder`:
//   null → tilgang til alt (ingen filter)
//   []   → ingen mapper: bare dokumenter UTEN mappe. Før ga `Prisma.join([])` en 500.
//   ids  → dokumenter uten mappe + dokumenter i de tilgjengelige mappene.
// Dokumenter uten mappe er synlige for alle prosjektmedlemmer — også i `blokkSok` og `mengde`,
// som før tok dem ut (drift, ikke vedtak; orkestrator 2026-10-28).

/** SQL-klausul for rå spørringer der dokumenttabellen har aliaset `d`. */
export function mappeKlausulSql(mappeIder: string[] | null): Prisma.Sql {
  if (mappeIder === null) return Prisma.empty;
  if (mappeIder.length === 0) return Prisma.sql`AND d.folder_id IS NULL`;
  return Prisma.sql`AND (d.folder_id IS NULL OR d.folder_id IN (${Prisma.join(mappeIder)}))`;
}

/** Prisma-where for `FtdDocument` (spres inn i `where`, eller under `document:` for chunks). */
export function byggMappeTilgangsFilter(
  mappeIder: string[] | null,
): { OR?: Array<{ folderId: null } | { folderId: { in: string[] } }> } {
  if (mappeIder === null) return {};
  return { OR: [{ folderId: null }, { folderId: { in: mappeIder } }] };
}
