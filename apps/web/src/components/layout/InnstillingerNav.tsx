"use client";

/**
 * Delt innstillinger-sidemeny (finnbarhets-revisjon, Del 3).
 *
 * ÉN kilde: `useInnstillingerKort` — nøyaktig samme kort + underlenker + gating
 * som innstillinger-huben og søkeregistret. Sidemeny og hub-kort kan dermed
 * aldri divergere. Rendres i innstillinger-hubens layout (supplement — kort+søk
 * består som landing) og (etter frossen-sone-koordinering) i oppsett-layouten.
 *
 * Skjult <md (`hidden md:flex`) → mobil beholder 1c kort-liste uendret.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useInnstillingerKort, type HubKort, type Seksjon } from "@/lib/innstillinger-kort";

/** Lengste-prefiks-vinner (G12): kun én aktiv rad. */
function finnAktivHref(pathname: string, hrefs: string[]): string | null {
  let beste: string | null = null;
  for (const h of hrefs) {
    if (pathname === h || pathname.startsWith(h + "/")) {
      if (!beste || h.length > beste.length) beste = h;
    }
  }
  return beste;
}

export function InnstillingerNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { firmaKort, prosjektKort } = useInnstillingerKort();

  const soner: { seksjon: Seksjon; label: string; kort: HubKort[] }[] = [
    { seksjon: "prosjekt", label: t("nav.soneProsjekt"), kort: prosjektKort.filter((k) => k.synlig) },
    { seksjon: "firma", label: t("nav.soneFirma"), kort: firmaKort.filter((k) => k.synlig) },
  ];

  // Alle synlige underlenke-hrefs → lengste-prefiks-aktiv på tvers av soner.
  const alleHrefs = soner.flatMap((s) =>
    s.kort.flatMap((k) => k.underlenker.filter((l) => l.synlig !== false).map((l) => l.href)),
  );
  const aktivHref = finnAktivHref(pathname, alleHrefs);

  return (
    <aside className="hidden w-[280px] flex-col border-r border-gray-200 bg-white md:flex">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-900">{t("nav.innstillinger")}</h2>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {soner.map((sone) =>
          sone.kort.length === 0 ? null : (
            <div key={sone.seksjon} className="mb-3">
              <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {sone.label}
              </p>
              {sone.kort.map((kort) => {
                const lenker = kort.underlenker.filter((l) => l.synlig !== false);
                return (
                  <div key={kort.id} className="mb-1">
                    <div className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-semibold text-gray-700">
                      <span className="text-gray-400">{kort.ikon}</span>
                      {t(kort.tittelKey)}
                    </div>
                    <div className="ml-[34px]">
                      {lenker.map((lenke) => (
                        <Link
                          key={lenke.labelKey}
                          href={lenke.href}
                          className={`flex items-center rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                            lenke.href === aktivHref
                              ? "font-medium text-sitedoc-primary"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                          }`}
                        >
                          {t(lenke.labelKey)}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ),
        )}
      </nav>
    </aside>
  );
}
