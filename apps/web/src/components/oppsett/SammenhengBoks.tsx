"use client";

/**
 * SammenhengBoks — gjenbrukbar «Hvordan henger dette sammen?»-forklaringsboks.
 *
 * Viser kjeden Tilgangsgruppe → (domener) → Faggruppe → rolle i Dokumentflyt.
 * Collapsed by default; samme hjelp-mønster som `hjelp.*`-blokken på Kontakter-siden.
 * Brukes på Kontakter-siden nå, og er forberedt for Dokumentflyt-oppsett (senere ordre).
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowRight, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

function Ledd({ tittel, beskr, ramme, bakgrunn, tekst }: {
  tittel: string;
  beskr: string;
  ramme: string;
  bakgrunn: string;
  tekst: string;
}) {
  return (
    <div className={`flex-1 min-w-[140px] rounded-lg border px-3 py-2.5 ${ramme} ${bakgrunn}`}>
      <div className={`text-xs font-semibold ${tekst}`}>{tittel}</div>
      <div className="mt-0.5 text-[11px] text-gray-500">{beskr}</div>
    </div>
  );
}

function Pil({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center self-stretch px-0.5">
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
      {label && <span className="mt-0.5 text-[10px] text-gray-400">{label}</span>}
    </div>
  );
}

export function SammenhengBoks() {
  const { t } = useTranslation();
  const [apen, setApen] = useState(false);

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setApen((p) => !p)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {apen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        <HelpCircle className="h-4 w-4 text-sitedoc-primary" />
        {t("sammenheng.tittel")}
      </button>

      {apen && (
        <div className="border-t border-gray-100 px-4 py-4">
          <p className="mb-4 text-sm text-gray-600">{t("sammenheng.intro")}</p>
          <div className="flex flex-wrap items-stretch gap-1">
            <Ledd
              tittel={t("sammenheng.tilgangsgruppe")}
              beskr={t("sammenheng.tilgangsgruppeBeskr")}
              ramme="border-blue-200"
              bakgrunn="bg-blue-50"
              tekst="text-blue-700"
            />
            <Pil label={t("sammenheng.domener")} />
            <Ledd
              tittel={t("sammenheng.faggruppe")}
              beskr={t("sammenheng.faggruppeBeskr")}
              ramme="border-purple-200"
              bakgrunn="bg-purple-50"
              tekst="text-purple-700"
            />
            <Pil />
            <Ledd
              tittel={t("sammenheng.rolle")}
              beskr={t("sammenheng.rolleBeskr")}
              ramme="border-green-200"
              bakgrunn="bg-green-50"
              tekst="text-green-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}
