import type { PrismaClient } from "@sitedoc/db";

/**
 * Delte hjelpere for den firmaorienterte admin-oversikten (1a firmaliste + 1b
 * firma-detaljside). Ligger i api-laget så liste og detaljside bruker SAMME
 * klassifisering og aktivitet-oppslag — ingen inline-logikk i sidene.
 * Ordre: docs/claude/delplaner/admin-firmaorientert-oversikt-ordre-2026-07-26.md
 */

// FASE 1 (2026-07-27): kun "kunde". hentAlleOrganisasjoner filtrerer allerede
// erKunde=true, så alle firmaer i admin-vyen er kunder. Prøve/Skall innføres av
// firma-produktmodell-ordren — behold som union så utvidelsen skjer ett sted.
export type FirmaStatus = "kunde";

/**
 * Klassifiser firma-status for admin-oversikten. Fabel-gate 2026-07-27:
 * kun Kunde-status i fase 1 (§7.1).
 */
export function klassifiserFirmaStatus(_org: { erKunde: boolean }): FirmaStatus {
  return "kunde";
}

/**
 * Sist aktivitet per firma: Activity.createdAt (primær) med Project.updatedAt
 * (fallback når firmaet ikke har Activity-rader). Activity skrives i dag kun av
 * timer/varelager/vareImport — updatedAt fanger øvrige prosjekt-endringer.
 * Kun kolonne-signal (fabel-gate §5) — ingen inaktiv-badge. `null` = intet
 * signal (vises som «—»). Batch-oppslag (to groupBy) — trygt < 100 firmaer.
 */
export async function hentFirmaAktivitet(
  prisma: PrismaClient,
  orgIds: string[],
): Promise<Map<string, Date | null>> {
  const resultat = new Map<string, Date | null>();
  if (orgIds.length === 0) return resultat;

  const [aktivitet, prosjekt] = await Promise.all([
    prisma.activity.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: orgIds } },
      _max: { createdAt: true },
    }),
    prisma.project.groupBy({
      by: ["primaryOrganizationId"],
      where: { primaryOrganizationId: { in: orgIds } },
      _max: { updatedAt: true },
    }),
  ]);

  const aktMap = new Map<string, Date | null>();
  for (const a of aktivitet) {
    if (a.organizationId) aktMap.set(a.organizationId, a._max.createdAt);
  }
  const projMap = new Map<string, Date | null>();
  for (const p of prosjekt) {
    if (p.primaryOrganizationId) projMap.set(p.primaryOrganizationId, p._max.updatedAt);
  }

  for (const id of orgIds) {
    resultat.set(id, aktMap.get(id) ?? projMap.get(id) ?? null);
  }
  return resultat;
}

/**
 * Sist aktivitet per prosjekt: Activity.createdAt (primær). updatedAt-fallback
 * håndteres av kaller (prosjekt-raden bærer updatedAt), så merge blir
 * `aktivitet ?? updatedAt` per prosjekt.
 */
export async function hentProsjektAktivitet(
  prisma: PrismaClient,
  projectIds: string[],
): Promise<Map<string, Date | null>> {
  const resultat = new Map<string, Date | null>();
  if (projectIds.length === 0) return resultat;
  const rader = await prisma.activity.groupBy({
    by: ["projectId"],
    where: { projectId: { in: projectIds } },
    _max: { createdAt: true },
  });
  for (const r of rader) {
    if (r.projectId) resultat.set(r.projectId, r._max.createdAt);
  }
  return resultat;
}
