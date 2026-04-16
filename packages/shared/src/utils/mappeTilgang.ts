/**
 * Beregn synlige mapper basert på tilgangsregler med arv.
 *
 * Logikk:
 * - Admin ser alt
 * - accessMode "custom" → sjekk om bruker matcher en oppføring (faggruppe, gruppe, bruker-ID)
 * - accessMode "inherit" → gå oppover i foreldrekjeden til første "custom"-mappe
 * - Rotmappe med "inherit" uten forelder = åpen for alle
 * - Foreldre-mapper til synlige barn inkluderes alltid (for å bevare treet), men markeres som "kun sti"
 */

export interface MappeTilgangInput {
  id: string;
  parentId: string | null;
  accessMode: string; // "inherit" | "custom"
  accessEntries: Array<{
    accessType: string; // "faggruppe" | "group" | "user"
    faggruppeId: string | null;
    groupId: string | null;
    userId: string | null;
  }>;
}

export interface BrukerTilgangInfo {
  userId: string;
  erAdmin: boolean;
  faggruppeIder: string[];
  gruppeIder: string[];
}

export interface SynligeMapperResultat {
  synlige: Set<string>;
  kunSti: Set<string>;
}

export function beregnSynligeMapper(
  mapper: MappeTilgangInput[],
  bruker: BrukerTilgangInfo,
): SynligeMapperResultat {
  // Admin ser alt
  if (bruker.erAdmin) {
    const alle = new Set(mapper.map((m) => m.id));
    return { synlige: alle, kunSti: new Set() };
  }

  const mappeMap = new Map<string, MappeTilgangInput>();
  for (const m of mapper) {
    mappeMap.set(m.id, m);
  }

  // Cache for oppløst tilgang per mappe
  const tilgangCache = new Map<string, boolean>();

  function harTilgang(mappeId: string): boolean {
    if (tilgangCache.has(mappeId)) {
      return tilgangCache.get(mappeId)!;
    }

    // Marker som under oppløsning for å unngå sirkulære referanser
    tilgangCache.set(mappeId, false);

    const mappe = mappeMap.get(mappeId);
    if (!mappe) {
      return false;
    }

    let resultat: boolean;

    if (mappe.accessMode === "custom") {
      // Sjekk om bruker matcher noen oppføring
      resultat = mappe.accessEntries.some((entry) => {
        if (entry.accessType === "faggruppe" && entry.faggruppeId) {
          return bruker.faggruppeIder.includes(entry.faggruppeId);
        }
        if (entry.accessType === "group" && entry.groupId) {
          return bruker.gruppeIder.includes(entry.groupId);
        }
        if (entry.accessType === "user" && entry.userId) {
          return entry.userId === bruker.userId;
        }
        return false;
      });
    } else {
      // inherit → gå oppover
      if (mappe.parentId) {
        resultat = harTilgang(mappe.parentId);
      } else {
        // Rotmappe med inherit = åpen for alle
        resultat = true;
      }
    }

    tilgangCache.set(mappeId, resultat);
    return resultat;
  }

  const synlige = new Set<string>();
  const kunSti = new Set<string>();

  for (const mappe of mapper) {
    if (harTilgang(mappe.id)) {
      synlige.add(mappe.id);
    }
  }

  // Legg til foreldremapper som sti (for å bevare trestrukturen)
  for (const id of synlige) {
    let current = mappeMap.get(id);
    while (current?.parentId) {
      if (synlige.has(current.parentId)) break; // Allerede synlig
      if (kunSti.has(current.parentId)) break; // Allerede markert
      kunSti.add(current.parentId);
      current = mappeMap.get(current.parentId);
    }
  }

  return { synlige, kunSti };
}
