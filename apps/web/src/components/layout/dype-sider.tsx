"use client";

/**
 * K13 — Delt statisk kilde for «dype» sider: arbeidsflater UTEN nav-hjem som
 * likevel skal være søkbare (Ctrl+K). Fjerde kilde til `useSokRegistry`, på lik
 * linje med hub-kort, prosjekt-sidebar og firma-nav.
 *
 * Regel 1 før regel 2 (K13 §4.0): sider som er *innstillinger* får nav-hjem som
 * hub-underlenke (søk følger gratis) — de ligger IKKE her. Kun rene
 * arbeidsflater uten nav-hjem hører hjemme i denne lista:
 *   - `maler`            → prosjekt-bibliotekvalg (arbeidsflate, ikke konfig)
 *   - `firmaAttestering` → leder-attestering på firma-nivå (arbeidsflate)
 *   - `komIGang`         → onboarding (K13-a); verken firma- eller prosjekt-scopet
 *                          → INGEN sone-brødsmule (fabel-avgjørelse 2026-07-11)
 *
 * Gating bruker samme flagg-vokabular som nav (jf. K7) og gjenbruker signaler
 * som allerede beregnes (useFirma/useProsjekt) — ingen nye tRPC-kall.
 */

import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useFirma } from "@/kontekst/firma-kontekst";

export interface DypSide {
  id: string;
  /** i18n-nøkkel for tittelen (nb+en). */
  labelKey: string;
  /** i18n-nøkkel-kjede for brødsmula. Tom = ingen brødsmule (f.eks. kom-i-gang). */
  brodsmuleKeys: string[];
  /** Rute-URL. Får `prosjektId` (kan være null) → returner null når ikke navigerbar. */
  href: (prosjektId: string | null) => string | null;
  // Gating — samme vokabular som nav:
  kreverProsjekt?: boolean;
  kreverFirmaAdmin?: boolean;
  kreverFirmaModul?: "timer" | "varelager" | "maskin";
}

export const dypeSider: DypSide[] = [
  {
    id: "maler",
    labelKey: "innstillinger.maler.tittel",
    brodsmuleKeys: ["nav.soneProsjekt"],
    href: (p) => (p ? `/dashbord/${p}/maler` : null),
    kreverProsjekt: true,
  },
  {
    id: "firmaAttestering",
    labelKey: "nav.timerAttestering",
    brodsmuleKeys: ["nav.soneFirma", "innstillinger.timer.tittel"],
    href: () => "/dashbord/firma/timer/attestering",
    kreverFirmaAdmin: true,
    kreverFirmaModul: "timer",
  },
  {
    id: "komIGang",
    labelKey: "landing.komIGang",
    brodsmuleKeys: [], // K13-a: ingen sone — verken firma- eller prosjekt-scopet
    href: () => "/dashbord/kom-i-gang",
  },
];

/**
 * Dype sider filtrert på brukerens tilgang (samme gating-signaler som nav).
 * Gjenbruker useFirma/useProsjekt — ingen nye queries utover det React Query cacher.
 */
export function useDypeSider(): DypSide[] {
  const { prosjektId } = useProsjekt();
  const { valgtFirma, kanAdministrereFirma } = useFirma();
  const firmamoduler = valgtFirma?.aktiveFirmamoduler ?? [];

  return dypeSider.filter((s) => {
    if (s.kreverProsjekt && !prosjektId) return false;
    if (s.kreverFirmaAdmin && !kanAdministrereFirma) return false;
    if (s.kreverFirmaModul && !firmamoduler.includes(s.kreverFirmaModul)) return false;
    return true;
  });
}
