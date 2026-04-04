"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
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
/*  Kort-komponent                                                     */
/* ------------------------------------------------------------------ */

function FieldKort({ kategori, kommerSnartTekst }: { kategori: FieldKategori; kommerSnartTekst: string }) {
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
          <span className="text-xs text-gray-400">{kommerSnartTekst}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Side                                                               */
/* ------------------------------------------------------------------ */

export default function FieldSide() {
  const { t } = useTranslation();

  const kategorier: FieldKategori[] = [
    {
      tittel: t("nav.oppgaver"),
      ikon: <Wrench className="h-12 w-12 text-gray-400" />,
      aktiv: true,
      lenker: [
        { label: t("oppsett.oppgavemaler"), href: "/dashbord/oppsett/field/oppgavemaler" },
        { label: t("feltarbeid.hurtigOverskrifter"), href: "/dashbord/oppsett/field/hurtig-overskrifter" },
        { label: t("feltarbeid.bransjekartlegging"), href: "/dashbord/oppsett/field/bransjekartlegging" },
        { label: t("feltarbeid.entreprisetilknytning"), href: "/dashbord/oppsett/field/entrepriser" },
        { label: t("feltarbeid.malerOppgavenotifikasjon"), href: "/dashbord/oppsett/field/oppgavenotifikasjon" },
      ],
    },
    {
      tittel: t("nav.sjekklister"),
      ikon: <ClipboardCheck className="h-12 w-12 text-gray-400" />,
      aktiv: true,
      lenker: [
        { label: t("oppsett.sjekklistemaler"), href: "/dashbord/oppsett/field/sjekklistemaler" },
        { label: t("feltarbeid.sjekklisteHoldepunkt"), href: "/dashbord/oppsett/field/sjekklistemaler-holdepunkt" },
        { label: t("feltarbeid.slettedeSjekklister"), href: "/dashbord/oppsett/field/slettede-sjekklister" },
        { label: t("feltarbeid.entreprisetilknytning"), href: "/dashbord/oppsett/field/sjekkliste-entrepriser" },
      ],
    },
    {
      tittel: t("feltarbeid.kontrollplaner"),
      ikon: <SearchCheck className="h-12 w-12 text-gray-300" />,
      aktiv: false,
      lenker: [
        { label: t("feltarbeid.kontrollplaner"), href: "#" },
        { label: t("feltarbeid.kontrollplanmatriser"), href: "#" },
        { label: t("feltarbeid.arbeidsforlopKnytning"), href: "#" },
      ],
    },
    {
      tittel: t("feltarbeid.godkjennelser"),
      ikon: <ThumbsUp className="h-12 w-12 text-gray-300" />,
      aktiv: false,
      lenker: [
        { label: t("feltarbeid.godkjennelsesmaler"), href: "#" },
      ],
    },
    {
      tittel: t("feltarbeid.vaer"),
      ikon: <CloudSun className="h-12 w-12 text-gray-300" />,
      aktiv: false,
      lenker: [
        { label: t("feltarbeid.vaer"), href: "#", undertekst: t("feltarbeid.deaktivert") },
        { label: t("feltarbeid.visVaer"), href: "#", undertekst: t("feltarbeid.deaktivert") },
        { label: t("feltarbeid.vaerdata"), href: "#" },
      ],
    },
    {
      tittel: t("feltarbeid.capture"),
      ikon: <Camera className="h-12 w-12 text-gray-300" />,
      aktiv: false,
      lenker: [
        { label: t("feltarbeid.captureTyper"), href: "#", undertekst: t("feltarbeid.fotoalbumer") },
        { label: t("feltarbeid.grupperMedAdgang"), href: "#" },
        { label: t("feltarbeid.slettedeFotoalbum"), href: "#" },
      ],
    },
    {
      tittel: t("feltarbeid.dagligLogg"),
      ikon: <BookOpen className="h-12 w-12 text-gray-300" />,
      aktiv: false,
      lenker: [
        { label: "Typer", href: "#" },
        { label: "Rettigheter", href: "#" },
        { label: "Loggfør været", href: "#" },
        { label: "Signaturer", href: "#", undertekst: t("feltarbeid.deaktivert") },
      ],
    },
    {
      tittel: t("feltarbeid.hms"),
      ikon: <HardHat className="h-12 w-12 text-gray-300" />,
      aktiv: false,
      lenker: [
        { label: t("feltarbeid.hmsKategorier"), href: "#" },
        { label: "HMS-observasjon", href: "#" },
        { label: "Verneprotokoll", href: "#" },
        { label: "HMS-oppgave", href: "#" },
      ],
    },
  ];

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">{t("oppsett.feltarbeid")}</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {kategorier.map((kategori) => (
          <FieldKort key={kategori.tittel} kategori={kategori} kommerSnartTekst={t("feltarbeid.kommerSnart")} />
        ))}
      </div>
    </div>
  );
}
