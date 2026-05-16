import { eq, and } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { prosjektLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Prosjekt-katalog-cache (T7-3b1 2026-05-14)
 *
 *  Speiler brukerens prosjekter (medlemskap via ProjectMember) lokalt for
 *  offline rad-velger på dagsseddel. Lat/lng brukes av T7-3c for geo-forslag.
 *
 *  Refresh ved login + nett-gjenkomst. Full overskriving — typisk < 100
 *  prosjekter per bruker, ingen delta-sync.
 *
 *  Standalone-prosjekter (primaryOrganizationId = null) hoppes over —
 *  Timer-modulen krever firma-kontekst.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * Last ned brukerens aktive prosjekter fra server og overskriv lokal cache.
 * Idempotent — trygt å kjøre flere ganger.
 */
export async function refreshProsjektKatalog(klient: TrpcKlient): Promise<{
  prosjekter: number;
}> {
  const db = hentDatabase();
  if (!db) return { prosjekter: 0 };

  const prosjekter = await klient.prosjekt.hentMine.query().catch((e) => {
    console.warn("[PROSJEKT-KATALOG] Pull feilet:", e);
    return [] as Array<{
      id: string;
      primaryOrganizationId: string | null;
      name: string;
      projectNumber: string | null;
      latitude: number | null;
      longitude: number | null;
      status: string;
    }>;
  });

  const naa = Date.now();

  db.delete(prosjektLocal).run();
  for (const p of prosjekter) {
    if (!p.primaryOrganizationId) continue; // standalone — Timer krever firma
    db.insert(prosjektLocal)
      .values({
        id: p.id,
        organizationId: p.primaryOrganizationId,
        name: p.name,
        projectNumber: p.projectNumber ?? null,
        lat: p.latitude ?? null,
        lng: p.longitude ?? null,
        aktiv: p.status === "active",
        sistOppdatert: naa,
      })
      .run();
  }

  return { prosjekter: prosjekter.length };
}

/**
 * Synkron lese-funksjon for UI: hent aktive prosjekter for firmaet fra lokal
 * cache. Returnerer tom array hvis cache ikke er populert.
 */
export function hentProsjekterLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(prosjektLocal)
    .where(
      and(
        eq(prosjektLocal.organizationId, organizationId),
        eq(prosjektLocal.aktiv, true),
      ),
    )
    .all();
}

/**
 * Hjelper: finn ett prosjekt fra lokal cache (for å vise navn på rad uten
 * å gå online).
 */
export function finnProsjektLokalt(id: string) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(prosjektLocal)
    .where(eq(prosjektLocal.id, id))
    .all();
  return rader[0] ?? null;
}

/**
 * Utled brukerens unike firma-IDer fra lokal prosjekt-cache. Brukes av
 * TimerSyncProvider til å vite hvilke org-IDer kalenderKatalog og
 * organizationSettingKatalog skal hente for. Returnerer tom array hvis
 * prosjekt-cachen er tom (typisk ved første kjøring offline).
 */
export function hentUnikeFirmaIderLokalt(): string[] {
  const db = hentDatabase();
  if (!db) return [];
  const rader = db
    .select({ organizationId: prosjektLocal.organizationId })
    .from(prosjektLocal)
    .all();
  return Array.from(new Set(rader.map((r) => r.organizationId)));
}
