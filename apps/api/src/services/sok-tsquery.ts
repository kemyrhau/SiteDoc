import { Prisma } from "@sitedoc/db";

// SØK-2 punkt 6 (Kenneth 2026-11-11): søket skal gi mest mulig korrekte treff. Hele ord
// (`plainto_tsquery`) først; ordbegynnelser (`term:*`) bare når hele ord gir 0 treff. Da finner
// «adgangskontr» «Adgangskontroll», mens «sikkerhet» ikke drar med «sikkerhetstiltak». `term:*`
// bruker samme GIN-indeks på `search_vector` — ingen migrering.

/** Kortere fragmenter får ikke `:*` — «a» skulle ellers treffe halve korpuset. */
export const MIN_PREFIKS_TEGN = 3;

/**
 * Ren: søkestreng → `term1:* & term2:*`, eller null når ingen term er lang nok. Splitter på alt som
 * ikke er bokstav/tall, så tsquery-operatorer (`& | ! ( ) : * '`) aldri når `to_tsquery`.
 */
export function prefiksTsqueryStreng(query: string): string | null {
  const termer = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= MIN_PREFIKS_TEGN);
  if (termer.length === 0) return null;
  return termer.map((t) => `${t}:*`).join(" & ");
}

/** Hele ord — dagens match, og første trinn i `helordFoerPrefiks`. */
export function helordTsquery(query: string): Prisma.Sql {
  return Prisma.sql`plainto_tsquery('norwegian', ${query})`;
}

/** Bare ordbegynnelser, eller null når ingen term er lang nok. */
export function prefiksTsquery(query: string): Prisma.Sql | null {
  const prefiks = prefiksTsqueryStreng(query);
  return prefiks ? Prisma.sql`to_tsquery('norwegian', ${prefiks})` : null;
}

/**
 * Kjører `sok` med hele ord; gir det 0 rader, én gang til med ordbegynnelser. `tq` er tsquery-en
 * radene kom fra (til ts_headline), `prefiks` sier om det var prefiks-trinnet.
 */
export async function helordFoerPrefiks<T>(
  query: string,
  sok: (tq: Prisma.Sql) => Promise<T[]>,
): Promise<{ rader: T[]; tq: Prisma.Sql; prefiks: boolean }> {
  const helord = helordTsquery(query);
  const rader = await sok(helord);
  const prefiks = rader.length === 0 ? prefiksTsquery(query) : null;
  if (!prefiks) return { rader, tq: helord, prefiks: false };
  return { rader: await sok(prefiks), tq: prefiks, prefiks: true };
}
