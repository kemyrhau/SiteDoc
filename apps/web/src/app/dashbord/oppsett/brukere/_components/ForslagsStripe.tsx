"use client";

/**
 * ForslagsStripe — lukkbar, IKKE-blokkerende stripe etter vellykket tilføyelse
 * (ordre DESIGNLÅS § 11 / forslagslaget). Innhold varierer med inngang:
 *   fra kontaktliste → foreslå brukergruppe + dokumentflyt
 *   fra gruppe       → kun dokumentflyt (gruppe alt satt)
 * «Senere» og X koster null — aldri modal, aldri obligatorisk steg.
 */

import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

export interface Forslag {
  navn: string;
  // projectMemberId på den nettopp lagt-til personen (for «+ Brukergruppe» → personkort).
  projectMemberId?: string;
  visGruppe: boolean;
  visFlyt: boolean;
}

export function ForslagsStripe({
  forslag,
  onBrukergruppe,
  onFlyt,
  onLukk,
}: {
  forslag: Forslag;
  onBrukergruppe: () => void;
  onFlyt: () => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
      <p className="flex-1 text-sm text-blue-900">{t("kontakter.forslagTekst", { navn: forslag.navn })}</p>
      {forslag.visGruppe && (
        <button onClick={onBrukergruppe} className="rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
          {t("kontakter.forslagBrukergruppe")}
        </button>
      )}
      {forslag.visFlyt && (
        <button onClick={onFlyt} className="rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
          {t("kontakter.forslagFlyt")}
        </button>
      )}
      <button onClick={onLukk} className="rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
        {t("kontakter.forslagSenere")}
      </button>
      <button onClick={onLukk} className="rounded p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600" title={t("kontakter.forslagSenere")}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
