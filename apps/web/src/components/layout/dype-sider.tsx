"use client";

/**
 * K13 — Delt statisk kilde for «dype» sider: arbeidsflater UTEN nav-hjem som
 * likevel skal være søkbare (Ctrl+K). Fjerde kilde til `useSokRegistry`, på lik
 * linje med hub-kort, prosjekt-sidebar og firma-nav.
 *
 * Regel 1 før regel 2 (K13 §4.0): sider som er *innstillinger* får nav-hjem som
 * hub-underlenke (søk følger gratis) — de ligger IKKE her. Kun rene
 * arbeidsflater uten nav-hjem hører hjemme i denne lista:
 *   - `firmaAttestering` → leder-attestering på firma-nivå (arbeidsflate)
 *   - `komIGang`         → onboarding (K13-a); verken firma- eller prosjekt-scopet
 *                          → INGEN sone-brødsmule (fabel-avgjørelse 2026-07-11)
 *   - `firmaarkiv`       → firmaets malarkiv i Malforvaltning › Firmaarkiv (ingen nav-hjem)
 *   - `sitedocArkiv`     → SiteDoc-sentralarkivet (har aldri hatt nav-hjem)
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
  kreverSitedocAdmin?: boolean;
  kreverFirmaModul?: "timer" | "varelager" | "maskin";
}

export const dypeSider: DypSide[] = [
  // Rapportmaler-flata (`[prosjektId]/maler`) fjernet (vei b, 2026-09-12). Malforvaltning
  // søkes nå via Oppsett-innstillingskortet «Maler» (innstillinger-kort.tsx) → ingen egen
  // dyp-side her. En dyp-side som pekte på en fjernet rute ville gitt et dødt søketreff.
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
  // Arkiv-nivåene i søk (ordre malarkiv-ut-av-sidefelt TILLEGG 1). Firma- og SiteDoc-arkivet
  // har INGEN nav-hjem (firmaets ble tatt ut av sidefeltet; SiteDocs har aldri hatt ett), så
  // de hører hjemme her — ekte søke-registreringer, ikke lån fra navigasjonen. Prosjektarkivet
  // ligger IKKE her: det HAR et nav-hjem (Oppsett › Produksjon), så det registreres i hub-
  // kilden (innstillinger-kort). Etikettene bærer «arkiv» så søk på «arkiv» treffer dem.
  {
    id: "firmaarkiv",
    labelKey: "sok.firmaarkiv",
    brodsmuleKeys: ["nav.soneFirma"],
    // Flyttet fra den revne `/dashbord/firma/malarkiv` til Malforvaltning › Firmaarkiv
    // (ordre PR 2 Del B). Fanen velges i flaten; ingen query-param i søketreffet.
    href: () => "/dashbord/firma/innstillinger/malforvaltning",
    kreverFirmaAdmin: true, // = fotnotens kanRedigereFirma: firmaadmin+ redigerer firmaarkivet
  },
  {
    id: "sitedocArkiv",
    labelKey: "sok.sitedocArkiv",
    brodsmuleKeys: [], // ingen egen sone i nav for SiteDoc-arkivet (meldt)
    // Flyttet fra det revne /dashbord/admin/bibliotek til Malforvaltning › SiteDoc-arkiv
    // (ordre malforvaltning PR 1). Fanen velges i flaten; ingen query-param i søketreffet.
    href: () => "/dashbord/firma/innstillinger/malforvaltning",
    kreverSitedocAdmin: true,
  },
];

/** Tilgangssignaler for gating — samme vokabular som nav (useFirma/useProsjekt). */
export interface DypSideTilgang {
  prosjektId: string | null;
  kanAdministrereFirma: boolean;
  erSitedocAdmin: boolean;
  firmamoduler: string[];
}

/**
 * Ren gating-filter (testbar uten React-kontekst). Krav 3 (TILLEGG 1): den negative
 * kontrollen — at en prosjektbruker IKKE ser firma-/SiteDoc-arkivet — bevises mot denne.
 */
export function gateDypeSider(sider: DypSide[], t: DypSideTilgang): DypSide[] {
  return sider.filter((s) => {
    if (s.kreverProsjekt && !t.prosjektId) return false;
    if (s.kreverFirmaAdmin && !t.kanAdministrereFirma) return false;
    if (s.kreverSitedocAdmin && !t.erSitedocAdmin) return false;
    if (s.kreverFirmaModul && !t.firmamoduler.includes(s.kreverFirmaModul)) return false;
    return true;
  });
}

/**
 * Dype sider filtrert på brukerens tilgang (samme gating-signaler som nav).
 * Gjenbruker useFirma/useProsjekt — ingen nye queries utover det React Query cacher.
 */
export function useDypeSider(): DypSide[] {
  const { prosjektId } = useProsjekt();
  const { valgtFirma, kanAdministrereFirma, erSitedocAdmin } = useFirma();

  return gateDypeSider(dypeSider, {
    prosjektId,
    kanAdministrereFirma,
    erSitedocAdmin,
    firmamoduler: valgtFirma?.aktiveFirmamoduler ?? [],
  });
}
