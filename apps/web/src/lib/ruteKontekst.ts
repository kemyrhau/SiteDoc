/**
 * Delt rute-predikat: er denne ruta en FIRMA-kontekst (topp-nivå firmamodul)?
 *
 * Én sannhetskilde for KontekstChip, Toppbar og NavSidebar. Tidligere lå tre
 * kopier, og kun KontekstChips ble maskin-bevisst (a859b4f0) → `/dashbord/maskin`
 * viste FIRMA i chippen men PROSJEKT ellers (funn 6, regresjonsjakt 2026-08-21).
 *
 * ⚠️ FRAMTID: nye topp-nivå-firmamoduler må legges til HER (og bare her), ellers
 * viser sidebaren/toppbaren feil (prosjekt-)kontekst på den ruta.
 */
export function ruteErFirmaKontekst(pathname: string | null): boolean {
  const p = pathname ?? "";
  return (
    p.startsWith("/dashbord/firma") ||
    p === "/dashbord/maskin" ||
    p.startsWith("/dashbord/maskin/")
  );
}
