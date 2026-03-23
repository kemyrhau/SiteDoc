"use client";

import { useState } from "react";
import {
  X,
  ChevronRight,
  ChevronDown,
  EyeOff,
} from "lucide-react";
import type { ValgtObjekt, EgenskapGruppe } from "../typer";
import { INTERNE_FELT } from "../konstanter";
import { formaterVerdi } from "../hjelpefunksjoner";

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
            title="Skjul objekt"
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
                        {formaterVerdi(v.value)}
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

      {objekt.relasjoner.map((gruppe) => (
        <EgenskapsGruppeVis key={gruppe.navn} gruppe={gruppe} />
      ))}
    </div>
  );
}

function EgenskapsGruppeVis({ gruppe }: { gruppe: EgenskapGruppe }) {
  const [utvidet, setUtvidet] = useState(true);

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
        <span className="text-xs font-semibold text-gray-700">{gruppe.navn}</span>
      </button>
      {utvidet && (
        <div className="px-4 pb-2">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(gruppe.egenskaper).map(([k, v]) => (
                <tr key={k}>
                  <td className="py-0.5 pr-2 text-gray-500">{k}</td>
                  <td className="py-0.5 font-medium text-gray-900">
                    {formaterVerdi(v.value)}
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
