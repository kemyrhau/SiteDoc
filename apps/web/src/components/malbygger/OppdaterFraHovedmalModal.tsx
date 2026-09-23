"use client";

import { useTranslation } from "react-i18next";
import { Modal, Button } from "@sitedoc/ui";

/**
 * Bekreftelse FØR prosjekt-↻ «Oppdater fra firmamal» (ordre synliggjor-malforvaltning
 * TILLEGG 1). `oppdaterKopiFraHovedmal` erstatter hele objekt-treet, så utfylte verdier i
 * dokumenter som alt bruker malen mister koblingen til feltene (advarsel `firmamal.ts:766-768`).
 *
 * 🔴 DELT komponent så handlingen er like trygg i mallista som inne i MalBygger — samme
 * tekst, samme oppførsel. Malarkiv-↻ (firma←SiteDoc, `oppdaterFraSentralarkiv`) er en ANNEN,
 * trygg handling og får bevisst INGEN bekreftelse.
 *
 * `antallDokumenter` vises kun når det er kjent (mallista har `_count`; MalBygger henter
 * ikke tellingen og sender `undefined` — teksten står da uten tall, ingen ny tellerprosedyre).
 */
export function OppdaterFraHovedmalModal({
  open,
  onClose,
  onConfirm,
  laster,
  antallDokumenter,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  laster: boolean;
  antallDokumenter?: number;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={t("malbygger.oppdaterBekreft.tittel")}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-700">{t("malbygger.oppdaterBekreft.brodtekst")}</p>
        {typeof antallDokumenter === "number" && antallDokumenter > 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            {t("malbygger.oppdaterBekreft.antall", { antall: antallDokumenter })}
          </p>
        )}
        <div className="flex gap-3 pt-1">
          <Button variant="danger" onClick={onConfirm} loading={laster}>
            {t("malbygger.firmaarkiv.oppdater")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t("handling.avbryt")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
