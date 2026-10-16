import type { Prisma } from "@sitedoc/db";

/**
 * Et dokument som henger i `processing` eldre enn dette regnes som STRANDET
 * (prosess-crash midt i kjøring): ellers ville «pågår» vært evig sann, knappen
 * for alltid deaktivert, og `tvingReekstraksjonAv` hoppet over det (RETUR
 * Kontrollør 2026-10-15).
 *
 * «Eldre enn 15 min» betyr crash KUN fordi en levende jobb sender livstegn
 * (`lagLivstegn`) throttlet hvert 30 s gjennom ekstraksjon/OCR/chunking. Uten
 * livstegn ville en lovlig lang OCR (25–50 min på en stor skannet PDF) stått
 * stille i `updated_at` og blitt feilklassifisert som strandet (RETUR 2
 * 2026-10-15). Embedding-fasen kjører FØRST etter `completed`, så den er utenfor
 * dette vinduet per konstruksjon og trenger ikke livstegn.
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

/**
 * Hvor ofte et livstegn faktisk skrives til DB. 30 s << STRANDET_MS (15 min), så
 * en levende jobb holdes alltid «fersk», mens et reelt crash slutter å skrive og
 * blir strandet etter 15 min. Throttlingen hindrer at lange OCR-løp spammer DB.
 */
export const LIVSTEGN_THROTTLE_MS = 30 * 1000;

/** Minimal del av Prisma-klienten livstegnet trenger — holder modulen uavhengig. */
type LivstegnPrisma = {
  $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
};

/**
 * Lager en throttlet livstegn-funksjon for ETT dokument. Hvert kall bumper
 * `ftd_documents.updated_at = now()` (men maks hvert `LIVSTEGN_THROTTLE_MS`), slik
 * at `erStrandet`/`utenAktivtKjørendeWhere` aldri feilklassifiserer et dokument som
 * JOBBER (lang OCR) som strandet. Oppdateringen er gjerdet på
 * `processing_state = 'processing'`: et dokument som allerede er `completed`/`failed`
 * (f.eks. etter at hovedveien er ferdig) blir ALDRI gjenopplivet av et sent livstegn.
 *
 * `naa` er injiserbar for test (determinisme). Feil svelges (logges) — et tapt
 * livstegn skal aldri velte selve prosesseringen.
 */
export function lagLivstegn(
  prisma: LivstegnPrisma,
  documentId: string,
  naa: () => number = Date.now,
): () => Promise<void> {
  let sistSkrevet = 0;
  return async () => {
    const n = naa();
    if (sistSkrevet !== 0 && n - sistSkrevet < LIVSTEGN_THROTTLE_MS) return;
    sistSkrevet = n;
    try {
      await prisma.$executeRaw`
        UPDATE ftd_documents
        SET updated_at = now()
        WHERE id = ${documentId} AND processing_state = 'processing'
      `;
    } catch (err) {
      console.warn(`Livstegn feilet for ${documentId}:`, err);
    }
  };
}
