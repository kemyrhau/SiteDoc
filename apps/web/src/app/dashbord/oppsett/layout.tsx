"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  MapPin,
  Wrench,
  Archive,
  Home,
  ChevronRight,
  ChevronDown,
  Settings,
} from "lucide-react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";

interface NavElement {
  label: string;
  href: string;
  ikon: React.ReactNode;
  barn?: { label: string; href: string }[];
}

const navigasjon: NavElement[] = [
  {
    label: "Brukere",
    href: "/dashbord/oppsett/brukere",
    ikon: <Users className="h-4 w-4" />,
  },
  {
    label: "Lokasjoner",
    href: "/dashbord/oppsett/lokasjoner",
    ikon: <MapPin className="h-4 w-4" />,
  },
  {
    label: "Field",
    href: "/dashbord/oppsett/field",
    ikon: <Wrench className="h-4 w-4" />,
    barn: [
      { label: "Entrepriser", href: "/dashbord/oppsett/field/entrepriser" },
      { label: "Box", href: "/dashbord/oppsett/field/box" },
    ],
  },
  {
    label: "Owners Portal",
    href: "/dashbord/oppsett/prosjektoppsett",
    ikon: <Home className="h-4 w-4" />,
    barn: [
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
  const [ekspandert, setEkspandert] = useState<Record<string, boolean>>({
    Field: true,
    "Owners Portal": false,
  });

  if (!prosjektId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50">
        <div className="text-center">
          <Settings className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="text-lg font-medium text-gray-600">
            Velg et prosjekt for å se innstillinger
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Innstillinger er prosjektspesifikke
          </p>
        </div>
      </div>
    );
  }

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
          {navigasjon.map((element) => {
            const harBarn = element.barn && element.barn.length > 0;
            const erEkspandert = ekspandert[element.label] ?? false;
            const aktiv = erAktiv(element.href);

            return (
              <div key={element.label} className="mb-0.5">
                <div className="flex items-center">
                  {harBarn ? (
                    <>
                      <button
                        onClick={() => toggleEkspander(element.label)}
                        className="mr-1 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        {erEkspandert ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <Link
                        href={element.href}
                        className={`flex flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                          aktiv
                            ? "bg-siteflow-primary/10 text-siteflow-primary"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {element.ikon}
                        {element.label}
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={element.href}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 pl-[30px] text-sm font-medium transition-colors ${
                        aktiv
                          ? "bg-siteflow-primary/10 text-siteflow-primary"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {element.ikon}
                      {element.label}
                    </Link>
                  )}
                </div>

                {/* Barn-elementer */}
                {harBarn && erEkspandert && (
                  <div className="ml-[30px] mt-0.5">
                    {element.barn!.map((barn) => (
                      <Link
                        key={barn.href}
                        href={barn.href}
                        className={`flex items-center rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                          erAktiv(barn.href)
                            ? "font-medium text-siteflow-primary"
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
