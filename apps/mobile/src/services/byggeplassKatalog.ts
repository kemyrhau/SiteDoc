import { eq } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { byggeplassLocal } from "../db/schema";
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
        sistOppdatert: naa,
      })
      .run();
  }

  return { byggeplasser: byggeplasser.length };
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
