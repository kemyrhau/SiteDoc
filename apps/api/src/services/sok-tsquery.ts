import { Prisma } from "@sitedoc/db";

// SØK-2 punkt 6 (Kenneth 2026-11-11): tekstsøket matcher ordbegynnelser, ikke bare hele ord.
// «adgangskontr» finner «Adgangskontroll». Hele ord (`plainto_tsquery`) matcher som før, og
// rangeres alltid foran rene prefiks-treff (helords-klassen først i ORDER BY). `term:*` bruker
// samme GIN-indeks på `search_vector` — ingen migrering.

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

/** Hele ord — dagens match. Brukes også som helords-klasse i rangeringen. */
export function helordTsquery(query: string): Prisma.Sql {
  return Prisma.sql`plainto_tsquery('norwegian', ${query})`;
}

/** Hele ord ELLER ordbegynnelser. Faller til `helordTsquery` når prefiks-delen er tom. */
export function tekstTsquery(query: string): Prisma.Sql {
  const prefiks = prefiksTsqueryStreng(query);
  if (!prefiks) return helordTsquery(query);
  return Prisma.sql`(plainto_tsquery('norwegian', ${query}) || to_tsquery('norwegian', ${prefiks}))`;
}
