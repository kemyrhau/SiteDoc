"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  MapPin,
  Wrench,
  Home,
  Brain,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import type { Permission } from "@sitedoc/shared";

interface NavBarn {
  labelKey: string;
  href: string;
  skjult?: boolean;
}

interface NavElement {
  id: string;
  labelKey: string;
  href: string;
  ikon: React.ReactNode;
  barn?: NavBarn[];
  kreverProsjekt?: boolean;
  tillatelse?: Permission;
}

const navigasjon: NavElement[] = [
  {
    id: "brukere",
    labelKey: "oppsett.brukere",
    href: "/dashbord/oppsett/brukere",
    ikon: <Users className="h-4 w-4" />,
    kreverProsjekt: true,
  },
  {
    id: "lokasjoner",
    labelKey: "oppsett.lokasjoner",
    href: "/dashbord/oppsett/lokasjoner",
    ikon: <MapPin className="h-4 w-4" />,
    kreverProsjekt: true,
  },
  {
    id: "feltarbeid",
    labelKey: "oppsett.feltarbeid",
    href: "/dashbord/oppsett/field",
    ikon: <Wrench className="h-4 w-4" />,
    kreverProsjekt: true,
    tillatelse: "manage_field",
    barn: [
      { labelKey: "oppsett.entrepriser", href: "/dashbord/oppsett/field/entrepriser" },
      { labelKey: "oppsett.oppgavemaler", href: "/dashbord/oppsett/field/oppgavemaler" },
      { labelKey: "oppsett.sjekklistemaler", href: "/dashbord/oppsett/field/sjekklistemaler" },
      { labelKey: "oppsett.moduler", href: "/dashbord/oppsett/field/moduler" },
      { labelKey: "oppsett.kontrollplan", href: "/dashbord/oppsett/field/kontrollplaner" },
      { labelKey: "oppsett.mappeoppsett", href: "/dashbord/oppsett/field/box" },
      { labelKey: "nav.psi", href: "/dashbord/oppsett/field/psi", skjult: true },
    ],
  },
  {
    id: "ai-sok",
    labelKey: "oppsett.aiSok",
    href: "/dashbord/oppsett/ai-sok",
    ikon: <Brain className="h-4 w-4" />,
    kreverProsjekt: true,
  },
  {
    id: "prosjekteier",
    labelKey: "oppsett.prosjekteier",
    href: "/dashbord/oppsett/prosjektoppsett",
    ikon: <Home className="h-4 w-4" />,
    barn: [
      { labelKey: "oppsett.firmainnstillinger", href: "/dashbord/oppsett/firma" },
      { labelKey: "oppsett.prosjektoppsett", href: "/dashbord/oppsett/prosjektoppsett" },
    ],
  },
];

export default function OppsettLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { prosjektId } = useProsjekt();
  const pathname = usePathname();
  const { t } = useTranslation();

  // Hent prosjektets firma (for Firmainnstillinger-synlighet)
  const { data: prosjektFirma } = trpc.organisasjon.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  // Sjekk om bruker er sitedoc_admin
  const { data: erAdmin } = trpc.admin.erAdmin.useQuery();

  const { data: tillatelser } = trpc.gruppe.hentMineTillatelser.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const { data: moduler } = trpc.modul.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const erPsiAktiv = moduler?.some((m: { moduleSlug: string; active: boolean }) => m.moduleSlug === "psi" && m.active) ?? false;

  const harFirmaTilgang = !!prosjektFirma || !!erAdmin;

  const filtrertNavigasjon = navigasjon
    .filter((element) => {
      if (!element.tillatelse) return true;
      if (!tillatelser) return false;
      return tillatelser.includes(element.tillatelse);
    })
    .map((element) => {
      if (!element.barn) return element;
      const filtrerBarn = element.barn.filter((barn) => {
        if (barn.href === "/dashbord/oppsett/firma") {
          return harFirmaTilgang;
        }
        if (barn.href === "/dashbord/oppsett/field/psi") {
          return erPsiAktiv;
        }
        return !barn.skjult;
      });
      return { ...element, barn: filtrerBarn };
    });

  const [ekspandert, setEkspandert] = useState<Record<string, boolean>>({
    lokasjoner: true,
    feltarbeid: true,
    prosjekteier: false,
  });

  function toggleEkspander(label: string) {
    setEkspandert((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function erAktiv(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Innstillings-sidebar */}
      <aside className="hidden w-[280px] flex-col border-r border-gray-200 bg-white md:flex">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{t("nav.innstillinger")}</h2>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {filtrertNavigasjon.map((element) => {
            const harBarn = element.barn && element.barn.length > 0;
            const erEkspandert = ekspandert[element.id] ?? false;
            const aktiv = erAktiv(element.href);
            const deaktivert = element.kreverProsjekt && !prosjektId;

            return (
              <div key={element.id} className={`mb-0.5 ${deaktivert ? "opacity-40" : ""}`}>
                <div className="flex items-center">
                  {harBarn ? (
                    <>
                      <button
                        onClick={() => !deaktivert && toggleEkspander(element.id)}
                        className={`mr-1 rounded p-0.5 ${deaktivert ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
                      >
                        {erEkspandert ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {deaktivert ? (
                        <span className="flex flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
                          {element.ikon}
                          {t(element.labelKey)}
                        </span>
                      ) : (
                        <Link
                          href={element.href}
                          className={`flex flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                            aktiv
                              ? "bg-sitedoc-primary/10 text-sitedoc-primary"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {element.ikon}
                          {t(element.labelKey)}
                        </Link>
                      )}
                    </>
                  ) : deaktivert ? (
                    <span className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 pl-[30px] text-sm font-medium text-gray-400 cursor-not-allowed">
                      {element.ikon}
                      {t(element.labelKey)}
                    </span>
                  ) : (
                    <Link
                      href={element.href}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 pl-[30px] text-sm font-medium transition-colors ${
                        aktiv
                          ? "bg-sitedoc-primary/10 text-sitedoc-primary"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {element.ikon}
                      {t(element.labelKey)}
                    </Link>
                  )}
                </div>

                {/* Barn-elementer */}
                {harBarn && erEkspandert && !deaktivert && (
                  <div className="ml-[30px] mt-0.5">
                    {element.barn!.map((barn) => (
                      <Link
                        key={barn.href}
                        href={barn.href}
                        className={`flex items-center rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                          erAktiv(barn.href)
                            ? "font-medium text-sitedoc-primary"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        }`}
                      >
                        {t(barn.labelKey)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Hovedinnhold */}
      <main className="flex-1 overflow-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  );
}
