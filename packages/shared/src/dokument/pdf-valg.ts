/**
 * PDF-1 (rettelse 2026-11-12, Kenneth): standard utskrift = sjekklista nøyaktig som før,
 * pluss henvisningslinjen «Oppgaver: …». Oppgaver og vedlegg er tilleggsvalg, av som standard.
 * Én kilde for mobil, web og API (`arkiv.rendr` uten flagg).
 */
export const STANDARD_PDF_VALG = { medOppgaver: false, medVedlegg: false } as const;

export type PdfValg = { medOppgaver: boolean; medVedlegg: boolean };
