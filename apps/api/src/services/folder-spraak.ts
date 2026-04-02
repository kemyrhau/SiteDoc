import type { PrismaClient } from "@sitedoc/db";

interface SpråkMappe {
  id: string;
  parentId: string | null;
  languageMode: string;
  languages: string[];
}

export interface EffektiveSpråk {
  languages: string[];
  kildeMappeId: string | null;
  arvet: boolean;
}

const STANDARD: EffektiveSpråk = { languages: ["nb"], kildeMappeId: null, arvet: true };

/**
 * Hent effektive målspråk for en mappe.
 * Går opp foreldrekjeden til den finner en mappe med languageMode = "custom".
 */
export async function hentEffektiveSpråk(
  prisma: PrismaClient,
  mappeId: string,
): Promise<EffektiveSpråk> {
  const mappe = await prisma.folder.findUnique({
    where: { id: mappeId },
    select: { projectId: true },
  });
  if (!mappe) return STANDARD;

  const mapper = await prisma.folder.findMany({
    where: { projectId: mappe.projectId },
    select: { id: true, parentId: true, languageMode: true, languages: true },
  });

  return resolverSpråk(mappeId, mapper);
}

/**
 * Resolver målspråk fra en flat liste med mapper.
 * Beskyttet mot sirkulære referanser via visited-set.
 */
export function resolverSpråk(
  mappeId: string,
  mapper: SpråkMappe[],
  besøkt?: Set<string>,
): EffektiveSpråk {
  const visited = besøkt ?? new Set<string>();

  // Syklusdeteksjon
  if (visited.has(mappeId)) return STANDARD;
  visited.add(mappeId);

  const mappe = mapper.find((m) => m.id === mappeId);
  if (!mappe) return STANDARD;

  if (mappe.languageMode === "custom") {
    return {
      languages: mappe.languages.length > 0 ? mappe.languages : ["nb"],
      kildeMappeId: mappe.id,
      arvet: false,
    };
  }

  if (mappe.parentId) {
    const foreldreResultat = resolverSpråk(mappe.parentId, mapper, visited);
    return { ...foreldreResultat, arvet: true };
  }

  return STANDARD;
}

/**
 * Beregn effektive målspråk for alle mapper i ett prosjekt (batch).
 */
export function resolverAlleSpråk(
  mapper: SpråkMappe[],
): Map<string, EffektiveSpråk> {
  const cache = new Map<string, EffektiveSpråk>();

  for (const mappe of mapper) {
    if (!cache.has(mappe.id)) {
      cache.set(mappe.id, resolverSpråk(mappe.id, mapper));
    }
  }

  return cache;
}
