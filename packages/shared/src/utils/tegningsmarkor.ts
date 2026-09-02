/**
 * Tegningsmarkør — den delte «har komplett markør?»-regelen (paritetsrunde 2026-09-02).
 *
 * En tegningsmarkør er `drawingId + positionX + positionY` (posisjon i prosent).
 * BESLUTNING (Kenneth 2026-08-21): en tegning UTEN punkt dokumenterer ingenting →
 * regnes som «ingen lokasjon». Derfor kreves BÅDE `drawingId` OG `positionX/Y != null`
 * (BEF-001: ukonvertert PDF-tegning har `position_x/y` = NULL).
 *
 * PARITET: lesevisning på web og mobil skal følge SAMME regel som PDF-en (harMarkor).
 * Tegning-uten-punkt er en arbeidstilstand som kun redigeringsflaten viser; i lesevisning
 * (og i PDF) utelates den. Denne hjelperen er kilden for web + mobil.
 *
 * 🔴 PDF HAR EN KANONISK TVILLING og skal IKKE konsolideres hit:
 * `packages/pdf/src/arkivmal/tegningsfelt.ts` har sin egen `harMarkor` fordi
 * `@sitedoc/pdf` er en NULL-runtime-avhengighet-pakke (se packages/pdf/CLAUDE.md) —
 * den kan ikke importere `@sitedoc/shared`. Fence 1 (lokasjon-begrepsrydding) sier
 * dessuten at PDF-regelen er fasit og ikke skal røres. To varianter avgrenset av
 * dep-regelen er tilsiktet — ikke «tre lokale kopier». Rører du den ene, hold dem like.
 */

/** Minimum for en komplett markør: tegning + posisjon. Generisk så inn-typen bevares. */
export interface MarkorFelter {
  drawingId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
}

/** Har verdien en komplett tegningsmarkør (tegning + punkt)? */
export function harTegningsmarkor<T extends MarkorFelter>(
  v: T | null | undefined,
): v is T & { drawingId: string; positionX: number; positionY: number } {
  return !!v && !!v.drawingId && v.positionX != null && v.positionY != null;
}
