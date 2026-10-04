import { eq } from "drizzle-orm";
import { gjenkjennSted, tilGeofencer } from "@sitedoc/shared";
import { hentDatabase } from "../db/database";
import { byggeplassLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Byggeplass-katalog-cache (R4, 2026-06-11)
 *
 *  Speiler firmaets byggeplasser lokalt — id/projectId/number/status OG
 *  geofence (lat/lng/radiusM, `:88-93`, `db/schema.ts:494-496`). Geofencen
 *  brukes til GPS-gjenkjenning (identifiserByggeplass); reisetid-matrisen bærer
 *  kjøretiden til primær-byggeplassen. KUN lokal, synkes aldri opp. Full
 *  overskriving per firma. Refresh ved login + nett-gjenkomst.
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

  // Cache-bevaring (device-funn 2026-08-08, samme mønster som maskinKatalog):
  // pullen fanges IKKE → feilet pull kaster FØR den scope-delete under, kalleren
  // beholder eksisterende cache. Vellykket tom liste (firma uten byggeplasser) er
  // gyldig → slett + refyll tomt for dette firmaet. Tidligere `.catch(() => [])`
  // tømte byggeplass-cachen ved transient feil (bidro til UUID-symptomet offline).
  // Routeren er montert som «bygning» (bakoverkompat-nøkkel, router.ts:53).
  const byggeplasser = await klient.bygning.hentForFirma.query({
    organizationId,
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
 * Lag 1 (2026-10-02): GPS-treff brukes som FORSLAG til destinasjon via A5;
 * arbeider-valg (`aktivtProsjektId`) går foran.
 *
 * Tynn kaller av A2 (`gjenkjennSted`, LAG 1-A): kalleren filtrerer bort
 * kandidater uten komplett geofence; funksjonen gir nærmeste innenfor radius.
 */
export function identifiserByggeplass(
  lat: number | null,
  lng: number | null,
  organizationId: string,
): { id: string; navn: string | null } | null {
  if (lat == null || lng == null || !organizationId) return null;
  const db = hentDatabase();
  if (!db) return null;
  // V17-A: kandidatene bygges av `tilGeofencer` (A4) — radius-null-filteret er
  // borte herfra. I V17-A har mobilen ingen sone-data, så dette gir én
  // sirkel pr. byggeplass med punkt+radius (identisk sett som før). Treffet
  // mappes tilbake til byggeplass-raden for navnet (Sirkel bærer ikke navn).
  const rader = db
    .select()
    .from(byggeplassLocal)
    .where(eq(byggeplassLocal.organizationId, organizationId))
    .all();
  const kandidater = rader.flatMap((b) =>
    tilGeofencer({
      id: b.id,
      lat: b.lat,
      lng: b.lng,
      radiusM: b.radiusM,
      soner: [],
    }),
  );
  const treff = gjenkjennSted({ lat, lng }, kandidater);
  if (!treff) return null;
  const rad = rader.find((b) => b.id === treff.sted.id);
  return { id: treff.sted.id, navn: rad?.navn ?? null };
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

/**
 * Synkron lese-funksjon: firmaets byggeplasser (på tvers av prosjekter) fra
 * lokal cache. Brukes av «+ Ny»-skjermens GPS-prosjektforslag (ny.tsx) til å
 * gjenkjenne byggeplass-geofence via A2.
 */
export function hentByggeplasserForFirmaLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(byggeplassLocal)
    .where(eq(byggeplassLocal.organizationId, organizationId))
    .all();
}
