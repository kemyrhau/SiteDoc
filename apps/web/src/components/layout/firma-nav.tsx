"use client";

/**
 * Delt kilde for FIRMA-sone-navigasjonen + gating.
 *
 * Speiler firma/layout.tsx (krav a: hver firma-inngang må finnes her).
 * Ekstrahert ut av NavSidebar (steg iv) slik at BÅDE NavSidebar (FIRMA-sonen)
 * og den globale søkemodalen (SIDER-gruppa) leser samme liste + gating —
 * drift-fri når firma-nav endres.
 */

import {
  LayoutDashboard,
  FolderKanban,
  Users,
  CreditCard,
  Settings,
  Building2,
  Award,
  Clock,
  BarChart3,
  Boxes,
  Package,
  Database,
  Calendar,
  ShieldAlert,
  MapPin,
  Library,
  ClipboardCheck,
} from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { trpc } from "@/lib/trpc";

export interface FirmaNavElement {
  labelKey: string;
  href: string;
  ikon: JSX.Element;
  kreverFirmaModul?: "timer" | "varelager";
  kreverSitedocAdmin?: boolean;
  kreverHmsTilgang?: boolean;
  /** w10b: vises for den som kan attestere i et firma med Timer — også prosjektleder uten firma-admin. */
  kreverAttestering?: boolean;
}

export const firmaNavElementer: FirmaNavElement[] = [
  { labelKey: "firmaNav.oversikt", href: "/dashbord/firma", ikon: <LayoutDashboard className="h-5 w-5" /> },
  { labelKey: "firmaNav.prosjekter", href: "/dashbord/firma/prosjekter", ikon: <FolderKanban className="h-5 w-5" /> },
  { labelKey: "firmaNav.ansatte", href: "/dashbord/firma/ansatte", ikon: <Users className="h-5 w-5" /> },
  { labelKey: "firmaNav.avdelinger", href: "/dashbord/firma/avdelinger", ikon: <Building2 className="h-5 w-5" /> },
  { labelKey: "firmaNav.oppmotesteder", href: "/dashbord/firma/oppmotesteder", ikon: <MapPin className="h-5 w-5" /> },
  { labelKey: "firmaNav.kompetanse", href: "/dashbord/firma/kompetanse", ikon: <Award className="h-5 w-5" /> },
  { labelKey: "firmaNav.hms", href: "/dashbord/firma/hms", ikon: <ShieldAlert className="h-5 w-5" />, kreverHmsTilgang: true },
  { labelKey: "firmaNav.moduler", href: "/dashbord/firma/moduler", ikon: <Boxes className="h-5 w-5" /> },
  // Malforvaltning (ordre PR 2 Del A): firma-admins inngang til forvaltnings-flaten der
  // firmaarkivet + SiteDoc-arkivet redigeres. Denne lenken ble bevisst holdt tilbake i PR 1
  // fordi flaten da bare hadde SiteDoc-fanen (sitedoc-admin) — for en firma-admin ville den
  // løyet. Nå har firma-admin Firmaarkiv-fanen, så lenken er ærlig. Nivåbanneret i flaten
  // rammer nivået (svar på «uklart nivå», som tok den gamle malarkiv-snarveien ut av
  // sidefeltet). Ruta /dashbord/firma/malarkiv er nå kun redirect hit.
  { labelKey: "firmaNav.malforvaltning", href: "/dashbord/firma/innstillinger/malforvaltning", ikon: <Library className="h-5 w-5" /> },
  { labelKey: "firmaNav.timer", href: "/dashbord/firma/timer", ikon: <Clock className="h-5 w-5" />, kreverFirmaModul: "timer" },
  { labelKey: "firmaNav.timerRapport", href: "/dashbord/firma/timer/rapport", ikon: <BarChart3 className="h-5 w-5" />, kreverFirmaModul: "timer" },
  // w10b (B6): den ene attesteringen. Står utenfor firma-layouten (/dashbord/attestering).
  { labelKey: "nav.timerAttestering", href: "/dashbord/attestering", ikon: <ClipboardCheck className="h-5 w-5" />, kreverAttestering: true },
  { labelKey: "firmaNav.kalender", href: "/dashbord/firma/kalender", ikon: <Calendar className="h-5 w-5" /> },
  { labelKey: "firmaNav.varelager", href: "/dashbord/firma/varelager", ikon: <Package className="h-5 w-5" />, kreverFirmaModul: "varelager" },
  { labelKey: "firmaNav.fakturering", href: "/dashbord/firma/fakturering", ikon: <CreditCard className="h-5 w-5" />, kreverSitedocAdmin: true },
  { labelKey: "firmaNav.innstillinger", href: "/dashbord/firma/innstillinger", ikon: <Settings className="h-5 w-5" /> },
  { labelKey: "firmaNav.integrasjoner", href: "/dashbord/firma/innstillinger/integrasjoner", ikon: <Database className="h-5 w-5" /> },
];

/**
 * Firma-nav filtrert på brukerens tilgang (samme gating som firma/layout.tsx).
 * Ikke-firma-admin får bare «Attestering» når hen kan attestere i et firma med Timer
 * (w10b), ellers []. Brukes av NavSidebar FIRMA-sone og søkemodalens SIDER-gruppe.
 */
export function useFirmaNavElementer(): FirmaNavElement[] {
  const { valgtFirma, erSitedocAdmin, kanAdministrereFirma } = useFirma();
  const harTimerModul = valgtFirma?.aktiveFirmamoduler.includes("timer") ?? false;
  const harVarelagerModul = valgtFirma?.aktiveFirmamoduler.includes("varelager") ?? false;
  const hmsTilgangQuery = trpc.organisasjon.harHmsTilgang.useQuery(
    { organizationId: valgtFirma?.id ?? "" },
    { enabled: !!valgtFirma?.id && kanAdministrereFirma },
  );
  const harHmsTilgang = hmsTilgangQuery.data ?? false;
  const attesteringsFirmaer = trpc.timer.dagsseddel.mineAttesteringsFirmaer.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  return gateFirmaNav(firmaNavElementer, {
    kanAdministrereFirma: kanAdministrereFirma && !!valgtFirma,
    erSitedocAdmin,
    harTimerModul,
    harVarelagerModul,
    harHmsTilgang,
    attesteringsFirmaer: attesteringsFirmaer.data ?? [],
  });
}

export interface FirmaNavTilgang {
  /** Firma-admin for det valgte firmaet (falsk uten valgt firma). */
  kanAdministrereFirma: boolean;
  erSitedocAdmin: boolean;
  harTimerModul: boolean;
  harVarelagerModul: boolean;
  harHmsTilgang: boolean;
  /** `dagsseddel.mineAttesteringsFirmaer` (w10b). */
  attesteringsFirmaer: readonly { harTimerModul: boolean }[];
}

/**
 * Ren gating (testbar uten React-kontekst). w10b: «Attestering» vises for firma-admin i et
 * Timer-firma (sitedoc_admin uten ansettelse inkludert) og for prosjektleder / «kan attestere»
 * i et firma med Timer — som da bare får denne ene raden.
 */
export function gateFirmaNav(elementer: readonly FirmaNavElement[], t: FirmaNavTilgang): FirmaNavElement[] {
  const kanAttestere =
    t.attesteringsFirmaer.some((f) => f.harTimerModul) || (t.kanAdministrereFirma && t.harTimerModul);

  if (!t.kanAdministrereFirma) {
    return kanAttestere ? elementer.filter((e) => e.kreverAttestering) : [];
  }

  return elementer.filter((element) => {
    if (element.kreverAttestering && !kanAttestere) return false;
    if (element.kreverFirmaModul === "timer" && !t.harTimerModul) return false;
    if (element.kreverFirmaModul === "varelager" && !t.harVarelagerModul) return false;
    if (element.kreverSitedocAdmin && !t.erSitedocAdmin) return false;
    if (element.kreverHmsTilgang && !t.harHmsTilgang) return false;
    return true;
  });
}
