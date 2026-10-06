import { eq, and } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { reisetidMatriseLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Reisetid-matrise-katalog-cache (R4, 2026-06-11)
 *
 *  Speiler firmaets ReisetidMatrise lokalt: kjøretid (min) per
 *  [kontor × byggeplass]. Brukes av reise-forslaget i «Slutt dag» —
 *  GPS-identifisert kontor → prosjektets primær-byggeplass → ferdig reisetid.
 *  kjoretidMin < 0 = uoppnåelig (OSRM fant ingen rute). KUN lokal, synkes aldri
 *  opp. Full overskriving per firma. Refresh ved login + nett-gjenkomst.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * Last ned firmaets reisetid-matrise og overskriv lokal cache for dette
 * firmaet. Idempotent — trygt å kjøre flere ganger.
 */
export async function refreshReisetidMatriseKatalog(
  klient: TrpcKlient,
  organizationId: string,
): Promise<{ rader: number }> {
  const db = hentDatabase();
  if (!db) return { rader: 0 };

  // Cache-bevaring (device-funn 2026-08-08, samme mønster som maskinKatalog):
  // pullen fanges IKKE → feilet pull kaster FØR den scope-delete under, kalleren
  // beholder eksisterende cache. Vellykket tom liste (firma uten reisetid-matrise)
  // er gyldig → slett + refyll tomt for firmaet. Tidligere `.catch(() => [])` tømte
  // matrise-cachen ved transient feil.
  const rader = await klient.oppmotested.hentMatriseForFirma.query({
    organizationId,
  });

  const naa = Date.now();

  // Full overskriving for dette firmaet — rør ikke andre firmaers rader.
  db.delete(reisetidMatriseLocal)
    .where(eq(reisetidMatriseLocal.organizationId, organizationId))
    .run();
  for (const r of rader) {
    db.insert(reisetidMatriseLocal)
      .values({
        organizationId,
        oppmotestedId: r.oppmotestedId,
        byggeplassId: r.byggeplassId,
        kjoretidMin: r.kjoretidMin,
        // Reise-terskel-km: avstand (meter). null fra eldre server (mangler
        // feltet) tolkes som ukjent — km-klassifisering faller til under-type.
        avstandM: r.avstandM ?? null,
        sistOppdatert: naa,
      })
      .run();
  }

  return { rader: rader.length };
}

/**
 * Slå opp én matrise-rad (kontor × byggeplass) fra lokal cache. Returnerer
 * raden eller null.
 */
export function hentMatriseRadLokalt(
  oppmotestedId: string,
  byggeplassId: string,
) {
  const db = hentDatabase();
  if (!db) return null;
  const rader = db
    .select()
    .from(reisetidMatriseLocal)
    .where(
      and(
        eq(reisetidMatriseLocal.oppmotestedId, oppmotestedId),
        eq(reisetidMatriseLocal.byggeplassId, byggeplassId),
      ),
    )
    .all();
  return rader[0] ?? null;
}
