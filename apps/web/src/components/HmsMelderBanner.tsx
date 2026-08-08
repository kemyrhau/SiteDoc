"use client";

// HMS melder-handlingsbanner (Spor 2 / 5a). Vises ØVERST på HMS-detaljen når
// innlogget bruker er melder OG ballen ligger hos melder-leddet (Ledd 1):
//   • Utkast (draft):     «Send inn» + «Forkast utkast»
//   • Returnert (responded, rutet tilbake): «Send tilbake til behandler»
//
// Melder eier innholdet (5c): skjemaet er redigerbart så lenge dette banneret vises
// (leseModus-snittet i detalj-siden speiler samme betingelse). Forkast er en myk
// slett bak ekte modal (CLAUDE.md — aldri native confirm()). Delt av oppgave- og
// sjekkliste-detaljen — én kilde, ikke duplisert.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@sitedoc/ui";
import { Send, Trash2 } from "lucide-react";

interface HmsMelderBannerProps {
  /** Dokumentets status — «draft» gir Send inn/Forkast, ellers Send tilbake. */
  status: string;
  laster: boolean;
  onSendInn: () => void;
  /** Kalles etter bekreftelse i modalen (myk slett av utkastet). */
  onForkast: () => void;
}

export function HmsMelderBanner({ status, laster, onSendInn, onForkast }: HmsMelderBannerProps) {
  const { t } = useTranslation();
  const [visForkast, setVisForkast] = useState(false);
  const erUtkast = status === "draft";

  return (
    <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 print-skjul">
      <p className="text-sm leading-relaxed text-blue-900">
        {erUtkast ? t("hms.utkast.forklaring") : t("hms.retur.forklaring")}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSendInn}
          disabled={laster}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-sitedoc-primary px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {erUtkast ? t("hms.handling.sendInn") : t("hms.handling.sendTilbake")}
        </button>
        {erUtkast && (
          <button
            type="button"
            onClick={() => setVisForkast(true)}
            disabled={laster}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {t("hms.handling.forkast")}
          </button>
        )}
      </div>

      <Modal open={visForkast} onClose={() => setVisForkast(false)} title={t("hms.forkast.tittel")}>
        <p className="text-sm text-gray-600">{t("hms.forkast.bekreft")}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setVisForkast(false)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            {t("handling.avbryt")}
          </button>
          <button
            type="button"
            onClick={() => {
              setVisForkast(false);
              onForkast();
            }}
            className="rounded-lg bg-sitedoc-error px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
          >
            {t("hms.handling.forkast")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
