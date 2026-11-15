import { and, eq } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { oppmotestedAvstandLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Kontor↔kontor-avstand-cache (L2, POST 2026-11-15 (13) 6b)
 *
 *  Speiler firmaets OppmotestedAvstand lokalt, så overføringsforslaget
 *  (første/siste dag i midlertidig periode) virker offline. Paret er
 *  normalisert på server (fra < til); oppslaget normaliserer likt.
 *  KUN lokal, synkes aldri opp. Full overskriving per firma.
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * Feilet pull kaster FØR slettingen → eksisterende cache beholdes (samme
 * mønster som reisetidMatriseKatalog). Tom liste er gyldig.
 */
export async function refreshOppmotestedAvstandKatalog(
  klient: TrpcKlient,
  organizationId: string,
): Promise<{ rader: number }> {
  const db = hentDatabase();
  if (!db) return { rader: 0 };
  const rader = await klient.oppmotested.hentKontorAvstanderForFirma.query({ organizationId });
  const naa = Date.now();
  db.delete(oppmotestedAvstandLocal)
    .where(eq(oppmotestedAvstandLocal.organizationId, organizationId))
    .run();
  for (const r of rader) {
    db.insert(oppmotestedAvstandLocal)
      .values({
        organizationId,
        fraOppmotestedId: r.fraOppmotestedId,
        tilOppmotestedId: r.tilOppmotestedId,
        kjoretidMin: r.kjoretidMin ?? null,
        avstandM: r.avstandM ?? null,
        sistOppdatert: naa,
      })
      .run();
  }
  return { rader: rader.length };
}

/** Oppslag i vilkårlig rekkefølge — paret normaliseres som på server. */
export function hentKontorAvstandLokalt(
  a: string,
  b: string,
): { kjoretidMin: number | null; avstandM: number | null } | null {
  if (a === b) return null;
  const db = hentDatabase();
  if (!db) return null;
  const [fra, til] = a < b ? [a, b] : [b, a];
  const rad = db
    .select()
    .from(oppmotestedAvstandLocal)
    .where(
      and(
        eq(oppmotestedAvstandLocal.fraOppmotestedId, fra),
        eq(oppmotestedAvstandLocal.tilOppmotestedId, til),
      ),
    )
    .all()[0];
  return rad ? { kjoretidMin: rad.kjoretidMin, avstandM: rad.avstandM } : null;
}
