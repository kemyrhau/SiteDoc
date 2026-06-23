import { prisma } from "@sitedoc/db";
import { kompetanseStatus, MASKINFORERBEVIS_KATEGORI } from "@sitedoc/shared";

/* ============================================================================
 *  T.11 — kompetanse-informert maskin-registrering (gating-service)
 *
 *  Avledet (live) flagg: har en bruker minst én IKKE-utløpt maskinførerbevis-
 *  kompetanse i sitt firma? Rent avledet — ingen lagring, ingen migrering.
 *
 *  Gating-regel (fase-0 § T.11): kun kategori MASKINFORERBEVIS_KATEGORI teller.
 *  40-timers teori er forløper i samme løp og fanges implisitt når beviset er
 *  registrert. "varsel" (snart utløpt) teller fortsatt som gyldig — kun "utlopt"
 *  feller flagget.
 *
 *  Bruk: soft-flagg for arbeider (mobil) + leder-synlighet (attestering).
 *  Aldri blokkerende — «flagg, ikke avvis».
 * ============================================================================ */

/**
 * Batch: gitt brukere + org → hvilke har minst én gyldig (ikke-utløpt)
 * maskinførerbevis-kompetanse. Ett DB-treff totalt. Brukere uten treff får
 * `false`. Org-isolert via kompetansetype.organizationId.
 */
export async function harGyldigMaskinforerbevisBatch(
  userIds: string[],
  organizationId: string,
  paaDato: Date = new Date(),
): Promise<Map<string, boolean>> {
  const resultat = new Map<string, boolean>(userIds.map((id) => [id, false]));
  if (userIds.length === 0) return resultat;

  const rader = await prisma.ansattKompetanse.findMany({
    where: {
      userId: { in: userIds },
      kompetansetype: {
        organizationId,
        kategori: MASKINFORERBEVIS_KATEGORI,
        aktiv: true,
      },
    },
    select: { userId: true, utloper: true },
  });

  for (const r of rader) {
    if (kompetanseStatus(r.utloper, paaDato) !== "utlopt") {
      resultat.set(r.userId, true);
    }
  }
  return resultat;
}

/**
 * Enkelt-oppslag for én bruker (mobil min-status / detalj-attestering).
 */
export async function harGyldigMaskinforerbevis(
  userId: string,
  organizationId: string,
  paaDato: Date = new Date(),
): Promise<boolean> {
  const map = await harGyldigMaskinforerbevisBatch(
    [userId],
    organizationId,
    paaDato,
  );
  return map.get(userId) ?? false;
}
