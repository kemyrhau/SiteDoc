"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Settings, PanelLeftClose, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useAktivSeksjon } from "@/hooks/useAktivSeksjon";
import { useNavBredde, type NavBredde } from "@/kontekst/nav-bredde-kontekst";
import {
  bunnelementer,
  prosjektSoneElementer,
  navigerSidebar,
  useSidebarElementer,
  type SidebarElement,
} from "./sidebar-elementer";
import { useFirmaNavElementer, type FirmaNavElement } from "./firma-nav";

/**
 * NavSidebar (steg iii) — samlet sidebar bak `nyNavigasjon`-flagget.
 *
 * Tre soner: PROSJEKT (dagens hovedelementer + P31 Kontakter, uendret
 * gating G1–G12), FIRMA (admin-gated, speiler firma/layout-navigasjonen —
 * løser P4 fra admin-navigasjonsanalysen), og «Innstillinger» fast nederst
 * → huben. Gjelder overalt når flagget er på; firma-layoutens egen sidebar
 * undertrykkes da (se firma/layout.tsx). Flagg av = denne komponenten
 * monteres ikke; HovedSidebar brukes uendret.
 *
 * Del 5 runde 3 (fabel 2026-07-12):
 *  - D3 aktiv-markør: hvit 3px venstrekant + bg-white/20 + hvit tekst.
 *    Nøytral og lik i begge soner. Den gamle modul-fargekanten
 *    (MODUL_FARGER) er fjernet herfra — MODUL_FARGER/gating er urørt og
 *    lever videre på andre flater.
 *  - D4 amber FIRMA-sone: soneidentiteten bæres av SONEN, ikke markøren.
 *    FIRMA-overskrift i amber-300 (#fcd34d) + diskret 2px amber venstrestrek
 *    på FIRMA-blokken (inkl. slank-modus, der streken er eneste soneidentitet).
 *    PROSJEKT beholder blue-300 (#93c5fd).
 *  - D1 kollapsbare soner: klikkbare overskrifter (chevron + aria-expanded).
 *    Kollapset sone = kun overskriftsraden, UNNTAK: inneholder sonen aktiv
 *    side, vises den aktive raden likevel (aldri «usynlig hvor jeg er»).
 *    Default begge utvidet. Sone-kollaps gjelder kun utvidet bredde — i slank
 *    (60px) vises alltid alle ikoner. Tilstand persisteres per nettleser
 *    (localStorage); flyttes til User-felt i D5.
 */

// D1: sone-kollaps per nettleser ("0" = kollapset; default/åpen ellers).
const SONE_PROSJEKT_NOKKEL = "sitedoc-nav-sone-prosjekt";
const SONE_FIRMA_NOKKEL = "sitedoc-nav-sone-firma";

// D2: i18n-nøkler for bredde-trinnene (brukt i tre-trinns-knappens tooltip).
const BREDDE_LABEL: Record<NavBredde, string> = {
  full: "nav.bredde.full",
  slank: "nav.bredde.slank",
  skjult: "nav.bredde.skjult",
};

// D3 — felles aktiv-markør (nøytral, høykontrast, lik i alle soner + moduser).
const AKTIV_KLASSE = "bg-white/20 text-white";
const INAKTIV_KLASSE = "text-blue-200 hover:bg-white/10 hover:text-white";
function aktivStil(kollapset: boolean) {
  // Hvit 3px venstrekant. I utvidet modus trekkes venstre-padding 3px inn
  // (px-3 = 12px → 9px) så tekst/ikon holder samme innrykk som inaktive rader.
  return { borderLeft: "3px solid #ffffff", paddingLeft: kollapset ? undefined : "9px" };
}

// D4 — sone-strek. Begge blokker får 2px venstrekant slik at radene holder
// samme innrykk; kun FIRMA-streken er synlig (amber-300), PROSJEKT er
// gjennomsiktig. `paddingLeft` matcher footeren (Innstillinger) under.
const SONE_BLOKK_PADDING = "6px";
const PROSJEKT_STREK = "2px solid transparent";
const FIRMA_STREK = "2px solid #fcd34d";

function SoneOverskrift({
  sone,
  apen,
  onToggle,
  children,
}: {
  sone: "prosjekt" | "firma";
  apen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  // D4: PROSJEKT = blue-300 (#93c5fd), FIRMA = amber-300 (#fcd34d).
  const farge = sone === "firma" ? "text-amber-300" : "text-blue-300";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={apen}
      className={`flex w-full items-center justify-between rounded-md px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors hover:text-white ${farge}`}
    >
      <span>{children}</span>
      {apen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
    </button>
  );
}

export function NavSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { prosjektId } = useProsjekt();
  const aktivSeksjon = useAktivSeksjon();
  const { t } = useTranslation();

  // D2: bredde-trinn (full/slank/skjult) fra delt kontekst — deles med
  // Toppbarens henteknapp. `kollapset` = slank (60px ikon-skinne).
  const { bredde, nesteBredde, syklBredde } = useNavBredde();
  const kollapset = bredde === "slank";

  // D1: sone-tilstand (default utvidet). Hydreres fra localStorage i effekten.
  const [prosjektApen, setProsjektApen] = useState(true);
  const [firmaApen, setFirmaApen] = useState(true);
  useEffect(() => {
    setProsjektApen(window.localStorage.getItem(SONE_PROSJEKT_NOKKEL) !== "0");
    setFirmaApen(window.localStorage.getItem(SONE_FIRMA_NOKKEL) !== "0");
  }, []);
  function toggleSone(nokkel: string, setter: (fn: (v: boolean) => boolean) => void) {
    setter((v) => {
      const ny = !v;
      window.localStorage.setItem(nokkel, ny ? "1" : "0");
      return ny;
    });
  }

  const { filtrertHovedelementer, harMaskinModul } = useSidebarElementer();
  // Firma-nav + gating fra delt kilde (drift-fri; deles med søkemodalen).
  const firmaNav = useFirmaNavElementer();
  const visFirmaSone = firmaNav.length > 0 || harMaskinModul;

  // FM5/K2: «Mine timer» er brukerens egen flate → brukermeny + søk, ikke
  // PROSJEKT-sonen. Delt filter (`prosjektSoneElementer`) så hamburgeren ikke
  // kan divergere (T9-avvik 2026-07-07).
  const prosjektElementer = prosjektSoneElementer(filtrertHovedelementer);
  // Maskin er firmamodul (K1) — vises i FIRMA-sonen, gated på harMaskinModul
  // (uavhengig av firma-admin). Beholder button-rendring via renderRad.
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
        } ${aktiv ? AKTIV_KLASSE : INAKTIV_KLASSE}`}
        style={aktiv ? aktivStil(kollapset) : undefined}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">{element.ikon}</span>
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
        } ${aktiv ? AKTIV_KLASSE : INAKTIV_KLASSE}`}
        style={aktiv ? aktivStil(kollapset) : undefined}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">{element.ikon}</span>
        {!kollapset && <span className="truncate">{t(element.labelKey)}</span>}
      </Link>
    );
  }

  // D1: hvilke rader vises. Sone-kollaps gjelder kun utvidet bredde — i slank
  // (60px) vises alltid alt. UNNTAKET: en kollapset sone som inneholder aktiv
  // side viser den aktive raden likevel.
  const visAlleProsjekt = kollapset || prosjektApen;
  const prosjektRader = visAlleProsjekt
    ? prosjektElementer
    : prosjektElementer.filter(erElementAktiv);

  const visAlleFirma = kollapset || firmaApen;
  const firmaRader = visAlleFirma ? firmaNav : firmaNav.filter((e) => e.href === aktivFirmaHref);
  const visMaskin = !!maskinElement && (visAlleFirma || erElementAktiv(maskinElement));

  // D2: skjult → sidebaren monteres ikke; Toppbaren viser henteknappen.
  if (bredde === "skjult") return null;

  return (
    <aside
      className={`hidden flex-col bg-sitedoc-primary px-2 py-3 md:flex ${
        kollapset ? "w-[60px]" : "min-w-[220px]"
      }`}
    >
      {/* D2 tre-trinns-knapp: full → slank → skjult. Tooltip viser neste trinn. */}
      <div className={`mb-1 flex px-1 ${kollapset ? "justify-center" : "justify-end"}`}>
        <button
          type="button"
          onClick={syklBredde}
          title={t("nav.nesteBredde", { modus: t(BREDDE_LABEL[nesteBredde]) })}
          aria-label={t("nav.nesteBredde", { modus: t(BREDDE_LABEL[nesteBredde]) })}
          className="rounded-lg p-1.5 text-blue-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          <PanelLeftClose className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {/* PROSJEKT-sone (transparent sone-strek for alignment med FIRMA) */}
        <div style={{ borderLeft: PROSJEKT_STREK, paddingLeft: SONE_BLOKK_PADDING }}>
          {!kollapset && (
            <SoneOverskrift
              sone="prosjekt"
              apen={prosjektApen}
              onToggle={() => toggleSone(SONE_PROSJEKT_NOKKEL, setProsjektApen)}
            >
              {t("nav.soneProsjekt")}
            </SoneOverskrift>
          )}
          {prosjektRader.map(renderRad)}
        </div>

        {/* FIRMA-sone (D4: amber sone-strek + amber overskrift; Maskin gated på firmamodul) */}
        {visFirmaSone && (
          <div style={{ borderLeft: FIRMA_STREK, paddingLeft: SONE_BLOKK_PADDING }}>
            {kollapset ? (
              <div className="my-1 border-t border-white/10" />
            ) : (
              <SoneOverskrift
                sone="firma"
                apen={firmaApen}
                onToggle={() => toggleSone(SONE_FIRMA_NOKKEL, setFirmaApen)}
              >
                {t("nav.soneFirma")}
              </SoneOverskrift>
            )}
            {firmaRader.map(renderFirmaRad)}
            {visMaskin && maskinElement && renderRad(maskinElement)}
          </div>
        )}
      </nav>

      {/* Innstillinger fast nederst → huben (pinned, utenfor scroll-nav) */}
      <div
        className="flex flex-col gap-0.5 border-t border-white/10 pt-3"
        style={{ paddingLeft: SONE_BLOKK_PADDING }}
      >
        <Link
          href="/dashbord/innstillinger"
          aria-current={erHub ? "page" : undefined}
          title={kollapset ? t("nav.innstillinger") : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
            kollapset ? "justify-center" : ""
          } ${erHub ? AKTIV_KLASSE : INAKTIV_KLASSE}`}
          style={erHub ? aktivStil(kollapset) : undefined}
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
