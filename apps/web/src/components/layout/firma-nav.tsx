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
  { labelKey: "firmaNav.timer", href: "/dashbord/firma/timer", ikon: <Clock className="h-5 w-5" />, kreverFirmaModul: "timer" },
  { labelKey: "firmaNav.timerRapport", href: "/dashbord/firma/timer/rapport", ikon: <BarChart3 className="h-5 w-5" />, kreverFirmaModul: "timer" },
  { labelKey: "firmaNav.kalender", href: "/dashbord/firma/kalender", ikon: <Calendar className="h-5 w-5" /> },
  { labelKey: "firmaNav.varelager", href: "/dashbord/firma/varelager", ikon: <Package className="h-5 w-5" />, kreverFirmaModul: "varelager" },
  { labelKey: "firmaNav.fakturering", href: "/dashbord/firma/fakturering", ikon: <CreditCard className="h-5 w-5" />, kreverSitedocAdmin: true },
  { labelKey: "firmaNav.innstillinger", href: "/dashbord/firma/innstillinger", ikon: <Settings className="h-5 w-5" /> },
  { labelKey: "firmaNav.integrasjoner", href: "/dashbord/firma/innstillinger/integrasjoner", ikon: <Database className="h-5 w-5" /> },
];

/**
 * Firma-nav filtrert på brukerens tilgang (samme gating som firma/layout.tsx).
 * Returnerer [] for ikke-firma-admin. Brukes av NavSidebar FIRMA-sone og
 * søkemodalens SIDER-gruppe.
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

  if (!kanAdministrereFirma || !valgtFirma) return [];

  return firmaNavElementer.filter((element) => {
    if (element.kreverFirmaModul === "timer" && !harTimerModul) return false;
    if (element.kreverFirmaModul === "varelager" && !harVarelagerModul) return false;
    if (element.kreverSitedocAdmin && !erSitedocAdmin) return false;
    if (element.kreverHmsTilgang && !harHmsTilgang) return false;
    return true;
  });
}
