"use client";

import Link from "next/link";
import { Card } from "@siteflow/ui";
import {
  Wrench,
  ClipboardList,
  Search,
  CheckSquare,
} from "lucide-react";

interface KategoriKort {
  tittel: string;
  ikon: React.ReactNode;
  lenker: { label: string; href: string }[];
}

const kategorier: KategoriKort[] = [
  {
    tittel: "Oppgaver",
    ikon: <Wrench className="h-10 w-10 text-gray-400" />,
    lenker: [
      { label: "Oppgavemaler", href: "/dashbord/oppsett/field/oppgavemaler" },
      { label: "Hurtig-overskrifter", href: "/dashbord/oppsett/field/hurtig-overskrifter" },
      { label: "Bransjekartlegging", href: "/dashbord/oppsett/field/bransjekartlegging" },
      { label: "Entreprisetilknytning", href: "/dashbord/oppsett/field/entrepriser" },
      { label: "Maler for oppgavenotifikasjon", href: "/dashbord/oppsett/field/oppgavenotifikasjon" },
    ],
  },
  {
    tittel: "Sjekklister",
    ikon: <ClipboardList className="h-10 w-10 text-gray-400" />,
    lenker: [
      { label: "Sjekklistemaler", href: "/dashbord/oppsett/field/sjekklistemaler" },
      { label: "Slettede sjekklister", href: "/dashbord/oppsett/field/slettede-sjekklister" },
      { label: "Entreprisetilknytning", href: "/dashbord/oppsett/field/sjekkliste-entrepriser" },
    ],
  },
  {
    tittel: "Kontrollplaner",
    ikon: <Search className="h-10 w-10 text-gray-400" />,
    lenker: [
      { label: "Kontrollplaner", href: "/dashbord/oppsett/field/kontrollplaner" },
      { label: "Kontrollplanmatriser", href: "/dashbord/oppsett/field/kontrollplanmatriser" },
      { label: "Arbeidsforløp oppgave knytning", href: "/dashbord/oppsett/field/arbeidsforlop" },
    ],
  },
  {
    tittel: "Testplaner",
    ikon: <CheckSquare className="h-10 w-10 text-gray-400" />,
    lenker: [
      { label: "Testplaner", href: "/dashbord/oppsett/field/testplaner" },
      { label: "Testplanmatriser", href: "/dashbord/oppsett/field/testplanmatriser" },
    ],
  },
];

export default function FieldSide() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Field</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {kategorier.map((kategori) => (
          <Card key={kategori.tittel} className="flex gap-4">
            <div className="flex-shrink-0 pt-1">{kategori.ikon}</div>
            <div className="flex-1">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {kategori.tittel}
              </h3>
              <ul className="space-y-1.5">
                {kategori.lenker.map((lenke) => (
                  <li key={lenke.href}>
                    <Link
                      href={lenke.href}
                      className="text-sm text-siteflow-primary hover:underline"
                    >
                      {lenke.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
