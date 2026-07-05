"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useFirma } from "@/kontekst/firma-kontekst";
import { useAktivSeksjon } from "@/hooks/useAktivSeksjon";
import { trpc } from "@/lib/trpc";
import { MODUL_FARGER, hentAktivModul } from "@/lib/modul-farger";
import {
  bunnelementer,
  kontakterElement,
  MODUL_EIERSKAP,
  navigerSidebar,
  useSidebarElementer,
  type SidebarElement,
} from "./sidebar-elementer";

/**
 * NavSidebar (steg iii) — samlet sidebar bak `nyNavigasjon`-flagget.
 *
 * Tre soner: PROSJEKT (dagens hovedelementer + P31 Kontakter, uendret
 * gating G1–G12 + modul-fargeaksent G10), FIRMA (admin-gated, speiler
 * firma/layout-navigasjonen — løser P4 fra admin-navigasjonsanalysen), og
 * «Innstillinger» fast nederst → huben. Gjelder overalt når flagget er på;
 * firma-layoutens egen sidebar undertrykkes da (se firma/layout.tsx).
 * Flagg av = denne komponenten monteres ikke; HovedSidebar brukes uendret.
 */

interface FirmaNavElement {
  labelKey: string;
  href: string;
  ikon: JSX.Element;
  kreverFirmaModul?: "timer" | "varelager";
  kreverSitedocAdmin?: boolean;
  kreverHmsTilgang?: boolean;
}

// Speiler firma/layout.tsx-navigasjonen (krav a: hver inngang må finnes her).
const firmaNavElementer: FirmaNavElement[] = [
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

function SoneOverskrift({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-300">
      {children}
    </p>
  );
}

export function NavSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { prosjektId } = useProsjekt();
  const { valgtFirma, erSitedocAdmin, kanAdministrereFirma } = useFirma();
  const aktivSeksjon = useAktivSeksjon();
  const { t } = useTranslation();
  const aktivModul = hentAktivModul(pathname ?? "");
  const aksentFarge = aktivModul ? MODUL_FARGER[aktivModul] : null;

  const { filtrertHovedelementer, harMaskinModul } = useSidebarElementer();

  // FIRMA-sone-gating (speiler firma/layout.tsx).
  const harTimerModul = valgtFirma?.aktiveFirmamoduler.includes("timer") ?? false;
  const harVarelagerModul = valgtFirma?.aktiveFirmamoduler.includes("varelager") ?? false;
  const hmsTilgangQuery = trpc.organisasjon.harHmsTilgang.useQuery(
    { organizationId: valgtFirma?.id ?? "" },
    { enabled: !!valgtFirma?.id && kanAdministrereFirma },
  );
  const harHmsTilgang = hmsTilgangQuery.data ?? false;
  const visFirmaAdminNav = kanAdministrereFirma && !!valgtFirma;
  const visFirmaSone = visFirmaAdminNav || harMaskinModul;

  const prosjektElementer = [...filtrertHovedelementer, kontakterElement];
  // Maskin er firmamodul (K1) — vises i FIRMA-sonen, gated på harMaskinModul
  // (uavhengig av firma-admin). Beholder button/aksent-rendring via renderRad.
  const maskinElement = harMaskinModul
    ? bunnelementer.find((e) => e.id === "maskin") ?? null
    : null;

  // c2: maks én aktiv rad på tvers av sonene. Prosjekt-radene lyser aldri på
  // firma-/hub-ruter (der eier en firma-lenke / footeren aktiv-tilstanden).
  const erFirmaKontekst = pathname?.startsWith("/dashbord/firma") ?? false;
  const erHub = pathname?.startsWith("/dashbord/innstillinger") ?? false;

  function erElementAktiv(element: SidebarElement): boolean {
    // Maskin (FIRMA-sone) eier /dashbord/maskin uansett kontekst.
    if (element.id === "maskin") return aktivSeksjon === "maskin";
    if (erFirmaKontekst || erHub) return false;
    return aktivSeksjon === element.id;
  }

  function renderRad(element: SidebarElement): JSX.Element {
    const deaktivert = element.kreverProsjekt && !prosjektId;
    const aktiv = erElementAktiv(element);
    const eiermodul = MODUL_EIERSKAP[element.id];
    const visAksent = aktiv && !!aksentFarge && eiermodul === aktivModul;
    const farge = visAksent ? aksentFarge : null;

    return (
      <button
        key={element.id}
        type="button"
        onClick={deaktivert ? undefined : () => navigerSidebar(router, prosjektId, element)}
        disabled={deaktivert}
        aria-current={aktiv ? "page" : undefined}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
          deaktivert ? "cursor-not-allowed opacity-40" : ""
        } ${
          aktiv ? "bg-white/15 text-white" : "text-blue-200 hover:bg-white/10 hover:text-white"
        }`}
        style={farge ? { borderLeft: `3px solid ${farge}`, paddingLeft: "9px" } : undefined}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center"
          style={farge ? { color: farge } : undefined}
        >
          {element.ikon}
        </span>
        <span className="truncate">{t(element.labelKey)}</span>
      </button>
    );
  }

  // c2: lengste-prefiks-vinner blant firma-lenkene → nøyaktig én aktiv rad
  // (Timer vs Timer-rapport, Innstillinger vs Integrasjoner).
  const aktivFirmaHref = (() => {
    let best: string | null = null;
    for (const e of firmaNavElementer) {
      const treff =
        e.href === "/dashbord/firma"
          ? pathname === e.href
          : (pathname ?? "").startsWith(e.href);
      if (treff && (best === null || e.href.length > best.length)) best = e.href;
    }
    return best;
  })();

  function renderFirmaRad(element: FirmaNavElement): JSX.Element {
    const aktiv = element.href === aktivFirmaHref;
    return (
      <Link
        key={element.href}
        href={element.href}
        aria-current={aktiv ? "page" : undefined}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
          aktiv ? "bg-white/15 text-white" : "text-blue-200 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">{element.ikon}</span>
        <span className="truncate">{t(element.labelKey)}</span>
      </Link>
    );
  }

  return (
    <aside className="hidden min-w-[220px] flex-col bg-sitedoc-primary px-2 py-3 md:flex">
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {/* PROSJEKT-sone */}
        <SoneOverskrift>{t("nav.soneProsjekt")}</SoneOverskrift>
        {prosjektElementer.map(renderRad)}

        {/* FIRMA-sone (admin-nav admin-gated; Maskin gated på firmamodul) */}
        {visFirmaSone && (
          <>
            <SoneOverskrift>{t("nav.soneFirma")}</SoneOverskrift>
            {visFirmaAdminNav &&
              firmaNavElementer
                .filter((element) => {
                  if (element.kreverFirmaModul === "timer" && !harTimerModul) return false;
                  if (element.kreverFirmaModul === "varelager" && !harVarelagerModul) return false;
                  if (element.kreverSitedocAdmin && !erSitedocAdmin) return false;
                  if (element.kreverHmsTilgang && !harHmsTilgang) return false;
                  return true;
                })
                .map(renderFirmaRad)}
            {maskinElement && renderRad(maskinElement)}
          </>
        )}
      </nav>

      {/* Innstillinger fast nederst → huben (pinned, utenfor scroll-nav) */}
      <div className="flex flex-col gap-0.5 border-t border-white/10 pt-3">
        <Link
          href="/dashbord/innstillinger"
          aria-current={erHub ? "page" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
            erHub ? "bg-white/15 text-white" : "text-blue-200 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <Settings className="h-5 w-5" />
          </span>
          <span className="truncate">{t("nav.innstillinger")}</span>
        </Link>
      </div>
    </aside>
  );
}
