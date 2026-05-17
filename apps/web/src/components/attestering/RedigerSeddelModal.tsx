"use client";

// T7-5b-3 (2026-05-17): Modal-wrapper rundt AttesteringDetalj som lukkes
// etter attester/returner/lagre i stedet for å navigere bort.
// Mål per T7-5b-plan: bruker beholder list-kontekst når én sedel redigeres.

import { useTranslation } from "react-i18next";
import { Modal } from "@sitedoc/ui";
import { AttesteringDetalj } from "@/components/timer/AttesteringDetalj";

type Props = {
  sheetId: string;
  onLukk: () => void;
};

export function RedigerSeddelModal({ sheetId, onLukk }: Props) {
  const { t } = useTranslation();

  return (
    <Modal
      open={true}
      onClose={onLukk}
      title={t("timer.attestering.meny.rediger")}
      // max-w-[80vw] per T7-5b-spec. max-h begrenser så modalen ikke
      // sprenger viewport ved lange sedler — innholdet får egen scroll.
      className="max-h-[90vh] max-w-[80vw] overflow-hidden"
      lukkVedBackdropKlikk
    >
      <div className="-m-2 max-h-[calc(90vh-7rem)] overflow-y-auto">
        <AttesteringDetalj
          sheetId={sheetId}
          // tilbakeUrl er ubrukt når onFerdig er satt — sett til tom streng
          // for å oppfylle ikke-optional-prop-kontrakten.
          tilbakeUrl=""
          onFerdig={onLukk}
          // T7-5b-B1: dropp max-w-3xl-wrapperen så innholdet følger
          // modal-bredden (max-w-[80vw]).
          fullBredde
          // T7-5b-B6: åpne direkte i edit-modus så bruker slipper å
          // klikke "Rediger sedel" inni modalen. Aktiveres kun hvis
          // sheet.redigerTillatt=true (firma-flagget).
          initialModus="rediger"
        />
      </div>
    </Modal>
  );
}
