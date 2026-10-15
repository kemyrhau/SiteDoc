import type { Prisma } from "@sitedoc/db";

/**
 * Et dokument som henger i `processing` eldre enn dette regnes som STRANDET
 * (prosess-crash midt i kjøring): ellers ville «pågår» vært evig sann, knappen
 * for alltid deaktivert, og `tvingReekstraksjonAv` hoppet over det (RETUR
 * Kontrollør 2026-10-15). NorBERT-batcher tar sekunder, så 15 min = crash.
 *
 * `type { Prisma }` er type-only — dette modulet har ingen runtime-avhengighet
 * til Prisma-klienten, så den rene predikatet kan unit-testes uten DB.
 */
export const STRANDET_MS = 15 * 60 * 1000;

/**
 * True når dokumentet er strandet: står `pending`/`processing`, men `updatedAt`
 * er eldre enn STRANDET_MS (ingen fremdrift siden sist — prosessen tok det aldri
 * ferdig). Rene funksjon; `naa` injiserbar for test.
 */
export function erStrandet(
  processingState: string | null,
  updatedAt: Date,
  naa: number = Date.now(),
): boolean {
  if (processingState !== "pending" && processingState !== "processing") return false;
  return naa - updatedAt.getTime() >= STRANDET_MS;
}

/**
 * Where-filter for reprosessering: alle aktive dokumenter UNNTATT de som faktisk
 * kjører nå (ferske `pending`/`processing`) og `unsupported`. Strandede (gamle)
 * `pending`/`processing` INKLUDERES, så de plukkes opp i stedet for å henge evig.
 */
export function utenAktivtKjørendeWhere(
  where: Prisma.FtdDocumentWhereInput,
  naa: number = Date.now(),
): Prisma.FtdDocumentWhereInput {
  const strandetGrense = new Date(naa - STRANDET_MS);
  return {
    ...where,
    isActive: true,
    OR: [
      { processingState: { notIn: ["pending", "processing", "unsupported"] } },
      { processingState: { in: ["pending", "processing"] }, updatedAt: { lt: strandetGrense } },
    ],
  };
}
