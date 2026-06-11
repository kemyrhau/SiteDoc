import { eq, and } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { reisetidMatriseLocal } from "../db/schema";
import { hentByggeplasserForProsjektLokalt } from "./byggeplassKatalog";
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

  const rader = await klient.oppmotested.hentMatriseForFirma
    .query({ organizationId })
    .catch((e) => {
      console.warn("[REISETID-MATRISE-KATALOG] Pull feilet:", e);
      return [] as Array<{
        oppmotestedId: string;
        byggeplassId: string;
        kjoretidMin: number;
      }>;
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

/**
 * Resolv prosjektets primær-byggeplass for reisetid-oppslag fra et gitt kontor.
 *
 * Kandidater = prosjektets byggeplasser som HAR en matrise-rad for kontoret
 * (rad-eksistens = koordinat-signal; R3 beregnet kun rad for byggeplasser med
 * resolvbar koordinat). Primær-regel (deterministisk): published først →
 * lavest number (null sist) → id. Returnerer byggeplassId eller null.
 */
export function resolverPrimaerByggeplass(
  projectId: string,
  oppmotestedId: string,
): string | null {
  const byggeplasser = hentByggeplasserForProsjektLokalt(projectId);
  if (byggeplasser.length === 0) return null;

  const kandidater = byggeplasser.filter(
    (b) => hentMatriseRadLokalt(oppmotestedId, b.id) != null,
  );
  if (kandidater.length === 0) return null;

  kandidater.sort((a, b) => {
    const aPub = a.status === "published" ? 0 : 1;
    const bPub = b.status === "published" ? 0 : 1;
    if (aPub !== bPub) return aPub - bPub;
    const aNum = a.number ?? Number.POSITIVE_INFINITY;
    const bNum = b.number ?? Number.POSITIVE_INFINITY;
    if (aNum !== bNum) return aNum - bNum;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return kandidater[0]!.id;
}
