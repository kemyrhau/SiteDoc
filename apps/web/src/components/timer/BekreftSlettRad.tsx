"use client";

import { Button, Modal } from "@sitedoc/ui";
import { useTranslation } from "react-i18next";

/**
 * Runde 9 (ui-standarder § Slett-bekreftelse, orkestrator-godkjent 2026-11-28): sletting av
 * tillegg, maskin og utlegg på dagsseddelen bekreftes i modal med radens navn.
 */
export function BekreftSlettRad({
  navn,
  sletter,
  onBekreft,
  onLukk,
}: {
  navn: string;
  sletter: boolean;
  onBekreft: () => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={true} onClose={onLukk} title={t("timer.slettRad.tittel")}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700">{t("timer.slettRad.tekst", { navn })}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button variant="danger" loading={sletter} onClick={onBekreft}>
            {t("timer.fjernTimerRad.bekreftRad")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
