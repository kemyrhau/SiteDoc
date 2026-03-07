"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  MapPin,
  Wrench,
  Home,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import type { Permission } from "@sitedoc/shared";

interface NavElement {
  label: string;
  href: string;
  ikon: React.ReactNode;
  barn?: { label: string; href: string }[];
  kreverProsjekt?: boolean;
  tillatelse?: Permission;
}

const navigasjon: NavElement[] = [
  {
    label: "Brukere",
    href: "/dashbord/oppsett/brukere",
    ikon: <Users className="h-4 w-4" />,
    kreverProsjekt: true,
    barn: [
      { label: "Brukergrupper", href: "/dashbord/oppsett/brukere" },
      { label: "Tillatelser", href: "/dashbord/oppsett/brukere/tillatelser" },
    ],
  },
  {
    label: "Lokasjoner",
    href: "/dashbord/oppsett/lokasjoner",
    ikon: <MapPin className="h-4 w-4" />,
    kreverProsjekt: true,
  },
  {
    label: "Feltarbeid",
    href: "/dashbord/oppsett/field",
    ikon: <Wrench className="h-4 w-4" />,
    kreverProsjekt: true,
    tillatelse: "manage_field",
    barn: [
      { label: "Entrepriser", href: "/dashbord/oppsett/field/entrepriser" },
      { label: "Oppgavemaler", href: "/dashbord/oppsett/field/oppgavemaler" },
      { label: "Sjekklistemaler", href: "/dashbord/oppsett/field/sjekklistemaler" },
      { label: "Moduler", href: "/dashbord/oppsett/field/moduler" },
      { label: "Kontrollplan", href: "/dashbord/oppsett/field/kontrollplaner" },
      { label: "Mappeoppsett", href: "/dashbord/oppsett/field/box" },
    ],
  },
  {
    label: "Prosjekteiers innstillinger",
    href: "/dashbord/oppsett/prosjektoppsett",
    ikon: <Home className="h-4 w-4" />,
    barn: [
      { label: "Eierportalens brukere", href: "/dashbord/oppsett/eierportal-brukere" },
      { label: "Prosjektoppsett", href: "/dashbord/oppsett/prosjektoppsett" },
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

  const { data: tillatelser } = trpc.gruppe.hentMineTillatelser.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const filtrertNavigasjon = navigasjon.filter((element) => {
    if (!element.tillatelse) return true;
    if (!tillatelser) return false;
    return tillatelser.includes(element.tillatelse);
  });

  const [ekspandert, setEkspandert] = useState<Record<string, boolean>>({
    Brukere: true,
    Lokasjoner: true,
    Feltarbeid: true,
    "Prosjekteiers innstillinger": false,
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
      <aside className="flex w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Innstillinger</h2>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {filtrertNavigasjon.map((element) => {
            const harBarn = element.barn && element.barn.length > 0;
            const erEkspandert = ekspandert[element.label] ?? false;
            const aktiv = erAktiv(element.href);
            const deaktivert = element.kreverProsjekt && !prosjektId;

            return (
              <div key={element.label} className={`mb-0.5 ${deaktivert ? "opacity-40" : ""}`}>
                <div className="flex items-center">
                  {harBarn ? (
                    <>
                      <button
                        onClick={() => !deaktivert && toggleEkspander(element.label)}
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
                          {element.label}
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
                          {element.label}
                        </Link>
                      )}
                    </>
                  ) : deaktivert ? (
                    <span className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 pl-[30px] text-sm font-medium text-gray-400 cursor-not-allowed">
                      {element.ikon}
                      {element.label}
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
                      {element.label}
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
                        {barn.label}
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
