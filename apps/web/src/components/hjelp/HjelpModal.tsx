"use client";

import { useState } from "react";
import { HelpCircle, X, ArrowRight, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

/* ------------------------------------------------------------------ */
/*  Fane-typer                                                         */
/* ------------------------------------------------------------------ */

type Fane = "firma" | "roller" | "dokumentflyt";

/* ------------------------------------------------------------------ */
/*  HjelpKnapp — sirkel med ? som åpner modalen                       */
/* ------------------------------------------------------------------ */

export function HjelpKnapp() {
  const [åpen, setÅpen] = useState(false);
  const { t } = useTranslation();

  return (
    <>
      <button
        onClick={() => setÅpen(true)}
        className="inline-flex items-center justify-center rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        title={t("hjelp.tittel")}
      >
        <HelpCircle className="h-5 w-5" />
      </button>
      {åpen && <HjelpModal onLukk={() => setÅpen(false)} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  HjelpModal — modal med tre faner                                   */
/* ------------------------------------------------------------------ */

function HjelpModal({ onLukk }: { onLukk: () => void }) {
  const [aktivFane, setAktivFane] = useState<Fane>("firma");
  const { t } = useTranslation();

  const faner: { id: Fane; label: string }[] = [
    { id: "firma", label: t("hjelp.faneFirma") },
    { id: "roller", label: t("hjelp.faneRoller") },
    { id: "dokumentflyt", label: t("hjelp.faneDokumentflyt") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onLukk}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" />
      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-2xl rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{t("hjelp.tittel")}</h2>
          <button onClick={onLukk} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Faner */}
        <div className="flex border-b border-gray-200 px-6">
          {faner.map((f) => (
            <button
              key={f.id}
              onClick={() => setAktivFane(f.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                aktivFane === f.id
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Innhold */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {aktivFane === "firma" && <FirmaVsFaggruppe />}
          {aktivFane === "roller" && <Roller />}
          {aktivFane === "dokumentflyt" && <Dokumentflyt />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fane 1: Firma vs faggruppe                                          */
/* ------------------------------------------------------------------ */

function FirmaVsFaggruppe() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{t("hjelp.firmaOverskrift")}</h3>
        <p className="mt-1 text-sm text-gray-600">{t("hjelp.firmaBeskrivelse")}</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{t("hjelp.faggruppeOverskrift")}</h3>
        <p className="mt-1 text-sm text-gray-600">{t("hjelp.faggruppeBeskrivelse")}</p>
      </div>
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
        <p className="text-sm font-medium text-blue-800">{t("hjelp.firmaEksempelTittel")}</p>
        <p className="mt-1 text-sm text-blue-700">{t("hjelp.firmaEksempel")}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fane 2: Roller                                                     */
/* ------------------------------------------------------------------ */

const ROLLER_DATA: {
  rolleKey: string;
  person: string;
  farge: string;
  skjoldFarge?: string;
}[] = [
  { rolleKey: "admin", person: "Ola Nordmann", farge: "blue", skjoldFarge: "text-blue-500" },
  { rolleKey: "firmaansvarlig", person: "Trude Tømrer", farge: "amber", skjoldFarge: "text-amber-500" },
  { rolleKey: "registrator", person: "Kari Hansen", farge: "gray" },
  { rolleKey: "medlem", person: "Per Arbeider", farge: "gray" },
];

function Roller() {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {ROLLER_DATA.map((r) => (
        <div key={r.rolleKey} className="rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            {r.skjoldFarge && <Shield className={`h-4 w-4 ${r.skjoldFarge}`} />}
            <span className="text-sm font-semibold text-gray-900">
              {t(`hjelp.rolle.${r.rolleKey}.navn`)}
            </span>
            <span className="text-xs text-gray-400">({r.person})</span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{t(`hjelp.rolle.${r.rolleKey}.beskrivelse`)}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fane 3: Dokumentflyt                                               */
/* ------------------------------------------------------------------ */

function Dokumentflyt() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t("hjelp.flytBeskrivelse")}</p>

      {/* Visuell eksempel */}
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-center">
          <div className="text-xs font-semibold text-blue-700">Elektro</div>
          <div className="mt-1 text-xs text-blue-500">3 personer</div>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1 text-xs font-semibold text-purple-700">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            Byggherre
          </div>
          <div className="mt-1 text-xs text-purple-500">4 personer</div>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-center">
          <div className="text-xs font-semibold text-green-700">Tømrer</div>
          <div className="mt-1 text-xs text-green-500">2 personer</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-sm font-semibold text-gray-900">{t("hjelp.flytBlåPrikk")}</span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{t("hjelp.flytForklaring1")}</p>
        </div>
        <div className="rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Leser</span>
            <span className="text-sm font-semibold text-gray-900">{t("hjelp.flytRettighet")}</span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{t("hjelp.flytForklaring2")}</p>
        </div>
      </div>
    </div>
  );
}
