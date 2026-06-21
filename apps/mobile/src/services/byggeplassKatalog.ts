import { eq } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { byggeplassLocal } from "../db/schema";
import { haversineKm } from "../utils/geo";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Byggeplass-katalog-cache (R4, 2026-06-11)
 *
 *  Speiler firmaets byggeplasser lokalt (kun id/projectId/number/status) for
 *  prosjekt→primær-byggeplass-resolusjon i reisetid-oppslaget. Ingen
 *  koordinater — reisetid-matrisen bærer kjøretiden. KUN lokal, synkes aldri
 *  opp. Full overskriving per firma. Refresh ved login + nett-gjenkomst.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * Last ned firmaets byggeplasser og overskriv lokal cache for dette firmaet.
 * Idempotent — trygt å kjøre flere ganger.
 */
export async function refreshByggeplassKatalog(
  klient: TrpcKlient,
  organizationId: string,
): Promise<{ byggeplasser: number }> {
  const db = hentDatabase();
  if (!db) return { byggeplasser: 0 };

  // Routeren er montert som «bygning» (bakoverkompat-nøkkel, router.ts:53).
  const byggeplasser = await klient.bygning.hentForFirma
    .query({ organizationId })
    .catch((e) => {
      console.warn("[BYGGEPLASS-KATALOG] Pull feilet:", e);
      return [] as Array<{
        id: string;
        projectId: string;
        number: number | null;
        status: string;
        name: string;
        latitude: number | null;
        longitude: number | null;
        radiusM: number | null;
      }>;
    });

  const naa = Date.now();

  // Full overskriving for dette firmaet — rør ikke andre firmaers rader.
  db.delete(byggeplassLocal)
    .where(eq(byggeplassLocal.organizationId, organizationId))
    .run();
  for (const b of byggeplasser) {
    db.insert(byggeplassLocal)
      .values({
        id: b.id,
        organizationId,
        projectId: b.projectId,
        number: b.number ?? null,
        status: b.status ?? null,
        navn: b.name ?? null,
        lat: b.latitude ?? null,
        lng: b.longitude ?? null,
        radiusM: b.radiusM ?? null,
        sistOppdatert: naa,
      })
      .run();
  }

  return { byggeplasser: byggeplasser.length };
}

/**
 * L1 (2026-06-20): identifiser hvilken byggeplass arbeider startet på via GPS.
 * Speil av identifiserOppmotested (StartSluttDagKort.tsx): nærmeste byggeplass
 * innenfor sin geofence-radius, org-scopet (på tvers av firmaets prosjekter).
 * Hopper over rader uten lat/lng/radiusM (geofence valgfri på server).
 * KUN dokumentasjon — aldri lønn/reise/prosjektvalg. Returnerer null ved ingen treff.
 */
export function identifiserByggeplass(
  lat: number | null,
  lng: number | null,
  organizationId: string,
): { id: string; navn: string | null } | null {
  if (lat == null || lng == null || !organizationId) return null;
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(byggeplassLocal)
    .where(eq(byggeplassLocal.organizationId, organizationId))
    .all();
  let beste: { id: string; navn: string | null } | null = null;
  let besteM = Infinity;
  for (const b of rader) {
    if (b.lat == null || b.lng == null || b.radiusM == null) continue;
    const meter = haversineKm(lat, lng, b.lat, b.lng) * 1000;
    if (meter <= b.radiusM && meter < besteM) {
      besteM = meter;
      beste = { id: b.id, navn: b.navn ?? null };
    }
  }
  return beste;
}

/**
 * Synkron lese-funksjon: firmaets byggeplasser for ett prosjekt fra lokal cache.
 */
export function hentByggeplasserForProsjektLokalt(projectId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(byggeplassLocal)
    .where(eq(byggeplassLocal.projectId, projectId))
    .all();
}
