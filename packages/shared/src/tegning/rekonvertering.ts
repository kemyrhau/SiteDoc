// Delt mellom api (tegning.ts: kaster feilen) og web (tegninger/page.tsx: gjenkjenner
// koden og viser en oversatt, vennlig melding) — ÉN kilde, så klienten aldri må
// matche på en norsk feilmelding (som kan endre seg eller være i16n-oversatt).
// «Oppdater visning»/«Oppdater alle tegninger» (2026-10-16): eldre tegninger fra før
// revisjonsoriginal (10.10) mangler `originalFileUrl` og kan ikke rekonverteres.
export const TEGNING_MANGLER_ORIGINALFIL_KODE = "MANGLER_ORIGINALFIL";

/**
 * «Oppdater visning»/«Oppdater alle tegninger» rekonverterer kun fra en lagret
 * DWG/DXF-original — PDF-er har sin egen vei (`rekonverterPdf`), og uten original
 * kan ingenting rekonverteres.
 */
export function erRekonverterbarOriginal(originalFileUrl: string | null | undefined): boolean {
  if (!originalFileUrl) return false;
  const lav = originalFileUrl.toLowerCase();
  return lav.endsWith(".dwg") || lav.endsWith(".dxf");
}

/**
 * Viser «Oppdater visning»-knappen (web)? Samme regel som api sin
 * `oppdaterAlleTegninger`/`rekonverteringStatus`-scope: direkte reconverterbar
 * (original arkivert siden 10.10), ELLER eldre tegning uten arkivert original der
 * `fileType` fortsatt beviser DWG/DXF-opphav (PDF→PNG og DWG/DXF→SVG er de eneste
 * to veiene som setter `conversionStatus`, og de produserer aldri samme filtype).
 * Én kilde, så knappen og batch-scopen aldri kan vise/telle ulikt.
 */
export function erTegningDwgDxfOpphav(tegning: {
  originalFileUrl: string | null | undefined;
  conversionStatus: string | null | undefined;
  fileType: string | null | undefined;
}): boolean {
  if (erRekonverterbarOriginal(tegning.originalFileUrl)) return true;
  if (tegning.originalFileUrl) return false; // original finnes, men er ikke dwg/dxf (f.eks. pdf)
  if (!tegning.conversionStatus) return false;
  const filtype = (tegning.fileType ?? "").toLowerCase();
  return filtype === "dwg" || filtype === "dxf" || filtype === "svg";
}
