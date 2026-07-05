"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useAktivSeksjon } from "@/hooks/useAktivSeksjon";
import { MODUL_FARGER, hentAktivModul } from "@/lib/modul-farger";
import {
  bunnelementer,
  MODUL_EIERSKAP,
  navigerSidebar,
  useSidebarElementer,
  type SidebarElement,
} from "./sidebar-elementer";

export function HovedSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { prosjektId } = useProsjekt();
  const aktivSeksjon = useAktivSeksjon();
  const { t } = useTranslation();
  const aktivModul = hentAktivModul(pathname ?? "");
  const aksentFarge = aktivModul ? MODUL_FARGER[aktivModul] : null;

  const { filtrertHovedelementer, harMaskinModul } = useSidebarElementer();

  function renderRad(element: SidebarElement): JSX.Element {
    const deaktivert = element.kreverProsjekt && !prosjektId;
    const aktiv = aktivSeksjon === element.id;
    const eiermodul = MODUL_EIERSKAP[element.id];
    // Aksent kun på modul-eide elementer når DENNE modulen er aktiv.
    // Forhindrer at f.eks. «Timer-attestering» får farge på maskin-rute.
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
          aktiv
            ? "bg-white/15 text-white"
            : "text-blue-200 hover:bg-white/10 hover:text-white"
        }`}
        style={
          farge
            ? { borderLeft: `3px solid ${farge}`, paddingLeft: "9px" }
            : undefined
        }
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

  return (
    <aside className="hidden min-w-[200px] flex-col bg-sitedoc-primary px-2 py-3 md:flex">
      {/* Hovedelementer */}
      <nav className="flex flex-1 flex-col gap-0.5">
        {filtrertHovedelementer.map(renderRad)}
      </nav>

      {/* Bunnelementer */}
      <div className="flex flex-col gap-0.5 border-t border-white/10 pt-3">
        {bunnelementer
          .filter((element) => {
            if (element.kreverFirmaModul === "maskin" && !harMaskinModul) return false;
            return true;
          })
          .map(renderRad)}
      </div>
    </aside>
  );
}
