"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useAktivSeksjon } from "@/hooks/useAktivSeksjon";
import { MODUL_FARGER, hentAktivModul } from "@/lib/modul-farger";
import {
  bunnelementer,
  kontakterElement,
  MODUL_EIERSKAP,
  navigerSidebar,
  useSidebarElementer,
  type SidebarElement,
} from "./sidebar-elementer";
import { useFirmaNavElementer, type FirmaNavElement } from "./firma-nav";

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

// s1: kollapset sidebar → 60px ikon-skinne. Tilstand persisteres per nettleser.
const NAV_KOLLAPS_NOKKEL = "sitedoc-nav-kollaps";

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
  const aktivSeksjon = useAktivSeksjon();
  const { t } = useTranslation();
  const aktivModul = hentAktivModul(pathname ?? "");
  const aksentFarge = aktivModul ? MODUL_FARGER[aktivModul] : null;

  // Kollaps-tilstand: start alltid utvidet på server + første render (unngår
  // hydrerings-avvik); faktisk verdi settes i effekten under.
  const [kollapset, setKollapset] = useState(false);
  useEffect(() => {
    setKollapset(window.localStorage.getItem(NAV_KOLLAPS_NOKKEL) === "1");
  }, []);
  function toggleKollaps() {
    setKollapset((v) => {
      const ny = !v;
      window.localStorage.setItem(NAV_KOLLAPS_NOKKEL, ny ? "1" : "0");
      return ny;
    });
  }

  const { filtrertHovedelementer, harMaskinModul } = useSidebarElementer();
  // Firma-nav + gating fra delt kilde (drift-fri; deles med søkemodalen).
  const firmaNav = useFirmaNavElementer();
  const visFirmaSone = firmaNav.length > 0 || harMaskinModul;

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
        title={kollapset ? t(element.labelKey) : undefined}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
          kollapset ? "justify-center" : ""
        } ${
          deaktivert ? "cursor-not-allowed opacity-40" : ""
        } ${
          aktiv ? "bg-white/15 text-white" : "text-blue-200 hover:bg-white/10 hover:text-white"
        }`}
        style={farge ? { borderLeft: `3px solid ${farge}`, paddingLeft: kollapset ? undefined : "9px" } : undefined}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center"
          style={farge ? { color: farge } : undefined}
        >
          {element.ikon}
        </span>
        {!kollapset && <span className="truncate">{t(element.labelKey)}</span>}
      </button>
    );
  }

  // c2: lengste-prefiks-vinner blant firma-lenkene → nøyaktig én aktiv rad
  // (Timer vs Timer-rapport, Innstillinger vs Integrasjoner).
  const aktivFirmaHref = (() => {
    let best: string | null = null;
    for (const e of firmaNav) {
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
        title={kollapset ? t(element.labelKey) : undefined}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
          kollapset ? "justify-center" : ""
        } ${
          aktiv ? "bg-white/15 text-white" : "text-blue-200 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">{element.ikon}</span>
        {!kollapset && <span className="truncate">{t(element.labelKey)}</span>}
      </Link>
    );
  }

  return (
    <aside
      className={`hidden flex-col bg-sitedoc-primary px-2 py-3 md:flex ${
        kollapset ? "w-[60px]" : "min-w-[220px]"
      }`}
    >
      {/* Kollaps-knapp (chevron) — persisteres i localStorage */}
      <div className={`mb-1 flex px-1 ${kollapset ? "justify-center" : "justify-end"}`}>
        <button
          type="button"
          onClick={toggleKollaps}
          title={kollapset ? t("nav.utvid") : t("nav.kollaps")}
          aria-label={kollapset ? t("nav.utvid") : t("nav.kollaps")}
          className="rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          {kollapset ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {/* PROSJEKT-sone */}
        {!kollapset && <SoneOverskrift>{t("nav.soneProsjekt")}</SoneOverskrift>}
        {prosjektElementer.map(renderRad)}

        {/* FIRMA-sone (admin-nav admin-gated; Maskin gated på firmamodul) */}
        {visFirmaSone && (
          <>
            {kollapset ? (
              <div className="my-1 border-t border-white/10" />
            ) : (
              <SoneOverskrift>{t("nav.soneFirma")}</SoneOverskrift>
            )}
            {firmaNav.map(renderFirmaRad)}
            {maskinElement && renderRad(maskinElement)}
          </>
        )}
      </nav>

      {/* Innstillinger fast nederst → huben (pinned, utenfor scroll-nav) */}
      <div className="flex flex-col gap-0.5 border-t border-white/10 pt-3">
        <Link
          href="/dashbord/innstillinger"
          aria-current={erHub ? "page" : undefined}
          title={kollapset ? t("nav.innstillinger") : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
            kollapset ? "justify-center" : ""
          } ${
            erHub ? "bg-white/15 text-white" : "text-blue-200 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <Settings className="h-5 w-5" />
          </span>
          {!kollapset && <span className="truncate">{t("nav.innstillinger")}</span>}
        </Link>
      </div>
    </aside>
  );
}
