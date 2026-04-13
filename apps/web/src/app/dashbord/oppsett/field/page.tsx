"use client";

import Link from "next/link";
import {
  Wrench,
  ClipboardCheck,
  SearchCheck,
  ThumbsUp,
  CloudSun,
  Camera,
  BookOpen,
  HardHat,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Typer                                                              */
/* ------------------------------------------------------------------ */

interface FieldLenke {
  label: string;
  href: string;
  undertekst?: string;
}

interface FieldKategori {
  tittel: string;
  ikon: React.ReactNode;
  lenker: FieldLenke[];
  aktiv: boolean;
}

/* ------------------------------------------------------------------ */
/*  Kategorier                                                         */
/* ------------------------------------------------------------------ */

const kategorier: FieldKategori[] = [
  {
    tittel: "Oppgaver",
    ikon: <Wrench className="h-12 w-12 text-gray-400" />,
    aktiv: true,
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
    ikon: <ClipboardCheck className="h-12 w-12 text-gray-400" />,
    aktiv: true,
    lenker: [
      { label: "Sjekklistemaler", href: "/dashbord/oppsett/field/sjekklistemaler" },
      { label: "Sjekklistemaler med holdepunkt", href: "/dashbord/oppsett/field/sjekklistemaler-holdepunkt" },
      { label: "Slettede sjekklister", href: "/dashbord/oppsett/field/slettede-sjekklister" },
      { label: "Entreprisetilknytning", href: "/dashbord/oppsett/field/sjekkliste-entrepriser" },
    ],
  },
  {
    tittel: "Kontrollplaner",
    ikon: <SearchCheck className="h-12 w-12 text-gray-300" />,
    aktiv: false,
    lenker: [
      { label: "Kontrollplaner", href: "#" },
      { label: "Kontrollplanmatriser", href: "#" },
      { label: "Arbeidsforløp oppgave knytning", href: "#" },
    ],
  },
  {
    tittel: "Godkjennelser",
    ikon: <ThumbsUp className="h-12 w-12 text-gray-300" />,
    aktiv: false,
    lenker: [
      { label: "Godkjennelsesmaler", href: "#" },
    ],
  },
  {
    tittel: "Vær",
    ikon: <CloudSun className="h-12 w-12 text-gray-300" />,
    aktiv: false,
    lenker: [
      { label: "Vær", href: "#", undertekst: "Deaktivert" },
      { label: "Vis været på dashbordet", href: "#", undertekst: "Deaktivert" },
      { label: "Værdata", href: "#" },
    ],
  },
  {
    tittel: "Capture",
    ikon: <Camera className="h-12 w-12 text-gray-300" />,
    aktiv: false,
    lenker: [
      { label: "Capture typer", href: "#", undertekst: "Fotoalbumer" },
      { label: "Grupper med adgang", href: "#" },
      { label: "Slettede fotoalbum", href: "#" },
    ],
  },
  {
    tittel: "Daglig logg",
    ikon: <BookOpen className="h-12 w-12 text-gray-300" />,
    aktiv: false,
    lenker: [
      { label: "Typer", href: "#" },
      { label: "Rettigheter", href: "#" },
      { label: "Loggfør været", href: "#" },
      { label: "Signaturer", href: "#", undertekst: "Deaktivert" },
    ],
  },
  {
    tittel: "HMS",
    ikon: <HardHat className="h-12 w-12 text-gray-300" />,
    aktiv: false,
    lenker: [
      { label: "HMS-kategorier", href: "#" },
      { label: "HMS-observasjon", href: "#" },
      { label: "Verneprotokoll", href: "#" },
      { label: "HMS-oppgave", href: "#" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Kort-komponent                                                     */
/* ------------------------------------------------------------------ */

function FieldKort({ kategori }: { kategori: FieldKategori }) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white ${
        !kategori.aktiv ? "opacity-50" : ""
      }`}
    >
      {/* Header */}
      <div className="border-b border-gray-200 px-5 py-3">
        <h3 className="text-base font-bold text-gray-900">{kategori.tittel}</h3>
      </div>

      {/* Innhold */}
      <div className="flex gap-5 px-5 py-4">
        <div className="flex-shrink-0 pt-1">{kategori.ikon}</div>
        <ul className="flex flex-col gap-2">
          {kategori.lenker.map((lenke) =>
            kategori.aktiv ? (
              <li key={lenke.label}>
                <Link
                  href={lenke.href}
                  className="text-sm text-gray-900 hover:text-sitedoc-primary hover:underline"
                >
                  {lenke.label}
                </Link>
                {lenke.undertekst && (
                  <span className="ml-1 text-xs text-gray-400">
                    {lenke.undertekst}
                  </span>
                )}
              </li>
            ) : (
              <li key={lenke.label} className="flex items-center gap-1">
                <span className="text-sm text-gray-400">{lenke.label}</span>
                {lenke.undertekst && (
                  <span className="text-xs text-gray-300">
                    {lenke.undertekst}
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
      </div>

      {/* Kommer snart-melding for inaktive */}
      {!kategori.aktiv && (
        <div className="border-t border-gray-100 px-5 py-2">
          <span className="text-xs text-gray-400">Kommer snart</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Side                                                               */
/* ------------------------------------------------------------------ */

export default function FieldSide() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Feltarbeid</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {kategorier.map((kategori) => (
          <FieldKort key={kategori.tittel} kategori={kategori} />
        ))}
      </div>
    </div>
  );
}
