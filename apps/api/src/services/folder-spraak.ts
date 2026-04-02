import type { PrismaClient } from "@sitedoc/db";

interface SpråkMappe {
  id: string;
  parentId: string | null;
  languageMode: string;
  languages: string[];
  sourceLanguage: string;
}

export interface EffektiveSpråk {
  languages: string[];
  sourceLanguage: string;
  /** ID-en til mappen som faktisk definerer språkene (null = prosjektstandard) */
  kildeMappeId: string | null;
  /** Om denne mappen arver eller har egne innstillinger */
  arvet: boolean;
}

/**
 * Hent effektive språkinnstillinger for en mappe.
 * Går opp foreldrekjeden til den finner en mappe med languageMode = "custom".
 * Hvis ingen finnes → standard (["nb"], "nb").
 */
export async function hentEffektiveSpråk(
  prisma: PrismaClient,
  mappeId: string,
): Promise<EffektiveSpråk> {
  // Hent alle mapper i prosjektet (samme mønster som tilgangskontroll)
  const mappe = await prisma.folder.findUnique({
    where: { id: mappeId },
    select: { projectId: true },
  });
  if (!mappe) return { languages: ["nb"], sourceLanguage: "nb", kildeMappeId: null, arvet: false };

  const mapper = await prisma.folder.findMany({
    where: { projectId: mappe.projectId },
    select: {
      id: true,
      parentId: true,
      languageMode: true,
      languages: true,
      sourceLanguage: true,
    },
  });

  return resolverSpråk(mappeId, mapper);
}

/**
 * Resolver språkinnstillinger fra en flat liste med mapper.
 * Kan brukes direkte når mappelisten allerede er hentet.
 */
export function resolverSpråk(
  mappeId: string,
  mapper: SpråkMappe[],
): EffektiveSpråk {
  const mappe = mapper.find((m) => m.id === mappeId);
  if (!mappe) return { languages: ["nb"], sourceLanguage: "nb", kildeMappeId: null, arvet: false };

  // Custom → bruk egne innstillinger
  if (mappe.languageMode === "custom") {
    return {
      languages: mappe.languages.length > 0 ? mappe.languages : ["nb"],
      sourceLanguage: mappe.sourceLanguage ?? "nb",
      kildeMappeId: mappe.id,
      arvet: false,
    };
  }

  // Inherit → gå opp til forelder
  if (mappe.parentId) {
    const foreldreResultat = resolverSpråk(mappe.parentId, mapper);
    return {
      ...foreldreResultat,
      arvet: true,
    };
  }

  // Rot med inherit → prosjektstandard
  return { languages: ["nb"], sourceLanguage: "nb", kildeMappeId: null, arvet: true };
}

/**
 * Beregn effektive språk for alle mapper i ett prosjekt (batch).
 * Returnerer Map<mappeId, EffektiveSpråk>.
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
