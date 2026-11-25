"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  ChevronRight,
  ChevronDown,
  EyeOff,
} from "lucide-react";
import type { ValgtObjekt, EgenskapGruppe, EgenskapVerdi } from "../typer";
import { INTERNE_FELT } from "../konstanter";
import { formaterVerdi } from "../hjelpefunksjoner";

/** Verdi med modellens enhet (W3), f.eks. «990 mm» */
function verdiTekst(v: EgenskapVerdi): string {
  const tekst = formaterVerdi(v.value);
  return v.enhet ? `${tekst} ${v.enhet}` : tekst;
}

export function EgenskapsPopup({
  objekt,
  onLukk,
  onSkjul,
  onFilterKategori,
  onFilterLag,
  onFilterSystem,
}: {
  objekt: ValgtObjekt;
  onLukk: () => void;
  onSkjul: () => void;
  onFilterKategori?: (kategori: string) => void;
  onFilterLag?: (lag: string) => void;
  onFilterSystem?: (system: string) => void;
}) {
  const { t } = useTranslation();
  const kategoriNavn = objekt.kategori?.replace(/^Ifc/, "") ?? "Ukjent";

  const layerVerdi = objekt.attributter["Layer"]?.value ? String(objekt.attributter["Layer"].value) : null;
  const systemVerdi = objekt.attributter["System"]?.value ? String(objekt.attributter["System"].value) : null;

  return (
    <div className="absolute right-4 top-14 z-10 w-[320px] max-h-[calc(100%-72px)] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{kategoriNavn}</h3>
            {onFilterKategori && kategoriNavn !== "Ukjent" && (
              <button
                onClick={() => onFilterKategori(kategoriNavn)}
                className="rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                title={`Skjul alle ${kategoriNavn}`}
              >
                <EyeOff className="h-3 w-3" />
              </button>
            )}
          </div>
          {objekt.attributter["Name"] && (
            <p className="text-xs text-gray-500">
              {String(objekt.attributter["Name"].value)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onSkjul}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title={t("3d.skjulObjektHint")}
            aria-label={t("3d.skjulObjekt")}
          >
            <EyeOff className="h-4 w-4" />
          </button>
          <button
            onClick={onLukk}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Lukk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-gray-100 px-4 py-2">
        <table className="w-full text-xs">
          <tbody>
            {Object.entries(objekt.attributter)
              .filter(([k]) => !INTERNE_FELT.has(k))
              .map(([k, v]) => {
                const erFiltrerbar =
                  (k === "Layer" && layerVerdi && onFilterLag) ||
                  (k === "System" && systemVerdi && onFilterSystem);
                return (
                  <tr key={k}>
                    <td className="py-0.5 pr-2 text-gray-500">{k}</td>
                    <td className="py-0.5 font-medium text-gray-900">
                      <span className="flex items-center gap-1">
                        {verdiTekst(v)}
                        {erFiltrerbar && (
                          <button
                            onClick={() => {
                              if (k === "Layer" && onFilterLag) onFilterLag(String(v.value));
                              if (k === "System" && onFilterSystem) onFilterSystem(String(v.value));
                            }}
                            className="rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                            title={`Skjul alle med ${k}: ${formaterVerdi(v.value)}`}
                          >
                            <EyeOff className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {objekt.relasjoner.map((gruppe, i) => (
        <EgenskapsGruppeVis key={`${i}-${gruppe.navn}`} gruppe={gruppe} />
      ))}
    </div>
  );
}

function EgenskapsGruppeVis({ gruppe }: { gruppe: EgenskapGruppe }) {
  const { t } = useTranslation();
  const [utvidet, setUtvidet] = useState(true);
  // Type- og mengdesett merkes, så de skilles fra objektets egne egenskapssett
  const artTekst = gruppe.art === "type" ? t("3d.egenskaper.type")
    : gruppe.art === "mengder" ? t("3d.egenskaper.mengder")
    : gruppe.art === "egenskapssett" && !gruppe.navn ? t("3d.egenskaper.egenskapssett")
    : null;
  const tittel = artTekst && gruppe.navn ? `${artTekst}: ${gruppe.navn}` : (artTekst ?? gruppe.navn);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setUtvidet(!utvidet)}
        className="flex w-full items-center gap-1 px-4 py-2 text-left hover:bg-gray-50"
      >
        {utvidet ? (
          <ChevronDown className="h-3 w-3 text-gray-400" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-400" />
        )}
        <span className="min-w-0 break-words text-xs font-semibold text-gray-700">{tittel}</span>
      </button>
      {utvidet && (
        <div className="px-4 pb-2">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(gruppe.egenskaper).map(([k, v]) => (
                <tr key={k}>
                  <td className="py-0.5 pr-2 text-gray-500">{k}</td>
                  <td className="py-0.5 font-medium text-gray-900">
                    {verdiTekst(v)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
