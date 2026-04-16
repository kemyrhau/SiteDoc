import { prisma } from "@sitedoc/db";

/**
 * Returnerer liste med folder-IDer brukeren har tilgang til.
 * null = tilgang til alt (admin / feltarbeid-admin)
 */
export async function hentTilgjengeligeMappeIder(
  userId: string,
  projectId: string,
): Promise<string[] | null> {
  // 1. Sjekk om bruker er sitedoc_admin
  const bruker = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (bruker?.role === "sitedoc_admin") return null;

  // 2. Sjekk prosjektmedlemskap og rolle
  const medlem = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: {
      faggruppeKoblinger: { select: { faggruppeId: true } },
      groupMemberships: {
        include: {
          group: { select: { id: true, slug: true } },
        },
      },
    },
  });
  if (!medlem) return [];

  // Prosjektadmin ser alt
  if (medlem.role === "admin" || medlem.role === "owner") return null;

  // 3. Feltarbeid-admin ser alt
  const erFeltarbeidAdmin = medlem.groupMemberships.some(
    (gm) => gm.group.slug === "feltarbeid-admin",
  );
  if (erFeltarbeidAdmin) return null;

  // 4. Finn mapper via FolderAccess (direkte + gruppe + faggruppe)
  const gruppeIder = medlem.groupMemberships.map((gm) => gm.group.id);
  const faggruppeIder = medlem.faggruppeKoblinger.map((e) => e.faggruppeId);

  // Hent alle mapper i prosjektet med accessEntries
  const mapper = await prisma.folder.findMany({
    where: { projectId },
    include: {
      accessEntries: true,
    },
  });

  // Bygg hierarki og beregn tilgang
  const tilgjengelige = new Set<string>();

  for (const mappe of mapper) {
    if (mappe.accessMode === "inherit") {
      // Arv — vi må sjekke forelder. Hvis root med inherit → åpen for alle
      const harCustomForelder = harCustomAncestor(mappe.id, mapper);
      if (!harCustomForelder) {
        tilgjengelige.add(mappe.id);
        continue;
      }
      // Sjekk om noen forelder med custom gir tilgang
      if (
        harTilgangViaAncestor(
          mappe.id,
          mapper,
          userId,
          gruppeIder,
          faggruppeIder,
        )
      ) {
        tilgjengelige.add(mappe.id);
      }
    } else {
      // Custom — sjekk direkte accessEntries
      if (
        harDirekteTilgang(
          mappe.accessEntries,
          userId,
          gruppeIder,
          faggruppeIder,
        )
      ) {
        tilgjengelige.add(mappe.id);
      }
    }
  }

  return [...tilgjengelige];
}

interface MappeEntry {
  id: string;
  parentId: string | null;
  accessMode: string;
  accessEntries: {
    accessType: string;
    faggruppeId: string | null;
    groupId: string | null;
    userId: string | null;
  }[];
}

function harCustomAncestor(mappeId: string, mapper: MappeEntry[]): boolean {
  const mappe = mapper.find((m) => m.id === mappeId);
  if (!mappe || !mappe.parentId) return false;
  const forelder = mapper.find((m) => m.id === mappe.parentId);
  if (!forelder) return false;
  if (forelder.accessMode === "custom") return true;
  return harCustomAncestor(forelder.id, mapper);
}

function harTilgangViaAncestor(
  mappeId: string,
  mapper: MappeEntry[],
  userId: string,
  gruppeIder: string[],
  faggruppeIder: string[],
): boolean {
  const mappe = mapper.find((m) => m.id === mappeId);
  if (!mappe || !mappe.parentId) return true; // Root med inherit → åpen
  const forelder = mapper.find((m) => m.id === mappe.parentId);
  if (!forelder) return true;
  if (forelder.accessMode === "custom") {
    return harDirekteTilgang(
      forelder.accessEntries,
      userId,
      gruppeIder,
      faggruppeIder,
    );
  }
  return harTilgangViaAncestor(
    forelder.id,
    mapper,
    userId,
    gruppeIder,
    faggruppeIder,
  );
}

function harDirekteTilgang(
  entries: MappeEntry["accessEntries"],
  userId: string,
  gruppeIder: string[],
  faggruppeIder: string[],
): boolean {
  return entries.some((entry) => {
    if (entry.accessType === "user" && entry.userId === userId) return true;
    if (
      entry.accessType === "group" &&
      entry.groupId &&
      gruppeIder.includes(entry.groupId)
    )
      return true;
    if (
      entry.accessType === "faggruppe" &&
      entry.faggruppeId &&
      faggruppeIder.includes(entry.faggruppeId)
    )
      return true;
    return false;
  });
}

/**
 * Bygger Prisma WHERE-filter for FtdDocument basert på mappetilgang.
 */
export function byggMappeTilgangsFilter(
  mappeIder: string[] | null,
): Record<string, unknown> {
  if (mappeIder === null) return {}; // Admin — ingen filter
  return { folderId: { in: mappeIder } };
}
