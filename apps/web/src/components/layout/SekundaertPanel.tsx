"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SekundaertPanelProps {
  tittel: string;
  children: ReactNode;
  /**
   * Når satt: panelet får en skjul/vis-pil på kanten, og skjult tilstand
   * persisteres i localStorage under denne nøkkelen. Default (udefinert) =
   * uendret oppførsel — panelet er alltid synlig (alle eksisterende kallere).
   * Brukes av mapper-siden bak nyNavigasjon-flagget (s1).
   */
  skjulNokkel?: string;
}

export function SekundaertPanel({ tittel, children, skjulNokkel }: SekundaertPanelProps) {
  const { t } = useTranslation();
  // Start alltid synlig på server + første render (unngår hydrerings-avvik);
  // faktisk verdi settes i effekten under.
  const [skjult, setSkjult] = useState(false);
  useEffect(() => {
    if (!skjulNokkel) return;
    setSkjult(window.localStorage.getItem(skjulNokkel) === "1");
  }, [skjulNokkel]);
  function settSkjultPersistert(ny: boolean) {
    setSkjult(ny);
    if (skjulNokkel) window.localStorage.setItem(skjulNokkel, ny ? "1" : "0");
  }

  // Skjult tilstand: tynn skinne med vis-pil (kun når skjulNokkel er satt).
  if (skjulNokkel && skjult) {
    return (
      <aside
        data-panel="sekundaert"
        className="hidden w-9 flex-shrink-0 flex-col items-center border-r border-gray-200 bg-white py-3 md:flex"
      >
        <button
          type="button"
          onClick={() => settSkjultPersistert(false)}
          title={t("mapper.visPanel")}
          aria-label={t("mapper.visPanel")}
          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside data-panel="sekundaert" className="hidden w-[280px] flex-shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{tittel}</h2>
        {skjulNokkel && (
          <button
            type="button"
            onClick={() => settSkjultPersistert(true)}
            title={t("mapper.skjulPanel")}
            aria-label={t("mapper.skjulPanel")}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {children}
      </div>
    </aside>
  );
}
