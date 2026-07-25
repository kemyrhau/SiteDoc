// F0 Soft-delete — delt, ren guard-logikk (testbar; Prisma-agnostisk).
//
// where-fragmentene er vanlige objekter som spres inn i Prisma-where på api-siden
// (apps/api/src/utils/softDelete.ts re-eksporterer disse). Alle Checklist/Task-lister
// bruker IKKE_SLETTET; papirkurv-visningen bruker inversen KUN_SLETTET.

/** Guard-filter: kun ikke-slettede rader. */
export const IKKE_SLETTET = { deletedAt: null } as const;

/** Inversen: kun soft-slettede rader (papirkurv-visning). */
export const KUN_SLETTET = { deletedAt: { not: null } } as const;

/** Antall dager et dokument kan gjenopprettes før auto-hardslett. */
export const PAPIRKURV_DAGER = 90;

/**
 * Dager igjen før auto-hardslett for et soft-slettet dokument.
 * Klampes til [0, PAPIRKURV_DAGER]. `deletedAt` må være satt (papirkurv-rad).
 */
export function dagerIgjen(deletedAt: Date, naa: Date = new Date()): number {
  const gaattMs = naa.getTime() - deletedAt.getTime();
  const gaattDager = Math.floor(gaattMs / (1000 * 60 * 60 * 24));
  return Math.max(0, PAPIRKURV_DAGER - gaattDager);
}
