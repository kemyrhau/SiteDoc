import { and, eq } from "drizzle-orm";
import type { OppmotePeriodeInput } from "@sitedoc/shared";
import { hentDatabase } from "../db/database";
import { oppmotePeriodeLocal } from "../db/schema";
import type { trpc } from "../lib/trpc";

/* ============================================================================
 *  Oppmøtested-periode-cache (POST 2026-11-15 (12) D)
 *
 *  Speiler brukerens EGNE oppmøtested-perioder i firmaet lokalt, så den delte
 *  resolveren `løsOppmote` virker offline — også ved etterregistrering i en
 *  gammel periode. KUN lokal, synkes aldri opp. Refresh ved login +
 *  nett-gjenkomst (TimerSyncProvider), full overskriving pr. (bruker, firma).
 * ============================================================================ */

type TrpcKlient = ReturnType<typeof trpc.useUtils>["client"];

/**
 * Hent egne perioder fra server og overskriv lokal cache for (bruker, firma).
 * Feilet pull kaster FØR slettingen → eksisterende cache beholdes (samme
 * mønster som oppmotestedKatalog). Tom liste er gyldig → cachen tømmes.
 */
export async function refreshOppmotePeriodeKatalog(
  klient: TrpcKlient,
  userId: string,
  organizationId: string,
): Promise<{ perioder: number; trengerValg: boolean }> {
  const db = hentDatabase();
  if (!db) return { perioder: 0, trengerValg: false };

  const { perioder, trengerValg } = await klient.oppmotePeriode.hentMine.query({ organizationId });
  skrivOppmotePerioderLokalt(userId, organizationId, perioder);
  return { perioder: perioder.length, trengerValg };
}

/** Full overskriving pr. (bruker, firma). Brukes av refresh og etter eget valg. */
export function skrivOppmotePerioderLokalt(
  userId: string,
  organizationId: string,
  perioder: ReadonlyArray<OppmotePeriodeInput & { id: string }>,
): void {
  const db = hentDatabase();
  if (!db) return;
  const naa = Date.now();
  db.delete(oppmotePeriodeLocal)
    .where(and(eq(oppmotePeriodeLocal.userId, userId), eq(oppmotePeriodeLocal.organizationId, organizationId)))
    .run();
  for (const p of perioder) {
    db.insert(oppmotePeriodeLocal)
      .values({
        id: p.id,
        userId,
        organizationId,
        type: p.type,
        fast: p.fast,
        oppmotestedId: p.oppmotestedId,
        projectId: p.projectId,
        fraDato: p.fraDato,
        tilDato: p.tilDato,
        sistOppdatert: naa,
      })
      .run();
  }
}

/** Synkron lesing for resolveren. Tom liste hvis cachen ikke er fylt. */
export function hentOppmotePerioderLokalt(userId: string, organizationId: string): OppmotePeriodeInput[] {
  const db = hentDatabase();
  if (!db) return [];
  return db
    .select()
    .from(oppmotePeriodeLocal)
    .where(and(eq(oppmotePeriodeLocal.userId, userId), eq(oppmotePeriodeLocal.organizationId, organizationId)))
    .all()
    .map((r) => ({
      // id (L2): overføringsforslaget fører periode-id-en videre til reiseRegel.
      id: r.id,
      type: r.type === "byggeplass" ? "byggeplass" : "kontor",
      fast: r.fast,
      oppmotestedId: r.oppmotestedId,
      projectId: r.projectId,
      fraDato: r.fraDato,
      tilDato: r.tilDato,
    }));
}
