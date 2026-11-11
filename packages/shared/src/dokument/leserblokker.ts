/**
 * Markør i `FtdDocument.processingError` for et dokument som er ferdig prosessert
 * (`completed`) men der blokkuttrekket ga 0 leser-blokker — f.eks. en PDF uten
 * uttrekkbar tekst eller bilder (DL-2, 2026-11-11). Ikke en feil: dokumentet kan
 * ikke vises i leseren, men kan fortsatt være søkbart. Leseren viser «kan ikke vises
 * her» med én gang i stedet for å vente; mappelista viser den ikke som «Feil».
 * Nullstilles av full reprosessering og av blokkreparasjonen som alle andre feil.
 */
export const INGEN_LESERBLOKKER = "INGEN_LESERBLOKKER";

/** Er `processingError` en ekte prosesseringsfeil (ikke markøren over)? */
export function erProsesseringsfeil(processingError: string | null | undefined): boolean {
  return !!processingError && processingError !== INGEN_LESERBLOKKER;
}
