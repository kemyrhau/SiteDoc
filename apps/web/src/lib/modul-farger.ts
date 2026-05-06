/**
 * Modul-fargedesign per B3 (ux-arkitektur-agenda.md, 2026-05-06).
 *
 * Toppbar beholder mørkeblå brand-identitet. Sidebar får fargeaksentuering
 * (3px border-left + ikon-farge) på aktivt modul-eid element.
 *
 * Aksent vises KUN på elementer som hører til modulen — andre aktive
 * elementer (sjekklister, oppgaver, etc.) beholder default hvit-stil.
 */

export const MODUL_FARGER = {
  prosjekt: "#378ADD",
  timer: "#3B6D11",
  maskin: "#854F0B",
  varelager: "#1D9E75",
} as const;

export type ModulNavn = keyof typeof MODUL_FARGER;

/**
 * Hent aktiv modul fra URL-pathname.
 *
 * Logikken er ankret på faktisk routing-struktur:
 *   - /dashbord/maskin/*           → maskin
 *   - /dashbord/timer/*            → timer (standalone, eks. /dashbord/timer/mine)
 *   - /dashbord/firma/varelager/*  → varelager (firma-katalog + import)
 *   - /dashbord/[uuid]/timer/*     → timer (prosjekt-kontekst)
 *   - /dashbord/[uuid]/vareforbruk → varelager (prosjekt-kontekst)
 *   - /dashbord/[uuid]/...         → prosjekt
 *
 * UUID matches på full v4-lengde (36 tegn med bindestreker) for å unngå
 * falsk-positiv på korte hex-segmenter.
 */
export function hentAktivModul(pathname: string): ModulNavn | null {
  // Standalone modul-ruter
  if (pathname.startsWith("/dashbord/maskin")) return "maskin";
  if (pathname.startsWith("/dashbord/timer")) return "timer";
  if (pathname.startsWith("/dashbord/firma/varelager")) return "varelager";

  // Prosjekt-undermoduler (under /dashbord/[uuid]/...)
  const prosjektMatch = pathname.match(/^\/dashbord\/[0-9a-f-]{36}(\/(.*))?$/);
  if (prosjektMatch) {
    const understi = prosjektMatch[2] ?? "";
    if (understi.startsWith("timer")) return "timer";
    if (understi.startsWith("vareforbruk")) return "varelager";
    return "prosjekt";
  }

  return null;
}
