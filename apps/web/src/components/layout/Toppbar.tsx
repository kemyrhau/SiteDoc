"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User, HardHat, ShieldCheck, Menu, X, Search, BarChart3, PanelLeftOpen } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useAktivSeksjon } from "@/hooks/useAktivSeksjon";
import { KontekstChip } from "./KontekstChip";
import { useSokModal } from "@/kontekst/sok-modal-kontekst";
import { useState, useRef, useEffect } from "react";
import { ruteErFirmaKontekst } from "@/lib/ruteKontekst";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useFirma } from "@/kontekst/firma-kontekst";
import { useNavBredde } from "@/kontekst/nav-bredde-kontekst";
import { SpraakVelger } from "./SpraakVelger";
import {
  bunnelementer,
  prosjektSoneElementer,
  navigerSidebar,
  useSidebarElementer,
} from "./sidebar-elementer";
import { useFirmaNavElementer } from "./firma-nav";
import { Settings } from "lucide-react";

export function Toppbar() {
  const { data: session } = useSession();
  const [brukerMeny, setBrukerMeny] = useState(false);
  const [mobilMeny, setMobilMeny] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const aktivSeksjon = useAktivSeksjon();
  const { prosjektId } = useProsjekt();
  const erFirmaKontekst = ruteErFirmaKontekst(pathname);
  const erHub = pathname?.startsWith("/dashbord/innstillinger") ?? false;
  const { erSitedocAdmin } = useFirma();
  // D2: henteknapp for skjult sidebar — deler bredde-tilstand med NavSidebar.
  const { bredde: navBredde, settBredde: settNavBredde } = useNavBredde();
  const { aapne: aapneSok } = useSokModal();
  const { t } = useTranslation();

  // T9: mobil-web-hamburgeren speiler NavSidebar-hierarkiet når flagget er på.
  // Samme delte kilder som NavSidebar (drift-fri gating G1–G12).
  const { filtrertHovedelementer, harMaskinModul } = useSidebarElementer();
  const firmaNav = useFirmaNavElementer();
  // FM5-filteret må gjelde hamburgeren òg (T9-avvik 2026-07-07) — delt kilde.
  const prosjektElementer = prosjektSoneElementer(filtrertHovedelementer);
  const maskinElement = harMaskinModul
    ? bunnelementer.find((e) => e.id === "maskin") ?? null
    : null;
  const visFirmaSone = firmaNav.length > 0 || harMaskinModul;
  // FM5/K2: «Mine timer» hører til brukermenyen (avatar) —
  // gjenbruker samme timer-firmamodul-gating som sidebaren.
  const mineTimerElement = filtrertHovedelementer.find((e) => e.id === "mine-timer") ?? null;

  useEffect(() => {
    function handleKlikk(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setBrukerMeny(false);
      }
    }
    document.addEventListener("mousedown", handleKlikk);
    return () => document.removeEventListener("mousedown", handleKlikk);
  }, []);

  return (
    <header className="relative flex h-12 items-center justify-between bg-sitedoc-primary px-4">
      {/* Venstre: Hamburger (mobil) + Logo + Prosjektvelger + Firma */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setMobilMeny(!mobilMeny)}
          className="flex items-center justify-center text-white md:hidden"
        >
          {mobilMeny ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <div className="hidden w-[60px] items-center justify-center md:flex">
          {navBredde === "skjult" ? (
            <button
              type="button"
              onClick={() => settNavBredde("full")}
              title={t("nav.visMeny")}
              aria-label={t("nav.visMeny")}
              className="rounded-lg p-1.5 text-white transition-colors hover:bg-white/10"
            >
              <PanelLeftOpen className="h-6 w-6" />
            </button>
          ) : (
            <HardHat className="h-6 w-6 text-white" />
          )}
        </div>
        <Link href="/" className="text-sm font-bold tracking-wide text-white hover:text-blue-200 transition">
          {t("app.navn")}
        </Link>
        <div className="mx-2 h-5 w-px bg-white/20" />
        {/* Samlet kontekst-chip (firma + prosjekt + byggeplass-trakt).
            K3 kloss 2: byggeplass bor i trakten (KontekstChip), ikke som
            frittstående velger. */}
        <KontekstChip />
        <div className="mx-1 h-5 w-px bg-white/20" />
        <button
          type="button"
          onClick={aapneSok}
          className="flex items-center gap-2 rounded-md bg-white/10 px-2.5 py-1.5 text-[12.5px] text-blue-100 transition-colors hover:bg-white/20"
          title={t("sok.overalt")}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{t("sok.overalt")}</span>
          <kbd className="rounded bg-white/15 px-1.5 py-0.5 text-[11px] font-medium">{t("layout.ctrlK")}</kbd>
        </button>
        {erSitedocAdmin && (
          <>
            <div className="mx-1 h-5 w-px bg-white/20" />
            <Link
              href="/dashbord/admin"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-amber-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">{t("toppbar.admin")}</span>
            </Link>
          </>
        )}
      </div>

      {/* Høyre: Språk + Brukerinfo */}
      <div className="flex items-center gap-1">
        <SpraakVelger />
      <div ref={ref} className="relative">
        <button
          onClick={() => setBrukerMeny(!brukerMeny)}
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-blue-100 transition-colors hover:bg-white/10 hover:text-white"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
            <User className="h-4 w-4" />
          </div>
          <span className="hidden max-w-[150px] truncate sm:inline">
            {session?.user?.name ?? session?.user?.email ?? t("toppbar.bruker")}
          </span>
        </button>

        {brukerMeny && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-sm font-medium text-gray-900">
                {session?.user?.name}
              </p>
              <p className="truncate text-xs text-gray-500">
                {session?.user?.email}
              </p>
            </div>
            {/* FM5/K2: «Mine timer» i brukermenyen (timer-firmamodul) */}
            {mineTimerElement && (
              <button
                type="button"
                onClick={() => {
                  setBrukerMeny(false);
                  router.push("/dashbord/timer/mine");
                }}
                className="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <BarChart3 className="h-4 w-4" />
                {t(mineTimerElement.labelKey)}
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4" />
              {t("toppbar.loggUt")}
            </button>
          </div>
        )}
      </div>
      </div>
      {/* Mobil-navigasjonsmeny */}
      {mobilMeny && (
        <div className="absolute left-0 top-12 z-50 w-full border-b border-gray-200 bg-white shadow-lg md:hidden">
          {/* T9: speiler NavSidebar-hierarkiet (PROSJEKT + FIRMA + Innstillinger) */}
          <nav className="flex max-h-[80vh] flex-col gap-0.5 overflow-y-auto p-3">
              <MobilSoneOverskrift>{t("nav.soneProsjekt")}</MobilSoneOverskrift>
              {prosjektElementer.map((element) => {
                const deaktivert = !!element.kreverProsjekt && !prosjektId;
                const aktiv = !erFirmaKontekst && !erHub && aktivSeksjon === element.id;
                return (
                  <MobilNavKnapp
                    key={element.id}
                    ikon={element.ikon}
                    label={t(element.labelKey)}
                    aktiv={aktiv}
                    deaktivert={deaktivert}
                    onClick={() => {
                      navigerSidebar(router, prosjektId, element);
                      setMobilMeny(false);
                    }}
                  />
                );
              })}

              {visFirmaSone && (
                <>
                  <MobilSoneOverskrift sone="firma">{t("nav.soneFirma")}</MobilSoneOverskrift>
                  {firmaNav.map((element) => (
                    <MobilNavKnapp
                      key={element.href}
                      ikon={element.ikon}
                      label={t(element.labelKey)}
                      aktiv={
                        element.href === "/dashbord/firma"
                          ? pathname === element.href
                          : (pathname ?? "").startsWith(element.href)
                      }
                      onClick={() => {
                        router.push(element.href);
                        setMobilMeny(false);
                      }}
                    />
                  ))}
                  {maskinElement && (
                    <MobilNavKnapp
                      ikon={maskinElement.ikon}
                      label={t(maskinElement.labelKey)}
                      aktiv={aktivSeksjon === "maskin"}
                      onClick={() => {
                        navigerSidebar(router, prosjektId, maskinElement);
                        setMobilMeny(false);
                      }}
                    />
                  )}
                </>
              )}

              <div className="mt-1 border-t border-gray-100 pt-1">
                <MobilNavKnapp
                  ikon={<Settings className="h-5 w-5" />}
                  label={t("nav.innstillinger")}
                  aktiv={erHub}
                  onClick={() => {
                    router.push("/dashbord/innstillinger");
                    setMobilMeny(false);
                  }}
                />
              </div>
            </nav>
        </div>
      )}
    </header>
  );
}

/* ---- T9: hjelpekomponenter for mobil-hamburger ---- */

function MobilSoneOverskrift({
  sone = "prosjekt",
  children,
}: {
  sone?: "prosjekt" | "firma";
  children: React.ReactNode;
}) {
  // D4/T9-paritet: FIRMA-label i amber-600 (mot hvit meny). Kun sonefargen
  // følger sidebaren — aktiv-markøren i hamburgeren endres ikke.
  const farge = sone === "firma" ? "text-amber-600" : "text-gray-400";
  return (
    <p className={`px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] ${farge}`}>
      {children}
    </p>
  );
}

function MobilNavKnapp({
  ikon,
  label,
  aktiv,
  deaktivert,
  onClick,
}: {
  ikon: React.ReactNode;
  label: string;
  aktiv: boolean;
  deaktivert?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={deaktivert}
      onClick={deaktivert ? undefined : onClick}
      aria-current={aktiv ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
        aktiv
          ? "bg-sitedoc-primary/10 text-sitedoc-primary"
          : deaktivert
            ? "cursor-not-allowed text-gray-300"
            : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{ikon}</span>
      {label}
    </button>
  );
}
