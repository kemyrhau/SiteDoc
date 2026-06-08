import { eq } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { oppmotestedLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Oppmøtested-katalog-cache (Fase 1, 2026-06-08)
 *
 *  Speiler firmaets aktive oppmøtesteder (kontorer) lokalt for GPS-
 *  identifikasjon ved «Start dag». KUN lokal — synkes aldri opp.
 *  Refresh ved login + nett-gjenkomst, per firma (som organizationSetting).
 *  Full overskriving per firma — typisk få oppmøtesteder.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * Last ned firmaets aktive oppmøtesteder fra server og overskriv lokal cache
 * for dette firmaet. Idempotent — trygt å kjøre flere ganger.
 */
export async function refreshOppmotestedKatalog(
  klient: TrpcKlient,
  organizationId: string,
): Promise<{ oppmotesteder: number }> {
  const db = hentDatabase();
  if (!db) return { oppmotesteder: 0 };

  const oppmotesteder = await klient.oppmotested.hentForFirma
    .query({ organizationId })
    .catch((e) => {
      console.warn("[OPPMOTESTED-KATALOG] Pull feilet:", e);
      return [] as Array<{
        id: string;
        navn: string;
        lat: number;
        lng: number;
        radiusM: number;
      }>;
    });

  const naa = Date.now();

  // Full overskriving for dette firmaet — rør ikke andre firmaers rader.
  db.delete(oppmotestedLocal)
    .where(eq(oppmotestedLocal.organizationId, organizationId))
    .run();
  for (const o of oppmotesteder) {
    db.insert(oppmotestedLocal)
      .values({
        id: o.id,
        organizationId,
        navn: o.navn,
        lat: o.lat,
        lng: o.lng,
        radiusM: o.radiusM,
        sistOppdatert: naa,
      })
      .run();
  }

  return { oppmotesteder: oppmotesteder.length };
}

/**
 * Synkron lese-funksjon: hent firmaets oppmøtesteder fra lokal cache.
 * Returnerer tom array hvis cache ikke er populert.
 */
export function hentOppmotederLokalt(organizationId: string) {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(oppmotestedLocal)
    .where(eq(oppmotestedLocal.organizationId, organizationId))
    .all();
}
