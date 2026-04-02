import type { PrismaClient } from "@sitedoc/db";

interface SpråkMappe {
  id: string;
  parentId: string | null;
  languageMode: string;
  languages: string[];
}

export interface EffektiveSpråk {
  languages: string[];
  /** ID-en til mappen som faktisk definerer språkene (null = prosjektstandard) */
  kildeMappeId: string | null;
  /** Om denne mappen arver eller har egne innstillinger */
  arvet: boolean;
}

/**
 * Hent effektive målspråk for en mappe.
 * Går opp foreldrekjeden til den finner en mappe med languageMode = "custom".
 * Hvis ingen finnes → standard (kun kildespråk fra prosjektet).
 *
 * Kildespråk defineres på prosjektnivå, ikke per mappe.
 */
export async function hentEffektiveSpråk(
  prisma: PrismaClient,
  mappeId: string,
): Promise<EffektiveSpråk> {
  const mappe = await prisma.folder.findUnique({
    where: { id: mappeId },
    select: { projectId: true },
  });
  if (!mappe) return { languages: ["nb"], kildeMappeId: null, arvet: false };

  const mapper = await prisma.folder.findMany({
    where: { projectId: mappe.projectId },
    select: {
      id: true,
      parentId: true,
      languageMode: true,
      languages: true,
    },
  });

  return resolverSpråk(mappeId, mapper);
}

/**
 * Resolver målspråk fra en flat liste med mapper.
 */
export function resolverSpråk(
  mappeId: string,
  mapper: SpråkMappe[],
): EffektiveSpråk {
  const mappe = mapper.find((m) => m.id === mappeId);
  if (!mappe) return { languages: ["nb"], kildeMappeId: null, arvet: false };

  if (mappe.languageMode === "custom") {
    return {
      languages: mappe.languages.length > 0 ? mappe.languages : ["nb"],
      kildeMappeId: mappe.id,
      arvet: false,
    };
  }

  if (mappe.parentId) {
    const foreldreResultat = resolverSpråk(mappe.parentId, mapper);
    return { ...foreldreResultat, arvet: true };
  }

  // Rot med inherit → kun prosjektets kildespråk
  return { languages: ["nb"], kildeMappeId: null, arvet: true };
}

/**
 * Beregn effektive målspråk for alle mapper i ett prosjekt (batch).
 */
export function resolverAlleSpråk(
  mapper: SpråkMappe[],
): Map<string, EffektiveSpråk> {
  const cache = new Map<string, EffektiveSpråk>();

  function resolver(mappeId: string): EffektiveSpråk {
    if (cache.has(mappeId)) return cache.get(mappeId)!;
    const result = resolverSpråk(mappeId, mapper);
    cache.set(mappeId, result);
    return result;
  }

  for (const mappe of mapper) {
    resolver(mappe.id);
  }

  return cache;
}
